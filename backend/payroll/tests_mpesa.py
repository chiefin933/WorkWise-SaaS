from unittest.mock import patch, Mock

from django.urls import reverse
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from tenants.models import Tenant
from employees.models import Employee
from payroll.models import PayrollRun, MpesaTransaction
from payroll.mpesa import DarajaClient


class MpesaB2CTests(APITestCase):
    @override_settings(
        MPESA_B2C_RESULT_URL='https://example.com/api/mpesa/b2c/result/',
        MPESA_B2C_TIMEOUT_URL='https://example.com/api/mpesa/b2c/timeout/',
        MPESA_CALLBACK_URL='https://example.com/api/mpesa/stk-push-callback/',
    )
    @patch('payroll.mpesa.requests.post')
    def test_b2c_payment_payload_uses_dedicated_result_and_timeout_urls(self, mock_post):
        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {
            'ResponseCode': '0',
            'ResponseDescription': 'Accepted',
        }
        mock_post.return_value = mock_response

        client = DarajaClient()
        client._access_token = 'test-token'
        client.b2c_payment('0712345678', 1500.0)

        called_json = mock_post.call_args.kwargs['json']
        self.assertEqual(called_json['QueueTimeOutURL'], 'https://example.com/api/mpesa/b2c/timeout/')
        self.assertEqual(called_json['ResultURL'], 'https://example.com/api/mpesa/b2c/result/')
        self.assertNotEqual(called_json['QueueTimeOutURL'], 'https://example.com/api/mpesa/stk-push-callback/')
        self.assertNotEqual(called_json['ResultURL'], 'https://example.com/api/mpesa/stk-push-callback/')

    def test_b2c_result_callback_updates_mpesa_transaction(self):
        tenant = Tenant.objects.create(name='Result Company', plan='GROWTH')
        employee = Employee.objects.create(
            tenant=tenant,
            name='Result Employee',
            email='result@example.com',
            payment_method='mpesa',
            mpesa_number='254712345678',
        )
        payroll_run = PayrollRun.objects.create(tenant=tenant, month=6, year=2026, status='approved')
        txn = MpesaTransaction.objects.create(
            payroll_run=payroll_run,
            employee=employee,
            phone_number='254712345678',
            amount=1500.00,
            status='pending',
            conversation_id='CONV123',
            originator_conversation_id='ORIG123',
        )

        url = reverse('mpesa_result')
        response = self.client.post(
            url,
            {
                'Result': {
                    'ConversationID': 'CONV123',
                    'OriginatorConversationID': 'ORIG123',
                    'ResultCode': 0,
                    'ResultDesc': 'The service request is processed successfully.',
                }
            },
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        txn.refresh_from_db()
        self.assertEqual(txn.status, 'success')
        self.assertEqual(txn.result_code, '0')
        self.assertEqual(txn.result_desc, 'The service request is processed successfully.')

    def test_b2c_timeout_callback_marks_transaction_timeout(self):
        tenant = Tenant.objects.create(name='Timeout Company', plan='GROWTH')
        employee = Employee.objects.create(
            tenant=tenant,
            name='Timeout Employee',
            email='timeout@example.com',
            payment_method='mpesa',
            mpesa_number='254712345679',
        )
        payroll_run = PayrollRun.objects.create(tenant=tenant, month=6, year=2026, status='approved')
        txn = MpesaTransaction.objects.create(
            payroll_run=payroll_run,
            employee=employee,
            phone_number='254712345679',
            amount=2000.00,
            status='pending',
            conversation_id='CONV456',
            originator_conversation_id='ORIG456',
        )

        url = reverse('mpesa_timeout')
        response = self.client.post(
            url,
            {
                'Result': {
                    'ConversationID': 'CONV456',
                    'OriginatorConversationID': 'ORIG456',
                }
            },
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        txn.refresh_from_db()
        self.assertEqual(txn.status, 'timeout')
        self.assertEqual(txn.result_desc, 'Request timed out in Safaricom queue')

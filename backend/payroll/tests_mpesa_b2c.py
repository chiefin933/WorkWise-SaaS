from django.urls import resolve, reverse
from rest_framework import status
from rest_framework.test import APITestCase

from employees.models import Employee
from payroll.models import MpesaTransaction, PayrollRun
from payroll.mpesa_views import MpesaB2CResultView, MpesaB2CTimeoutView
from tenants.models import Tenant


class MpesaB2CTests(APITestCase):
    def setUp(self):
        tenant = Tenant.objects.create(name='MpesaTenant', plan='STARTER')
        self.employee = Employee.objects.create(
            tenant=tenant,
            name='Mpesa Employee',
            email='mpesa@example.com',
            phone='0712345678',
        )
        self.payroll_run = PayrollRun.objects.create(
            tenant=tenant,
            month=6,
            year=2026,
            status='approved',
        )
        self.txn = MpesaTransaction.objects.create(
            payroll_run=self.payroll_run,
            employee=self.employee,
            phone_number='254712345678',
            amount=1000.00,
            status='pending',
            conversation_id='AG_ABC123',
            originator_conversation_id='SIM-ABC123',
        )

    def test_b2c_result_updates_transaction(self):
        url = reverse('mpesa_result')
        payload = {
            'Result': {
                'ConversationID': self.txn.conversation_id,
                'OriginatorConversationID': self.txn.originator_conversation_id,
                'ResultCode': 0,
                'ResultDesc': 'Success',
            }
        }
        resp = self.client.post(url, payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        self.txn.refresh_from_db()
        self.assertEqual(self.txn.status, 'success')

    def test_b2c_timeout_marks_timeout(self):
        url = reverse('mpesa_timeout')
        payload = {'Result': {'ConversationID': self.txn.conversation_id, 'OriginatorConversationID': self.txn.originator_conversation_id}}
        resp = self.client.post(url, payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.txn.refresh_from_db()
        self.assertEqual(self.txn.status, 'timeout')

    def test_b2c_legacy_callback_updates(self):
        url = reverse('mpesa-b2c-callback')
        payload = {'Result': {'ConversationID': self.txn.conversation_id, 'OriginatorConversationID': self.txn.originator_conversation_id, 'ResultCode': '0', 'ResultDesc': 'OK'}}
        resp = self.client.post(url, payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.txn.refresh_from_db()
        self.assertEqual(self.txn.status, 'success')

    def test_b2c_missing_transaction_logs_warning(self):
        url = reverse('mpesa_result')
        payload = {'Result': {'ConversationID': 'NON_EXISTENT', 'OriginatorConversationID': 'NONE', 'ResultCode': '1', 'ResultDesc': 'Fail'}}
        resp = self.client.post(url, payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_b2c_result_and_timeout_routes_resolve_to_dedicated_handlers(self):
        result_match = resolve('/api/mpesa/b2c/result/')
        timeout_match = resolve('/api/mpesa/b2c/timeout/')

        self.assertIs(result_match.func.view_class, MpesaB2CResultView)
        self.assertEqual(result_match.func.view_class.__module__, 'payroll.mpesa_views')
        self.assertIs(timeout_match.func.view_class, MpesaB2CTimeoutView)
        self.assertEqual(timeout_match.func.view_class.__module__, 'payroll.mpesa_views')


class DarajaClientConfigTests(APITestCase):
    def test_b2c_payment_raises_when_callbacks_missing_in_production(self):
        from payroll.mpesa import DarajaClient
        client = DarajaClient()
        client.sandbox = False
        client.result_url = ''
        client.timeout_url = ''
        client._access_token = 'TOK'

        with self.assertRaises(ValueError):
            client.b2c_payment('0712345678', 1000.00)

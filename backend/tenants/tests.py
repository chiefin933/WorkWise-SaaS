from django.urls import reverse
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
from tenants.models import Tenant, MpesaSubscriptionPayment
from unittest.mock import patch

User = get_user_model()

class MpesaExpressTests(APITestCase):
    def setUp(self):
        # Create Starter tenant
        self.tenant = Tenant.objects.create(
            name="Starter Company",
            plan="STARTER"
        )
        # Admin user
        self.admin_user = User.objects.create_user(
            email="admin@company.com",
            password="password123",
            tenant=self.tenant,
            role="ADMIN"
        )
        # Non-admin user
        self.user = User.objects.create_user(
            email="user@company.com",
            password="password123",
            tenant=self.tenant,
            role="EMPLOYEE"
        )

    def test_stk_push_requires_admin(self):
        self.client.force_authenticate(user=self.user)
        url = reverse('stk_push')
        response = self.client.post(url, {
            'phone': '254708374149',
            'plan': 'GROWTH',
            'amount': 6500
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @override_settings(MPESA_STK_CALLBACK_URL='https://example.com/api/mpesa/stk-push-callback/')
    @patch('django_daraja.mpesa.core.MpesaClient.stk_push')
    def test_stk_push_success_initiating(self, mock_stk_push):
        # Setup mock response
        class MockResponse:
            response_code = '0'
            checkout_request_id = 'ws_CO_12345'
            merchant_request_id = '12345-6789'
            response_description = 'Success'

        mock_stk_push.return_value = MockResponse()

        self.client.force_authenticate(user=self.admin_user)
        url = reverse('stk_push')
        response = self.client.post(url, {
            'phone': '0708374149',
            'plan': 'GROWTH',
            'amount': 6500
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['checkout_request_id'], 'ws_CO_12345')
        
        # Verify db payment record created
        payment = MpesaSubscriptionPayment.objects.get(checkout_request_id='ws_CO_12345')
        self.assertEqual(payment.status, 'pending')
        self.assertEqual(payment.plan, 'GROWTH')
        self.assertEqual(payment.amount, 6500)

    def test_stk_callback_success_upgrades_plan(self):
        # Create a pending payment
        payment = MpesaSubscriptionPayment.objects.create(
            tenant=self.tenant,
            plan='GROWTH',
            phone_number='254708374149',
            amount=6500,
            status='pending',
            checkout_request_id='ws_CO_12345',
            merchant_request_id='12345-6789'
        )
        
        url = reverse('stk_callback')
        callback_data = {
            "Body": {
                "stkCallback": {
                    "MerchantRequestID": "12345-6789",
                    "CheckoutRequestID": "ws_CO_12345",
                    "ResultCode": 0,
                    "ResultDesc": "The service request is processed successfully."
                }
            }
        }
        
        response = self.client.post(url, callback_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify status updated
        payment.refresh_from_db()
        self.assertEqual(payment.status, 'success')
        
        # Verify plan upgraded
        self.tenant.refresh_from_db()
        self.assertEqual(self.tenant.plan, 'GROWTH')
        self.assertEqual(self.tenant.subscription_status, 'ACTIVE')

    def test_stk_callback_failure_marks_failed(self):
        payment = MpesaSubscriptionPayment.objects.create(
            tenant=self.tenant,
            plan='GROWTH',
            phone_number='254708374149',
            amount=6500,
            status='pending',
            checkout_request_id='ws_CO_12345',
            merchant_request_id='12345-6789'
        )
        
        url = reverse('stk_callback')
        callback_data = {
            "Body": {
                "stkCallback": {
                    "MerchantRequestID": "12345-6789",
                    "CheckoutRequestID": "ws_CO_12345",
                    "ResultCode": 1032,
                    "ResultDesc": "Request cancelled by user."
                }
            }
        }
        
        response = self.client.post(url, callback_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        payment.refresh_from_db()
        self.assertEqual(payment.status, 'failed')
        self.assertEqual(payment.result_code, '1032')
        
        # Verify plan NOT upgraded
        self.tenant.refresh_from_db()
        self.assertEqual(self.tenant.plan, 'STARTER')

    def test_payment_status_polling(self):
        payment = MpesaSubscriptionPayment.objects.create(
            tenant=self.tenant,
            plan='GROWTH',
            phone_number='254708374149',
            amount=6500,
            status='success',
            checkout_request_id='ws_CO_12345',
            merchant_request_id='12345-6789'
        )
        
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('stk_status')
        response = self.client.get(url, {'checkout_request_id': 'ws_CO_12345'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')

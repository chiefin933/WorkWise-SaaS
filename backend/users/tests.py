from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model

User = get_user_model()


class NotificationSettingsTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='testuser@example.com',
            password='testpassword123',
            notification_preferences={'payroll_run': True, 'leave_status': False}
        )
        self.url = reverse('notification_settings')

    def test_get_notifications_unauthenticated(self):
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_get_notifications_authenticated(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data, {'payroll_run': True, 'leave_status': False})

    def test_patch_notifications_unauthenticated(self):
        resp = self.client.patch(self.url, {'leave_status': True}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_patch_notifications_authenticated_direct_dict(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.patch(self.url, {'leave_status': True, 'new_member': False}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        # Should be merged
        self.assertEqual(resp.data, {
            'payroll_run': True,
            'leave_status': True,
            'new_member': False
        })
        self.user.refresh_from_db()
        self.assertEqual(self.user.notification_preferences, {
            'payroll_run': True,
            'leave_status': True,
            'new_member': False
        })

    def test_patch_notifications_authenticated_nested(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.patch(self.url, {
            'notification_preferences': {'trial_expiry': False, 'payroll_run': False}
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data, {
            'payroll_run': False,
            'leave_status': False,
            'trial_expiry': False
        })

    def test_patch_notifications_invalid_data(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.patch(self.url, ['not', 'a', 'dict'], format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


class NotificationTests(APITestCase):
    def setUp(self):
        from tenants.models import Tenant
        self.tenant = Tenant.objects.create(name="Test Tenant", plan="STARTER")
        self.user = User.objects.create_user(
            email='testuser@example.com',
            password='testpassword123',
            tenant=self.tenant,
            role='ADMIN'
        )
        self.other_user = User.objects.create_user(
            email='other@example.com',
            password='testpassword123',
            tenant=self.tenant,
            role='HR'
        )
        from users.models import Notification
        self.notif1 = Notification.objects.create(
            tenant=self.tenant,
            recipient=self.user,
            type='payroll',
            title='Test Payroll',
            message='June payroll processed',
            is_read=False
        )
        self.notif2 = Notification.objects.create(
            tenant=self.tenant,
            recipient=self.user,
            type='system',
            title='Test System',
            message='System update',
            is_read=True
        )
        self.other_notif = Notification.objects.create(
            tenant=self.tenant,
            recipient=self.other_user,
            type='system',
            title='Other System',
            message='System update',
            is_read=False
        )
        self.list_url = '/api/notifications/'

    def test_list_notifications(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get(self.list_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data), 2)
        self.assertEqual(resp.data[0]['id'], str(self.notif2.id))
        self.assertEqual(resp.data[1]['id'], str(self.notif1.id))

    def test_list_unread_notifications(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get(self.list_url, {'unread': 'true'})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]['id'], str(self.notif1.id))

    def test_mark_read(self):
        self.client.force_authenticate(user=self.user)
        url = f'/api/notifications/{self.notif1.id}/read/'
        resp = self.client.post(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data['is_read'])
        self.notif1.refresh_from_db()
        self.assertTrue(self.notif1.is_read)

    def test_mark_all_read(self):
        self.client.force_authenticate(user=self.user)
        url = '/api/notifications/read-all/'
        resp = self.client.post(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.notif1.refresh_from_db()
        self.assertTrue(self.notif1.is_read)
        self.other_notif.refresh_from_db()
        self.assertFalse(self.other_notif.is_read)

    def test_delete_notification(self):
        self.client.force_authenticate(user=self.user)
        url = f'/api/notifications/{self.notif1.id}/'
        resp = self.client.delete(url)
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        from users.models import Notification
        self.assertFalse(Notification.objects.filter(id=self.notif1.id).exists())



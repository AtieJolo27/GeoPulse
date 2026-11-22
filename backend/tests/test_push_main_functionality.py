"""Reminder routing tests. All delivery and database calls are mocked."""
import unittest
from datetime import datetime, timezone
from unittest.mock import Mock, patch
from app.services.push_worker import run, deliver, send_push
import io
import json

class ReminderRoutingTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 11, 17, 1, tzinfo=timezone.utc)
        self.device = {'token': 'unit-token', 'user_id': 'farmer', 'language': 'english'}
        self.zone = {'id': 7, 'current_crop': 'rice', 'planted_on': '2026-08-17', 'name_en': 'North field', 'name_tl': 'Hilagang bukid'}
        self.event = {'id': 'e1', 'user_id': 'farmer', 'zone_id': 7, 'crop': 'rice', 'planted_on': '2026-08-17', 'kind': 'harvest', 'event_date': '2026-11-17', 'notify_at': '2026-11-17T00:00:00Z'}

    def database(self, event=None):
        db = Mock()
        rows = {'push_devices': [self.device], 'crop_events': [event or self.event], 'zones': [self.zone], 'push_zone_subscriptions': []}
        def table(name):
            q = Mock()
            for method in ['select', 'eq', 'lte', 'gte']:
                getattr(q, method).return_value = q
            q.execute.return_value.data = rows[name]
            return q
        db.table.side_effect = table
        return db

    @patch('app.services.push_worker.deliver')
    def test_current_crop_reminder_routes_to_its_calendar_zone(self, send):
        run(self.database(), self.now)
        send.assert_called_once()
        self.assertEqual(send.call_args.args[-1], {'screen': 'calendar', 'zone_id': 7})
        self.assertIn('North field', send.call_args.args[3])
        self.assertIn('Harvest reminder', send.call_args.args[3])

    @patch('app.services.push_worker.deliver')
    def test_old_crop_cycle_and_other_account_never_receive_reminder(self, send):
        for change in [{'user_id': 'other'}, {'crop': 'corn'}, {'planted_on': '2025-08-17'}, {'zone_id': 99}]:
            with self.subTest(change=change):
                send.reset_mock()
                run(self.database({**self.event, **change}), self.now)
                send.assert_not_called()

    @patch('app.services.push_worker.deliver')
    def test_tagalog_fertilizer_reminder_uses_localized_zone_and_destination(self, send):
        self.device['language'] = 'tagalog'
        run(self.database({**self.event, 'kind': 'fertilizer'}), self.now)
        self.assertIn('Hilagang bukid', send.call_args.args[3])
        self.assertIn('Paalala sa pataba', send.call_args.args[3])
        self.assertEqual(send.call_args.args[-1]['zone_id'], 7)

    @patch('app.services.push_worker.send_push', return_value=(None, 'DeviceNotRegistered'))
    @patch('builtins.print')
    def test_unregistered_device_is_removed_without_marking_delivery_sent(self, quiet, send):
        db = Mock()
        db.rpc.return_value.execute.return_value.data = True
        deliver(db, self.device, 'test-key', 'Title', 'Body', {})
        db.table.assert_called_with('push_devices')
        db.table.return_value.delete.return_value.eq.assert_called_once_with('token', 'unit-token')
        db.table.return_value.update.assert_not_called()


class PushTransportTests(unittest.TestCase):
    @patch('app.services.push_worker.urlopen')
    @patch.dict('os.environ', {'EXPO_ACCESS_TOKEN': 'test-access'})
    def test_payload_preserves_zone_destination_and_android_channel(self, urlopen):
        urlopen.return_value.__enter__.return_value = io.BytesIO(b'{"data":{"status":"ok","id":"ticket-1"}}')
        self.assertEqual(send_push('unit-token', 'Harvest', 'Check field', {'screen': 'calendar', 'zone_id': 7}), ('ticket-1', None))
        request = urlopen.call_args.args[0]
        payload = json.loads(request.data)
        self.assertEqual(payload['data'], {'screen': 'calendar', 'zone_id': 7})
        self.assertEqual(payload['channelId'], 'farm-alerts')
        self.assertEqual(payload['to'], 'unit-token')
        self.assertEqual(request.get_header('Authorization'), 'Bearer test-access')
        self.assertEqual(urlopen.call_args.kwargs['timeout'], 20)

    @patch('app.services.push_worker.urlopen')
    def test_expo_rejection_returns_error_instead_of_success(self, urlopen):
        urlopen.return_value.__enter__.return_value = io.BytesIO(b'{"data":{"status":"error","details":{"error":"MessageTooBig"}}}')
        self.assertEqual(send_push('unit-token', 'Title', 'Body', {}), (None, 'MessageTooBig'))

    @patch('app.services.push_worker.send_push', return_value=(None, 'MessageTooBig'))
    @patch('builtins.print')
    def test_rejected_message_keeps_device_and_delivery_retryable(self, quiet, send):
        db = Mock()
        db.rpc.return_value.execute.return_value.data = True
        deliver(db, {'token': 'unit-token'}, 'key', 'Title', 'Body', {})
        db.table.assert_not_called()

import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock, patch
from app.services.push_worker import moisture_alert, deliver


class MoistureTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 10, 30, 10, tzinfo=timezone.utc)

    def reading(self, value, age=0):
        return {'soil_moisture': value, 'created_at': (self.now - timedelta(minutes=age)).isoformat()}

    def test_soil_specific_thresholds(self):
        self.assertEqual(moisture_alert(self.reading(14), 'Loam', self.now), 'low')
        self.assertEqual(moisture_alert(self.reading(33), 'Loam', self.now), 'high')
        for value in [15, 25, 32]:
            self.assertIsNone(moisture_alert(self.reading(value), 'Loam', self.now))
        self.assertEqual(moisture_alert(self.reading(21), 'Sand', self.now), 'high')
        self.assertIsNone(moisture_alert(self.reading(70), 'unknown', self.now))

    def test_missing_invalid_and_stale_readings_never_alert(self):
        for value in [None, '', True, 'bad', -1, 101, float('nan')]:
            self.assertIsNone(moisture_alert(self.reading(value), 'Loam', self.now))
        for age in [61, -1]:
            self.assertIsNone(moisture_alert(self.reading(0, age), 'Loam', self.now))

    @patch('app.services.push_worker.send_push')
    def test_duplicate_claim_never_sends(self, send):
        db = Mock()
        db.rpc.return_value.execute.return_value.data = False
        deliver(db, {'token': 'test'}, 'same-key', 'title', 'body', {})
        send.assert_not_called()

    @patch('app.services.push_worker.send_push', return_value=('ticket-123', None))
    def test_success_is_acknowledged(self, send):
        db = Mock()
        db.rpc.return_value.execute.return_value.data = True
        deliver(db, {'token': 'test'}, 'key', 'title', 'body', {})
        db.table.return_value.update.assert_called_once_with({'sent': True, 'ticket_id': 'ticket-123'})

    @patch('app.services.push_worker.send_push', side_effect=TimeoutError)
    def test_network_failure_keeps_lease_retryable(self, send):
        db = Mock()
        db.rpc.return_value.execute.return_value.data = True
        deliver(db, {'token': 'test'}, 'key', 'title', 'body', {})
        db.table.return_value.update.assert_not_called()


if __name__ == '__main__':
    unittest.main()

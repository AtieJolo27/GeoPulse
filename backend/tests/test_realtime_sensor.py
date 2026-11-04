import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi import HTTPException
from app.services.realtime_sensor import latest_sensor_reading


class RealtimeSensorTests(unittest.TestCase):
    def database(self, zones, readings):
        database = MagicMock()
        queries = {}
        for name, rows in [('zones', zones), ('sensor_readings', readings)]:
            query = MagicMock()
            for method in ('select', 'eq', 'order', 'limit'):
                getattr(query, method).return_value = query
            query.execute.return_value = SimpleNamespace(data=rows)
            queries[name] = query
        database.table.side_effect = queries.__getitem__
        return database, queries

    def test_explicit_zone_is_checked_before_reading(self):
        database, queries = self.database([], [])
        with self.assertRaises(HTTPException) as error:
            latest_sensor_reading(database, 8, 27)
        self.assertEqual(error.exception.status_code, 404)
        queries['zones'].eq.assert_any_call('farm_id', 8)
        database.table.assert_called_once_with('zones')

    @patch('app.services.realtime_sensor.get_sensor_zone', return_value={'id': 23})
    def test_defaults_to_assigned_zone(self, assignment):
        reading = {'id': 10, 'zone_id': 23, 'nitrogen': 25}
        database, queries = self.database([], [reading])
        self.assertEqual(latest_sensor_reading(database, 8), {'zone_id': 23, 'data': reading})
        assignment.assert_called_once_with(database, 8)
        queries['sensor_readings'].eq.assert_called_once_with('zone_id', 23)
        queries['sensor_readings'].order.assert_any_call('created_at', desc=True, nullsfirst=False)
        queries['sensor_readings'].order.assert_any_call('id', desc=True)
        queries['sensor_readings'].limit.assert_called_once_with(1)

    @patch('app.services.realtime_sensor.get_sensor_zone', return_value=None)
    def test_missing_assignment(self, assignment):
        database, _ = self.database([], [])
        with self.assertRaises(HTTPException) as error:
            latest_sensor_reading(database, 8)
        self.assertEqual(error.exception.status_code, 409)
        database.table.assert_not_called()

    def test_zone_without_readings_returns_null(self):
        database, _ = self.database([{'id': 23}], [])
        self.assertEqual(latest_sensor_reading(database, 8, 23), {'zone_id': 23, 'data': None})


if __name__ == '__main__':
    unittest.main()

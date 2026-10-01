import unittest
from types import SimpleNamespace
from unittest.mock import Mock
from app.services.zone_recommendations import recommend_for_zone, FIELDS


class Database:
    def __init__(self, rows):
        self.rows = rows

    def table(self, name):
        return Query(self.rows[name])


class Query:
    def __init__(self, rows):
        self.rows = list(rows)
        self.orders = []

    def select(self, _):
        return self

    def eq(self, field, value):
        self.rows = [row for row in self.rows if row.get(field) == value]
        return self

    def order(self, field, desc=False):
        self.orders.append((field, desc))
        return self

    def limit(self, count):
        for field, desc in reversed(self.orders):
            self.rows.sort(key=lambda row: row[field], reverse=desc)
        self.rows = self.rows[:count]
        return self

    def execute(self):
        return SimpleNamespace(data=self.rows)


class ZoneRecommendationsTest(unittest.TestCase):
    def setUp(self):
        self.zone = {'id': 1, 'farm_id': 7, 'current_crop': 'rice'}
        self.reading = {**dict.fromkeys(FIELDS, 5), 'id': 1, 'zone_id': 1, 'created_at': '2026-10-01'}
        self.crop = Mock(return_value={'best_crop': 'corn', 'recommendations': []})
        self.fertilizer = Mock(return_value={'recommendations': []})

    def run_prediction(self, readings):
        return recommend_for_zone(Database({'zones': [self.zone], 'sensor_readings': readings}), 1, 7, self.crop, self.fertilizer)

    def test_latest_in_selected_zone_and_planted_crop(self):
        result = self.run_prediction([self.reading, {**self.reading, 'id': 2, 'nitrogen': 12}, {**self.reading, 'zone_id': 2, 'id': 3}])
        self.assertEqual(result['reading']['id'], 2)
        self.assertEqual(self.crop.call_args.args[0]['nitrogen'], 12)
        self.assertEqual(self.fertilizer.call_args.args[1], 'rice')

    def test_missing_zone_readings_never_fall_back(self):
        result = self.run_prediction([{**self.reading, 'zone_id': 2}])
        self.assertIsNone(result['reading'])
        self.crop.assert_not_called()

    def test_incomplete_latest_does_not_use_old_reading(self):
        with self.assertRaises(ValueError):
            self.run_prediction([self.reading, {**self.reading, 'id': 2, 'ph': None}])
        self.crop.assert_not_called()

    def test_no_planted_crop_labels_predicted_context(self):
        self.zone['current_crop'] = None
        result = self.run_prediction([self.reading])
        self.assertEqual(result['fertilizer_crop_source'], 'predicted')
        self.assertEqual(self.fertilizer.call_args.args[1], 'corn')

    def test_unsupported_planted_crop_keeps_crop_result(self):
        self.fertilizer.side_effect = ValueError('unknown label')
        result = self.run_prediction([self.reading])
        self.assertIsNotNone(result['crop'])
        self.assertIsNone(result['fertilizer'])
        self.assertTrue(result['fertilizer_error'])

    def test_other_farm_cannot_be_requested(self):
        self.zone['farm_id'] = 8
        with self.assertRaises(ValueError):
            self.run_prediction([self.reading])


if __name__ == '__main__':
    unittest.main()

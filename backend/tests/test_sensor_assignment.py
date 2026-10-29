import unittest
from types import SimpleNamespace
from fastapi import HTTPException
from app.services.sensor_assignment import get_sensor_zone, assign_sensor_zone, prepare_sensor_reading


class Database:
    def __init__(self):
        self.rows = {'zones': [{'id': 23, 'farm_id': 8}, {'id': 27, 'farm_id': 3}],
                     'farm_sensor_assignments': []}

    def table(self, name):
        return Query(self.rows[name])


class Query:
    def __init__(self, rows):
        self.source = rows
        self.rows = list(rows)

    def select(self, _):
        return self

    def eq(self, field, value):
        self.rows = [row for row in self.rows if row.get(field) == value]
        return self

    def limit(self, count):
        self.rows = self.rows[:count]
        return self

    def upsert(self, value, on_conflict):
        self.source[:] = [row for row in self.source if row[on_conflict] != value[on_conflict]] + [value]
        return self

    def execute(self):
        return SimpleNamespace(data=self.rows)


class AssignmentTests(unittest.TestCase):
    def test_new_reading_uses_collection_assignment_without_mutating_input(self):
        db = Database()
        assign_sensor_zone(db, 8, 23)
        reading = {'nitrogen': 20}
        self.assertEqual(prepare_sensor_reading(db, 8, reading)['zone_id'], 23)
        self.assertNotIn('zone_id', reading)

    def test_reading_without_known_collection_zone_is_rejected(self):
        with self.assertRaises(HTTPException) as error:
            prepare_sensor_reading(Database(), 8, {'nitrogen': 20})
        self.assertEqual(error.exception.status_code, 409)

    def test_explicit_collection_zone_is_validated(self):
        db = Database()
        self.assertEqual(prepare_sensor_reading(db, 8, {'zone_id': 23})['zone_id'], 23)
        with self.assertRaises(HTTPException):
            prepare_sensor_reading(db, 8, {'zone_id': 27})

    def test_unassigned_is_explicit(self):
        self.assertIsNone(get_sensor_zone(Database(), 8))

    def test_assignment_survives_separate_reads(self):
        db = Database()
        assign_sensor_zone(db, 8, 23)
        self.assertEqual(get_sensor_zone(db, 8)['id'], 23)
        self.assertIsNone(get_sensor_zone(db, 3))

    def test_other_farm_cannot_be_assigned(self):
        db = Database()
        with self.assertRaises(HTTPException) as error:
            assign_sensor_zone(db, 8, 27)
        self.assertEqual(error.exception.status_code, 404)
        self.assertEqual(db.rows['farm_sensor_assignments'], [])

    def test_deleted_or_moved_zone_is_not_returned(self):
        db = Database()
        db.rows['farm_sensor_assignments'] = [{'farm_id': 8, 'zone_id': 27}]
        self.assertIsNone(get_sensor_zone(db, 8))

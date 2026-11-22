"""Partial automated evidence for TC-04/TC-05/TC-08; no live DB or hardware."""
import importlib
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch
from fastapi.testclient import TestClient


class SensorScenarioContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # App construction must not create a live DB client or load unrelated models.
        with patch('supabase.create_client', return_value=Mock()), patch('joblib.load', return_value=Mock()):
            cls.main = importlib.import_module('app.main')
        cls.client = TestClient(cls.main.app)

    def setUp(self):
        self.reading = {'soil_moisture': 25.5, 'soil_temperature': 26.5,
                        'air_temperature': 28.0, 'humidity': 70.0, 'ph': 6.5,
                        'nitrogen': 20, 'phosphorus': 30, 'potassium': 138, 'zone_id': 7}

    def test_tc04_valid_sensor_post_returns_201_and_saved_row(self):
        saved = {'id': 101, **self.reading}
        with patch.object(self.main, 'save_sensor_data', return_value=SimpleNamespace(data=[saved])) as save:
            response = self.client.post('/sensor/realtime', json=self.reading)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['data'], saved)
        self.assertEqual(save.call_args.args[0], self.reading)
        # K is already adjusted at device side in this fixture. This does not test firmware scaling.
        self.assertEqual(save.call_args.args[0]['potassium'], 138)

    def test_tc04_missing_required_parameter_returns_422_without_saving(self):
        del self.reading['ph']
        with patch.object(self.main, 'save_sensor_data') as save:
            response = self.client.post('/sensor/realtime', json=self.reading)
        self.assertEqual(response.status_code, 422)
        save.assert_not_called()

    def test_tc05_retrieve_contract_preserves_saved_sensor_fields(self):
        saved = {'id': 101, **self.reading}
        with patch.object(self.main, 'get_default_farm_id', return_value=1), patch.object(self.main, 'latest_sensor_reading', return_value={'zone_id': 7, 'data': saved}) as latest:
            response = self.client.get('/sensor/realtime?zone_id=7')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['data'], saved)
        self.assertEqual(response.headers['cache-control'], 'no-store')
        self.assertEqual(latest.call_args.args[1:], (1, 7))

    def test_tc08_storage_failure_returns_controlled_error(self):
        with patch.object(self.main, 'save_sensor_data', side_effect=RuntimeError('simulated outage')):
            response = self.client.post('/sensor/realtime', json=self.reading)
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json()['detail'], 'Unable to save sensor reading')


class CropPredictionScenarioTests(unittest.TestCase):
    def test_tc07_known_input_returns_highest_probability_crop(self):
        from app.machine_learning.predict import predict_crop
        model = Mock()
        model.classes_ = ['rice', 'corn', 'garlic']
        model.predict_proba.return_value = [[0.2, 0.7, 0.1]]
        reading = {'soil_moisture': 25, 'soil_temperature': 26, 'air_temperature': 28,
                   'humidity': 70, 'ph': 6.5, 'nitrogen': 20, 'phosphorus': 30, 'potassium': 138}
        with patch('app.machine_learning.predict.load_model', return_value=model):
            result = predict_crop(reading)
        self.assertEqual(result['best_crop'], 'corn')
        self.assertEqual(result['best_confidence'], 70)
        self.assertEqual([row['crop'] for row in result['recommendations']], ['corn', 'rice', 'garlic'])
        self.assertEqual(model.predict_proba.call_args.args[0].tolist(), [[25, 26, 28, 70, 6.5, 20, 30, 138]])

import unittest
from unittest.mock import patch
from app.machine_learning.predict import load_model, MODEL_PATH


class CropModelCacheTests(unittest.TestCase):
    def tearDown(self):
        load_model.cache_clear()

    def test_repeated_predictions_share_loaded_model(self):
        load_model.cache_clear()
        with patch('app.machine_learning.predict.joblib.load') as read:
            self.assertIs(load_model(), load_model())
            read.assert_called_once_with(MODEL_PATH)

    def test_failed_load_can_retry(self):
        load_model.cache_clear()
        model = object()
        with patch('app.machine_learning.predict.joblib.load', side_effect=[OSError('temporary failure'), model]):
            with self.assertRaises(OSError):
                load_model()
            self.assertIs(load_model(), model)

import unittest
from app.services.fertilizer_evidence import attach_fertilizer_evidence
from app.services.nutrient_recommendations import assess_nutrients, recommend_for_unplanted_soil


class FertilizerEvidenceTest(unittest.TestCase):
    def test_aliases_match_actual_dataset(self):
        result = attach_fertilizer_evidence({'recommendations': [
            {'fertilizer': 'Urea (46-0-0)'},
            {'fertilizer': 'Muriate of potash (0-0-60)'},
        ]})
        self.assertTrue(all(row['in_dataset'] for row in result['recommendations']))

    def test_outside_dataset_has_relevant_citation(self):
        result = attach_fertilizer_evidence(recommend_for_unplanted_soil(
            assess_nutrients({'nitrogen': 30, 'phosphorus': 0, 'potassium': 30})))
        row = result['recommendations'][0]
        self.assertFalse(row['in_dataset'])
        self.assertEqual(row['evidence_basis'], 'external_reference')
        self.assertEqual(row['sources'][0]['publisher'], 'University of Minnesota Extension')
        self.assertTrue(row['sources'][0]['url'].endswith('understanding-phosphorus-fertilizers'))
        self.assertNotIn('confidence', row)

    def test_unknown_outside_dataset_without_evidence_is_excluded(self):
        result = attach_fertilizer_evidence({'recommendations': [{'fertilizer': 'Unknown product'}]})
        self.assertEqual(result['recommendations'], [])

    def test_dataset_products_are_preserved(self):
        result = attach_fertilizer_evidence({'recommendations': [
            {'fertilizer': 'Balanced NPK (14-14-14)', 'confidence': 70},
        ]})
        self.assertEqual(result['recommendations'][0]['confidence'], 70)
        self.assertTrue(result['recommendations'][0]['in_dataset'])

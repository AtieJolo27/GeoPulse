"""Reviewed references for fertilizer identity and nutrient content.

References support nutrient-source selection, not app ppm targets or field doses.
No live search or AI-generated URLs are used in API requests.
"""
import csv
from functools import lru_cache
from pathlib import Path

DATASET = Path(__file__).resolve().parents[1] / 'machine_learning/datasets/crop_fertilizer_recommendation_dataset.csv'
BASE = 'https://extension.umn.edu/agriculture/crop-production/nutrient-management-for-minnesota-crops/'
CATALOG = {
    'urea': {
        'aliases': ('urea (46-0-0)', 'urea (nitrogen rich fertilizer)'),
        'source': {'title': 'Fertilizer urea', 'publisher': 'University of Minnesota Extension',
                   'url': BASE + 'fertilizer-urea', 'supports': 'Urea supplies nitrogen and contains 46% N.'},
    },
    'mop': {
        'aliases': ('muriate of potash (0-0-60)', 'mop (muriate of potash)'),
        'source': {'title': 'Potassium for crop production', 'publisher': 'University of Minnesota Extension',
                   'url': BASE + 'potassium-for-crop-production',
                   'supports': 'Potassium chloride is a potassium source, typically containing 60-62% K2O.'},
    },
    'superphosphate': {
        'aliases': ('single superphosphate (0-18-0)', 'single superphosphate (check product grade)'),
        'source': {'title': 'Understanding phosphorus fertilizers', 'publisher': 'University of Minnesota Extension',
                   'url': BASE + 'understanding-phosphorus-fertilizers',
                   'supports': 'Ordinary superphosphate supplies phosphorus without nitrogen; the table lists 20% available P2O5. Check the actual product grade.'},
    },
}


def identity(name):
    normalized = name.strip().casefold()
    return next((key for key, item in CATALOG.items() if normalized in item['aliases']), normalized)


@lru_cache(maxsize=1)
def dataset_identities():
    with DATASET.open(encoding='utf-8-sig', newline='') as handle:
        return frozenset(identity(row['fertilizer']) for row in csv.DictReader(handle))


def attach_fertilizer_evidence(result):
    """Exclude outside-dataset suggestions unless reviewed evidence is available."""
    dataset = dataset_identities()
    verified = []
    for row in result['recommendations']:
        key = identity(row['fertilizer'])
        in_dataset = key in dataset
        reference = CATALOG.get(key, {}).get('source')
        if not in_dataset and not reference:
            continue
        verified.append({**row, 'in_dataset': in_dataset,
                         'evidence_basis': 'dataset' if in_dataset else 'external_reference',
                         'sources': [dict(reference)] if reference else []})
    return {**result, 'recommendations': verified}

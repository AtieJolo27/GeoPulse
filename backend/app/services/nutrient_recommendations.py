"""Provisional app targets, matching lib/soilHealthScore.ts; not lab-calibrated ideals."""
REFERENCE_BANDS = {
    'nitrogen': (20, 100),
    'phosphorus': (15, 80),
    'potassium': (15, 55),
}
SOURCES = {
    'nitrogen': 'Urea (46-0-0)',
    'phosphorus': 'Single superphosphate (check product grade)',
    'potassium': 'Muriate of potash (0-0-60)',
}


def assess_nutrients(values):
    return [
        {'nutrient': key, 'current_ppm': values[key], 'min_ppm': low,
         'max_ppm': high, 'gap_ppm': max(0, low - values[key]),
         'status': 'low' if values[key] < low else 'high' if values[key] > high else 'within'}
        for key, (low, high) in REFERENCE_BANDS.items()
    ]


def recommend_for_unplanted_soil(assessment):
    # Separate nutrient sources avoid adding another N/P/K nutrient that is
    # already within or above its band. No dose can be inferred from sensor ppm.
    recommendations = [
        {'fertilizer': SOURCES[item['nutrient']], 'nutrient': item['nutrient'],
         'gap_ppm': item['gap_ppm']}
        for item in assessment if item['status'] == 'low'
    ]
    return {'basis': 'nutrient_deficit', 'recommendations': recommendations}

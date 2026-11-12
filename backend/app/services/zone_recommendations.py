import math
from app.services.fertilizer_evidence import attach_fertilizer_evidence
from app.services.nutrient_recommendations import assess_nutrients, recommend_for_unplanted_soil


FIELDS = ('soil_moisture', 'soil_temperature', 'air_temperature', 'humidity',
          'ph', 'nitrogen', 'phosphorus', 'potassium')


def recommend_for_zone(database, zone_id, farm_id, crop_model, fertilizer_model):
    zone = database.table('zones').select('*').eq('id', zone_id).eq('farm_id', farm_id).limit(1).execute().data
    if not zone:
        raise ValueError('Zone not found')
    readings = (database.table('sensor_readings').select('*').eq('zone_id', zone_id)
                .order('created_at', desc=True).order('id', desc=True).limit(1).execute().data)
    if not readings:
        return {'zone_id': zone_id, 'reading': None, 'crop': None, 'fertilizer': None}
    reading = readings[0]
    # Fail on incomplete latest data rather than silently using an older reading.
    values = {}
    for field in FIELDS:
        raw = reading.get(field)
        try:
            value = float(raw)
        except (TypeError, ValueError):
            raise ValueError(f'Latest reading is missing a valid {field}')
        if isinstance(raw, bool) or not math.isfinite(value):
            raise ValueError(f'Latest reading is missing a valid {field}')
        if field in ('soil_moisture', 'humidity') and not 0 <= value <= 100:
            raise ValueError(f'Latest reading has invalid {field}')
        if field == 'ph' and not 0 <= value <= 14:
            raise ValueError('Latest reading has invalid ph')
        if field in ('nitrogen', 'phosphorus', 'potassium') and value < 0:
            raise ValueError(f'Latest reading has invalid {field}')
        values[field] = value
    crop = crop_model(values)
    planted_crop = zone[0].get('current_crop')
    crop_context = planted_crop.strip() if isinstance(planted_crop, str) else ''
    fertilizer = None
    nutrient_assessment = assess_nutrients(values)
    fertilizer_error = None
    if crop_context:
        try:
            fertilizer = fertilizer_model(values, crop_context)
            fertilizer_error = None
        except ValueError:
            fertilizer_error = 'The fertilizer model cannot evaluate the currently planted crop.'
    else:
        fertilizer = recommend_for_unplanted_soil(nutrient_assessment)
    if fertilizer is not None:
        fertilizer = attach_fertilizer_evidence(fertilizer)
    return {'zone_id': zone_id, 'reading': reading, 'crop': crop,
            'fertilizer': fertilizer, 'fertilizer_error': fertilizer_error,
            'fertilizer_crop': crop_context,
            'fertilizer_crop_source': 'planted' if crop_context else 'soil_targets',
            'nutrient_assessment': nutrient_assessment,
            'nutrient_target_basis': 'provisional_app_reference_bands'}

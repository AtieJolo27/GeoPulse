from fastapi import HTTPException

from app.services.sensor_assignment import get_sensor_zone


def latest_sensor_reading(database, farm_id, zone_id=None):
    if zone_id is None:
        zone = get_sensor_zone(database, farm_id)
        if zone is None:
            raise HTTPException(status_code=409, detail='Assign the sensor to a collection zone first')
    else:
        zones = (database.table('zones').select('id').eq('farm_id', farm_id)
                 .eq('id', zone_id).limit(1).execute()).data
        if not zones:
            raise HTTPException(status_code=404, detail='Zone not found in this farm')
        zone = zones[0]

    readings = (database.table('sensor_readings').select('*').eq('zone_id', zone['id'])
                .order('created_at', desc=True, nullsfirst=False)
                .order('id', desc=True).limit(1).execute()).data
    return {'zone_id': zone['id'], 'data': readings[0] if readings else None}

from fastapi import HTTPException
from postgrest.exceptions import APIError


def get_sensor_zone(database, farm_id):
    assignments = (database.table('farm_sensor_assignments').select('zone_id')
                   .eq('farm_id', farm_id).limit(1).execute()).data
    if not assignments:
        return None
    zones = (database.table('zones').select('*').eq('farm_id', farm_id)
             .eq('id', assignments[0]['zone_id']).limit(1).execute()).data
    return zones[0] if zones else None


def assign_sensor_zone(database, farm_id, zone_id):
    zones = (database.table('zones').select('*').eq('farm_id', farm_id)
             .eq('id', zone_id).limit(1).execute()).data
    if not zones:
        raise HTTPException(status_code=404, detail='Zone not found in this farm')
    try:
        database.table('farm_sensor_assignments').upsert({
            'farm_id': farm_id, 'zone_id': zone_id,
        }, on_conflict='farm_id').execute()
    except APIError as exc:
        if exc.code == 'P0001' and 'Finish the active sensor attempt before relocating' in exc.message:
            raise HTTPException(status_code=409, detail='Finish the active soil test before moving the sensor to another zone.') from exc
        raise
    return zones[0]


def prepare_sensor_reading(database, farm_id, reading):
    """Attach the collection zone before insertion; never rewrite historical rows."""
    zone_id = reading.get('zone_id')
    if zone_id is None:
        zone = get_sensor_zone(database, farm_id)
        if zone is None:
            raise HTTPException(status_code=409, detail='Assign the sensor to its collection zone before saving readings')
        zone_id = zone['id']
    else:
        zones = (database.table('zones').select('id').eq('farm_id', farm_id)
                 .eq('id', zone_id).limit(1).execute()).data
        if not zones:
            raise HTTPException(status_code=404, detail='Collection zone not found in this farm')
    return {**reading, 'zone_id': zone_id}

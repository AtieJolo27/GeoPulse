"""Run every minute: python -m app.services.push_worker (from backend/)."""
import json
import math
import os
from datetime import datetime, timedelta, timezone
from urllib.request import Request, urlopen

# Keep aligned with lib/soilTypeRanges.ts, including the default dashboard band.
MOISTURE_LIMITS = {
    'sand': (8, 20), 'sandy': (8, 20), 'sandy loam': (12, 28),
    'loam': (15, 32), 'clay loam': (20, 38), 'clay': (25, 45),
    'volcanic loam': (15, 33),
}


def moisture_alert(reading, soil_type, now):
    raw = reading.get('soil_moisture')
    if raw is None or isinstance(raw, bool) or str(raw).strip() == '':
        return None
    try:
        value = float(raw)
        stamp = datetime.fromisoformat(reading['created_at'].replace('Z', '+00:00'))
    except (ValueError, TypeError, KeyError):
        return None
    if not math.isfinite(value) or not 0 <= value <= 100 or stamp.tzinfo is None:
        return None
    if not timedelta(0) <= now - stamp <= timedelta(hours=1):
        return None
    low, high = MOISTURE_LIMITS.get((soil_type or '').strip().lower(), (60, 85))
    return ('low' if value < low else 'high' if value > high else None)


def send_push(token, title, body, data):
    headers = {'Content-Type': 'application/json', 'Accept': 'application/json'}
    access_token = os.getenv('EXPO_ACCESS_TOKEN')
    if access_token:
        headers['Authorization'] = f'Bearer {access_token}'
    request = Request('https://exp.host/--/api/v2/push/send', headers=headers,
                      data=json.dumps({'to': token, 'title': title, 'body': body,
                                       'sound': 'default', 'channelId': 'farm-alerts', 'data': data}).encode())
    with urlopen(request, timeout=20) as response:
        ticket = json.load(response)['data']
    if ticket.get('status') != 'ok':
        return None, ticket.get('details', {}).get('error', 'PushRejected')
    return ticket.get('id'), None


def deliver(db, device, key, title, body, data):
    # Lease stops concurrent cron runs sending the same notification.
    if not db.rpc('claim_push_delivery', {'p_key': key}).execute().data:
        return
    try:
        ticket, error = send_push(device['token'], title, body, data)
        if error == 'DeviceNotRegistered':
            db.table('push_devices').delete().eq('token', device['token']).execute()
        if error:
            raise RuntimeError(error)
        db.table('push_deliveries').update({'sent': True, 'ticket_id': ticket}).eq('delivery_key', key).execute()
    except Exception as exc:
        # Retry after lease expiry. Never log a device token or notification body.
        print('Push delivery failed:', type(exc).__name__)


def run(db, now=None):
    now = now or datetime.now(timezone.utc)
    devices = db.table('push_devices').select('*').execute().data
    events = db.table('crop_events').select('*').eq('completed', False).lte('notify_at', now.isoformat()).gte('notify_at', (now - timedelta(days=1)).isoformat()).execute().data
    zones = {z['id']: z for z in db.table('zones').select('id,current_crop,planted_on,name_en,name_tl,soil_type').execute().data}
    subscriptions = db.table('push_zone_subscriptions').select('*').execute().data
    for device in devices:
        tl = device['language'] == 'tagalog'
        for event in events:
            zone = zones.get(event['zone_id'])
            # Old crop cycles must not trigger reminders after replanting.
            if event['user_id'] != device['user_id'] or not zone or zone['current_crop'] != event['crop'] or zone.get('planted_on') != event['planted_on']:
                continue
            title = ('Araw ng ani' if tl else 'Harvest reminder') if event['kind'] == 'harvest' else ('Paalala sa pataba' if tl else 'Fertilizer reminder')
            body = f"{zone.get('name_tl' if tl else 'name_en') or zone['id']} · {event['crop']} · {event['event_date']}. "
            body += ('Suriin ang pananim bago kumilos.' if tl else 'Check crop readiness and field conditions before acting.')
            deliver(db, device, f"event:{event['id']}:{event['notify_at']}:{device['token']}", title, body, {'screen': 'calendar', 'zone_id': zone['id']})
    for subscription in subscriptions:
        zone = zones.get(subscription['zone_id'])
        if not zone:
            continue
        readings = db.table('sensor_readings').select('soil_moisture,created_at').eq('zone_id', zone['id']).order('created_at', desc=True).limit(1).execute().data
        condition = moisture_alert(readings[0], zone.get('soil_type'), now) if readings else None
        if not condition:
            continue
        for device in devices:
            if device['user_id'] != subscription['user_id']:
                continue
            tl = device['language'] == 'tagalog'
            title = 'Alerto sa moisture' if tl else 'Soil moisture alert'
            body = f"{zone.get('name_tl' if tl else 'name_en') or zone['id']}: {readings[0]['soil_moisture']}% VWC ({condition}). "
            body += 'Suriin ang lupa at drainage.' if tl else 'Check soil and drainage before adjusting irrigation.'
            # At most one alert for each condition per zone/device/hour.
            key = f"moisture:{zone['id']}:{condition}:{now.strftime('%Y-%m-%dT%H')}:{device['token']}"
            deliver(db, device, key, title, body, {'screen': 'notifications', 'zone_id': zone['id']})


if __name__ == '__main__':
    from app.database.supabase import supabase
    run(supabase)

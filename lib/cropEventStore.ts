import type { SupabaseClient } from '@supabase/supabase-js';
import type { CropEvent } from './cropCalendar';

export type EventInput = Omit<CropEvent, 'id' | 'completed'>;
export type CalendarData = { events: CropEvent[]; deviceOnly: boolean };
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function missingCalendarTable(error: { code?: string; message?: string } | null) {
  return !!error && (error.code === 'PGRST205' || error.code === '42P01') && /crop_events/.test(error.message ?? '');
}

export function createCropEventStore(db: SupabaseClient, storage: StorageLike, userId: string, zoneId: number) {
  const key = `geopulse_calendar_pending:${userId}:${zoneId}`;
  const read = (): CropEvent[] => {
    const raw = storage.getItem(key);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error();
      return parsed;
    } catch { throw new Error('Saved calendar data could not be read on this device.'); }
  };
  const write = (events: CropEvent[]) => {
    storage.setItem(key, JSON.stringify(events));
  };
  const query = () => db.from('crop_events').select('*').eq('user_id', userId).eq('zone_id', zoneId).order('event_date');
  const same = (a: CropEvent | EventInput, b: CropEvent | EventInput) => a.crop === b.crop && a.planted_on === b.planted_on && a.kind === b.kind && a.event_date === b.event_date;
  const scoped = (rows: EventInput[]) => rows.every(row => row.user_id === userId && row.zone_id === zoneId);
  const load = async (): Promise<CalendarData> => {
    const { data, error } = await query();
    if (missingCalendarTable(error)) return { events: read().sort((a, b) => a.event_date.localeCompare(b.event_date)), deviceOnly: true };
    if (error) throw new Error(error.message);
    const pending = read();
    if (pending.length) {
      // Local rows acquire server UUIDs when the migration becomes available.
      const rows = pending.map(({ id, ...event }) => id.startsWith('local-') ? event : { id, ...event });
      const sync = await db.from('crop_events').upsert(rows, { onConflict: 'user_id,zone_id,crop,planted_on,kind,event_date' });
      if (sync.error) throw new Error(`Dates are safe on this device, but sync failed: ${sync.error.message}`);
      const refreshed = await query();
      if (refreshed.error) throw new Error(refreshed.error.message);
      storage.removeItem(key);
      return { events: refreshed.data ?? [], deviceOnly: false };
    }
    return { events: data ?? [], deviceOnly: false };
  };
  return {
    load,
    async save(rows: EventInput[], editing: CropEvent | null): Promise<CalendarData> {
      if (!scoped(rows)) throw new Error('Calendar dates belong to a different account or zone.');
      if (editing?.id.startsWith('local-')) {
        const pending = read();
        if (pending.some(event => event.id !== editing.id && same(event, rows[0]))) throw new Error('A task already exists on this date.');
        write(pending.map(event => event.id === editing.id ? { ...event, ...rows[0] } : event));
        return load();
      }
      const result = editing
        ? await db.from('crop_events').update(rows[0]).eq('id', editing.id).eq('user_id', userId)
        : await db.from('crop_events').upsert(rows, { onConflict: 'user_id,zone_id,crop,planted_on,kind,event_date', ignoreDuplicates: true });
      if (missingCalendarTable(result.error)) {
        let pending = read();
        for (const row of rows) {
          if (editing) pending = [...pending.filter(event => event.id !== editing.id), { ...editing, ...row }];
          else if (!pending.some(event => same(event, row))) pending.push({ ...row, id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`, completed: false });
        }
        write(pending);
      } else if (result.error) throw new Error(result.error.message);
      return load();
    },
    async complete(event: CropEvent) {
      if (event.id.startsWith('local-')) write(read().map(item => item.id === event.id ? { ...item, completed: !item.completed } : item));
      else {
        const { error } = await db.from('crop_events').update({ completed: !event.completed }).eq('id', event.id).eq('user_id', userId);
        if (error) throw new Error(error.message);
      }
      return load();
    },
    async remove(event: CropEvent) {
      if (event.id.startsWith('local-')) write(read().filter(item => item.id !== event.id));
      else {
        const { error } = await db.from('crop_events').delete().eq('id', event.id).eq('user_id', userId);
        if (error) throw new Error(error.message);
      }
      return load();
    },
  };
}

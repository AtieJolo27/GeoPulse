import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useApp } from '@/shared/appLib/AppContext';
import { supabase } from '@/lib/supabaseClient';
import { sensorConnectionFromReading, type SensorConnection } from '@/lib/sensorConnection';

type Snapshot = { zoneId: number | null; timestamp: string | null; status: SensorConnection };
const SensorConnectionContext = createContext<Snapshot>({ zoneId: null, timestamp: null, status: 'checking' });

export function SensorConnectionProvider({ children }: { children: ReactNode }) {
  const { sensorZoneId, sensorZoneLoading, user } = useApp();
  const [snapshot, setSnapshot] = useState<Snapshot>({ zoneId: null, timestamp: null, status: 'checking' });
  useEffect(() => {
    if (!user || sensorZoneLoading) return;
    let disposed = false;
    let controller: AbortController | null = null;
    const refresh = async () => {
      if (disposed || controller || (AppState.currentState && AppState.currentState !== 'active')) return;
      if (sensorZoneId === null) {
        setSnapshot({ zoneId: null, timestamp: null, status: 'unknown' });
        return;
      }
      const request = new AbortController();
      controller = request;
      const timeout = setTimeout(() => request.abort(), 12000);
      try {
        const { data, error } = await supabase.from('sensor_readings').select('created_at')
          .eq('zone_id', sensorZoneId).order('created_at', { ascending: false, nullsFirst: false })
          .order('id', { ascending: false }).limit(1).abortSignal(request.signal).maybeSingle();
        if (error) throw error;
        const timestamp = data?.created_at ?? null;
        if (!disposed) setSnapshot({ zoneId: sensorZoneId, timestamp, status: sensorConnectionFromReading(timestamp, Date.now()) });
      } catch {
        if (!disposed) setSnapshot(previous => ({ zoneId: sensorZoneId, timestamp: previous.zoneId === sensorZoneId ? previous.timestamp : null, status: 'unknown' }));
      } finally {
        clearTimeout(timeout);
        controller = null;
      }
    };
    const initial = setTimeout(() => { void refresh(); }, 0);
    const timer = setInterval(() => { void refresh(); }, 10000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { disposed = true; clearTimeout(initial); clearInterval(timer); listener.remove(); controller?.abort(); };
  }, [sensorZoneId, sensorZoneLoading, user]);
  const current: Snapshot = sensorZoneLoading || snapshot.zoneId !== sensorZoneId
    ? { zoneId: sensorZoneId, timestamp: null, status: 'checking' }
    : snapshot;
  return <SensorConnectionContext.Provider value={current}>{children}</SensorConnectionContext.Provider>;
}

export const useSensorConnection = () => useContext(SensorConnectionContext);

import { validPlantingDate } from '@/lib/plantingDate';
import { backendRequest } from '@/lib/backendRequest';
import { supabase } from '@/lib/supabaseClient';
import { disablePushNotifications } from '@/lib/pushNotifications';
import { User } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
type Language = 'english' | 'tagalog';
type FontSize = 'small' | 'medium' | 'large';

interface Zone {
  id: number;
  name_en: string;
  name_tl: string;
  soil_type: string;
  current_crop: string | null;
  planted_on?: string | null;
  updated_at: string | null;
}

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://capstone-eem0.onrender.com';

interface AppContextType {
  theme: Theme;
  toggleTheme: () => void;
  isDarkMode: boolean;
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (en: string, tl: string) => string;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  fontScale: number;

  zones: Zone[];
  zonesLoading: boolean;
  zonesError: string | null;
  sensorZoneError: string | null;
  retryZoneLoading: () => Promise<void>;
  activeZoneId: number | null;
  sensorZoneId: number | null;
  assignSensorToZone: (zoneId: number) => Promise<void>;
  setActiveZoneId: (zoneId: number) => Promise<void>;
  createZone: (nameEn: string, nameTl: string, soilType: string) => Promise<Zone | null>;
  setPlantedCrop: (zoneId: number, cropName: string, plantedOn: string) => Promise<boolean>;
  refreshZones: () => Promise<void>;
}

const AppContext = createContext<AppContextType>({
  theme: 'light',
  toggleTheme: () => { },
  isDarkMode: false,
  language: 'tagalog',
  setLanguage: () => { },
  t: (en: string, tl: string) => tl,
  user: null,
  login: async () => { },
  logout: async () => { },
  loading: true,
  fontSize: 'medium',
  setFontSize: () => { },
  fontScale: 1,

  zones: [],
  zonesLoading: true,
  zonesError: null,
  sensorZoneError: null,
  retryZoneLoading: async () => { },
  activeZoneId: null,
  sensorZoneId: null,
  assignSensorToZone: async () => { },
  setActiveZoneId: async () => { },
  createZone: async () => null,
  setPlantedCrop: async () => false,
  refreshZones: async () => { },
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [language, setLanguageState] = useState<Language>('tagalog');
  const [user, setUser] = useState<User | null>(null);
  // Start as true — we don't know auth state until getSession() resolves.
  const [loading, setLoading] = useState<boolean>(true);
  const [fontSize, setFontSizeState] = useState<FontSize>('medium');

  const [zones, setZones] = useState<Zone[]>([]);
  const [zonesLoading, setZonesLoading] = useState<boolean>(true);
  const [zonesError, setZonesError] = useState<string | null>(null);
  const [sensorZoneError, setSensorZoneError] = useState<string | null>(null);
  const [activeZoneId, setActiveZoneIdState] = useState<number | null>(null);
  const [sensorZoneId, setSensorZoneId] = useState<number | null>(null);

  const isDarkMode = theme === 'dark';

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const setFontSize = (size: FontSize) => {
    setFontSizeState(size);
  };

  // Font size scale factor
  const fontScale = fontSize === 'small' ? 0.85 : fontSize === 'large' ? 1.2 : 1;

  // Translation helper: returns Tagalog by default, English if set
  const t = (en: string, tl: string): string => {
    return language === 'english' ? en : tl;
  };

  // Auth methods
  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      setUser(data.user);
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await disablePushNotifications();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
    } catch (error: any) {
      console.error('Logout error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // ZONES
  // =========================================================

  const refreshZones = useCallback(async () => {
    setZonesLoading(true);
    setZonesError(null);
    try {
      const json = await backendRequest('/zones');
      if (!Array.isArray(json.data)) throw new Error('The server returned an invalid zone list.');
      setZones(json.data.map((zone: Zone & { name?: string }) => ({
        ...zone,
        name_en: zone.name_en || zone.name || `Zone ${zone.id}`,
        name_tl: zone.name_tl || zone.name_en || zone.name || `Sona ${zone.id}`,
      })));
    } catch (err) {
      setZonesError(err instanceof Error ? err.message : 'Unable to load zones. Please retry.');
      console.warn('Failed to fetch zones:', err);
    } finally {
      setZonesLoading(false);
    }
  }, []);

  const fetchActiveZone = useCallback(async () => {
    setSensorZoneError(null);
    try {
      const json = await backendRequest('/device/active-zone');
      setSensorZoneId(json.zone?.id ?? null);
      // A late response must not replace a zone the user has already selected.
      setActiveZoneIdState(current => current ?? json.zone?.id ?? null);
    } catch (err) {
      setSensorZoneError(err instanceof Error ? err.message : 'Unable to verify the sensor assignment.');
      console.warn('Failed to fetch active zone:', err);
    }
  }, []);

  const retryZoneLoading = useCallback(async () => {
    await Promise.all([refreshZones(), fetchActiveZone()]);
  }, [refreshZones, fetchActiveZone]);

  const setActiveZoneId = useCallback(async (zoneId: number) => {
    // Viewing a zone must never redirect the physical sensor's readings.
    setActiveZoneIdState(zoneId);
  }, []);

  const assignSensorToZone = useCallback(async (zoneId: number) => {
      // Re-read the assignment so another client's changes are not silently lost.
      const json = await backendRequest('/device/active-zone');
      const currentId = json.zone?.id ?? null;
      if (currentId !== sensorZoneId) {
        setSensorZoneId(currentId);
        throw new Error('The sensor assignment changed. Review its zone and confirm again.');
      }
      await backendRequest('/device/active-zone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone_id: zoneId }),
      });
      setSensorZoneId(zoneId);
      setSensorZoneError(null);
  }, [sensorZoneId]);

  const createZone = useCallback(async (nameEn: string, nameTl: string, soilType: string): Promise<Zone | null> => {
    try {
      const res = await fetch(`${API_BASE_URL}/zones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name_en: nameEn,
          name_tl: nameTl,
          soil_type: soilType,
        }),
      });
      if (!res.ok) throw new Error(`Zone creation failed (${res.status})`);
      const json = await res.json();

      if (json.status === 'success' && json.zone) {
        const newZone: Zone = json.zone;
        setZones((prev) => [...prev, newZone]);
        return newZone;
      }

      console.warn('Zone creation failed:', json.message);
      return null;
    } catch (err) {
      console.warn('Failed to create zone:', err);
      return null;
    }
  }, []);

  useEffect(() => {
    // Initial network loading belongs to provider startup; user retries use the same callback.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshZones();
    fetchActiveZone();
  }, [refreshZones, fetchActiveZone]);

  // Listen for auth changes + get initial session
  useEffect(() => {
    let isMounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setUser(session?.user ?? null);
      }
    });

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (isMounted) {
        setUser(session?.user ?? null);
        setLoading(false); // only flip to false once we actually know the auth state
      }
    })();

    return () => {
      isMounted = false;
      subscription.unsubscribe(); // was `subscription.unsubscribe` (missing call) before
    };
  }, []);
  const setPlantedCrop = useCallback(async (zoneId: number, cropName: string, plantedOn: string): Promise<boolean> => {
    if (!validPlantingDate(plantedOn)) return false;
    try {
      const { data, error } = await supabase
        .from('zones')
        .update({
          current_crop: cropName,
          planted_on: plantedOn,
          updated_at: new Date().toISOString(),
        })
        .eq('id', zoneId)
        .select()
        .single();

      if (error) throw error;

      setZones((prev) =>
        prev.map((z) => (z.id === zoneId ? { ...z, ...data } : z))
      );
      return true;
    } catch (err) {
      console.warn('Failed to set planted crop:', err);
      return false;
    }
  }, []);

  return (
    <AppContext.Provider
      value={{
        theme,
        toggleTheme,
        isDarkMode,
        language,
        setLanguage,
        t,
        user,
        login,
        logout,
        loading,
        fontSize, setFontSize, fontScale,

                zones,
        zonesLoading,
        zonesError,
        sensorZoneError,
        retryZoneLoading,
        activeZoneId,
        sensorZoneId,
        assignSensorToZone,
        setActiveZoneId,
        createZone,
        setPlantedCrop,
        refreshZones,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}

export type { FontSize, Zone };


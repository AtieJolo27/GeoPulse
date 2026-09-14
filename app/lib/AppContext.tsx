import { supabase } from '@/lib/supabaseClient';
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
}

const API_BASE_URL = 'https://capstone-eem0.onrender.com';

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
  activeZoneId: number | null;
  setActiveZoneId: (zoneId: number) => Promise<void>;
  createZone: (nameEn: string, nameTl: string, soilType: string) => Promise<Zone | null>;
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
  activeZoneId: null,
  setActiveZoneId: async () => { },
  createZone: async () => null,
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
  const [activeZoneId, setActiveZoneIdState] = useState<number | null>(null);

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
      await supabase.auth.signOut();
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
    try {
      const res = await fetch(`${API_BASE_URL}/zones`);
      const json = await res.json();
      setZones(json.data ?? []);
    } catch (err) {
      console.warn('Failed to fetch zones:', err);
    } finally {
      setZonesLoading(false);
    }
  }, []);

  const fetchActiveZone = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/device/active-zone`);
      const json = await res.json();
      if (json.zone) {
        setActiveZoneIdState(json.zone.id);
      }
    } catch (err) {
      console.warn('Failed to fetch active zone:', err);
    }
  }, []);

  const setActiveZoneId = useCallback(async (zoneId: number) => {
    // Update local state immediately so the UI feels instant,
    // then sync to the backend so the ESP32's next reading gets
    // tagged with this zone too.
    setActiveZoneIdState(zoneId);

    try {
      await fetch(`${API_BASE_URL}/device/active-zone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone_id: zoneId }),
      });
    } catch (err) {
      console.warn('Failed to set active zone on backend:', err);
    }
  }, []);

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
        activeZoneId,
        setActiveZoneId,
        createZone,
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

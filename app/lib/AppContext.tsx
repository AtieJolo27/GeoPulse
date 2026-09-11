import { User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

type Theme = 'light' | 'dark';
type Language = 'english' | 'tagalog';
type FontSize = 'small' | 'medium' | 'large';

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
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [language, setLanguageState] = useState<Language>('tagalog');
  const [user, setUser] = useState<User | null>(null);
  // Start as true — we don't know auth state until getSession() resolves.
  const [loading, setLoading] = useState<boolean>(true);
  const [fontSize, setFontSizeState] = useState<FontSize>('medium');

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
        fontSize, setFontSize, fontScale
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}

export type { FontSize };


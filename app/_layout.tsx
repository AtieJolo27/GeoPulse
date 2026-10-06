// app/_layout.tsx
import { AppProvider, useApp } from '@/app/lib/AppContext';
import { Redirect, Stack } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useThemeColors } from './lib/useThemeColors';

function RootLayoutNav() {
  const { user, loading } = useApp();
  const colors = useThemeColors();
  const theme = {
    ...(colors.isDarkMode ? DarkTheme : DefaultTheme),
    colors: {
      ...(colors.isDarkMode ? DarkTheme : DefaultTheme).colors,
      background: colors.bg,
      card: colors.cardBg,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
    },
  };

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.bg).catch(error => {
      console.warn('Unable to update system background:', error);
    });
  }, [colors.bg]);

  return (
    <ThemeProvider value={theme}>
      <StatusBar style={loading && !colors.isDarkMode ? 'dark' : 'light'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(drawer)" />
      </Stack>

      {loading && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: colors.bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ActivityIndicator size="large" color={colors.primaryLight} />
        </View>
      )}

      {!loading && !user && <Redirect href="/profile" />}
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppProvider>
      <RootLayoutNav />
    </AppProvider>
  );
}

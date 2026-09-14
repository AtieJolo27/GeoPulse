import { HeaderActions } from '@/app/components/HeaderActions';
import { Stack } from 'expo-router';
import React from 'react';
import '../../global.css';

export default function HistoryLayout() {
  return (
    <Stack
      screenOptions={{
        headerTitle: 'Field History',
        headerTitleStyle: { fontWeight: '800', fontSize: 20, color: '#FFFFFF' },
        headerStyle: { backgroundColor: '#1B5E37' },
        headerTintColor: '#FFFFFF',
        animation: 'fade',
        headerRight: () => <HeaderActions />,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Field History' }} />
    </Stack>
  );
}

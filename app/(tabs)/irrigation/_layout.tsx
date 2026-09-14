import { HeaderActions } from '@/app/components/HeaderActions';
import { Stack } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';


export default function IrrigationLayout() {
    return (
        <Stack
        screenOptions={{
            headerTitle:"Irrigation Guide",
      headerTitleStyle: { fontWeight: 'bold', fontSize: 20, color: '#F0FDF4' },
      headerStyle: { backgroundColor: '#1B5E37' },
      headerTintColor: '#F0FDF4',
      headerRight: () => <HeaderActions />
        }}>
            <Stack.Screen
            name='index'
            />
        </Stack>
    );
}

const styles = StyleSheet.create({})

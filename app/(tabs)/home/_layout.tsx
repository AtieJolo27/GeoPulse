import { HeaderActions } from '@/app/components/HeaderActions';
import { Stack } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';
import "../../global.css";

export const unstable_settings = {
  initialRouteName: 'index',
};
export default function HomeLayout () {
  return (
    <Stack screenOptions={{
      headerTitle:"My Field",
      headerTitleStyle: { fontWeight: 'bold', fontSize: 20, color: 'white' },
      headerStyle: { backgroundColor: '#1B5E37' },
      headerRight: () => <HeaderActions />
    }}>
        <Stack.Screen
            name="index"
            options={{
                title:"Home",
            }}/>

        
    </Stack>
  );
}


const styles = StyleSheet.create({})

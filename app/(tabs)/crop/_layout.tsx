import { HeaderActions } from '@/app/components/HeaderActions';
import { Stack } from 'expo-router';
import "../../global.css";

export const unstable_settings = {
  initialRouteName: 'index',
};


export default function FeedLayout() {
  return (
  <Stack screenOptions={{
      headerTitle:"Crop Guide",
      headerTitleStyle: { fontWeight: 'bold', fontSize: 20, color: '#F0FDF4' },
      headerStyle: { backgroundColor: '#1B5E37' },
      headerTintColor: '#F0FDF4',
      headerRight: () => <HeaderActions />
    }}>
    <Stack.Screen name="crops" options={{ title: "Crops" }} />
    <Stack.Screen name="reasoning" options={{ title: "Why this is recommended" }} />
  </Stack>);
}

import { useThemeColors } from '@/app/lib/useThemeColors';
import { TabScreenHeader } from '@/app/components/TabScreenHeader';
import { Stack } from 'expo-router';
import "../../../global.css";

export const unstable_settings = {
  initialRouteName: 'index',
};


export default function FeedLayout() {
  const colors = useThemeColors();
  return (
  <Stack screenOptions={{
      headerTitle:"Crop Guide",
      headerTitleStyle: { fontWeight: 'bold', fontSize: 20, color: '#F0FDF4' },
      headerStyle: { backgroundColor: colors.headerBg },
      contentStyle: { backgroundColor: colors.bg },
      headerTintColor: '#F0FDF4',
      header: ({ options, route, navigation, back }) => <TabScreenHeader title={typeof options.headerTitle === 'string' ? options.headerTitle : options.title ?? route.name} onBack={back ? () => navigation.goBack() : undefined} />
    }}>
    <Stack.Screen name="crops" options={{ title: "Crops" }} />
    <Stack.Screen name="reasoning" options={{ title: "Why this is recommended" }} />
  </Stack>);
}

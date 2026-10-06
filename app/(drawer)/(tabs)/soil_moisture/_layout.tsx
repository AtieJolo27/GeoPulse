import { useThemeColors } from '@/app/lib/useThemeColors';
import { TabScreenHeader } from '@/app/components/TabScreenHeader';
import { Stack } from 'expo-router';


export default function IrrigationLayout() {
  const colors = useThemeColors();
    return (
        <Stack
        screenOptions={{
            headerTitle:"Soil Moisture",
      headerTitleStyle: { fontWeight: 'bold', fontSize: 20, color: '#F0FDF4' },
      headerStyle: { backgroundColor: colors.headerBg },
      contentStyle: { backgroundColor: colors.bg },
      headerTintColor: '#F0FDF4',
      header: ({ options, route, navigation, back }) => <TabScreenHeader title={typeof options.headerTitle === 'string' ? options.headerTitle : options.title ?? route.name} onBack={back ? () => navigation.goBack() : undefined} />
        }}>
            <Stack.Screen
            name='soil_moistures'
            />
        </Stack>
    );
}

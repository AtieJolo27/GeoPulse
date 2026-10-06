import { useThemeColors } from '@/app/lib/useThemeColors';
import { TabScreenHeader } from '@/app/components/TabScreenHeader';
import { Stack } from 'expo-router';
import '../../../global.css';

export default function HistoryLayout() {
  const colors = useThemeColors();
  return (
    <Stack
      screenOptions={{
        headerTitle: 'Field History',
        headerTitleStyle: { fontWeight: '800', fontSize: 20, color: '#FFFFFF' },
        headerStyle: { backgroundColor: colors.headerBg },
      contentStyle: { backgroundColor: colors.bg },
        headerTintColor: '#FFFFFF',
        animation: 'fade',
        header: ({ options, route, navigation, back }) => <TabScreenHeader title={typeof options.headerTitle === 'string' ? options.headerTitle : options.title ?? route.name} onBack={back ? () => navigation.goBack() : undefined} />,
      }}
    >
      <Stack.Screen name="histories" options={{ title: 'Field History' }} />
    </Stack>
  );
}

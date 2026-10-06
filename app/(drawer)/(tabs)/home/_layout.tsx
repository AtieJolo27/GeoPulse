import { useThemeColors } from '@/app/lib/useThemeColors';
import { TabScreenHeader } from '@/app/components/TabScreenHeader';
import { Stack } from 'expo-router';
import "../../../global.css";

export const unstable_settings = {
  initialRouteName: 'index',
};
export default function HomeLayout () {
  const colors = useThemeColors();
  return (
    <Stack screenOptions={{
      headerTitle:"My Field",
      headerTitleStyle: { fontWeight: 'bold', fontSize: 20, color: 'white' },
      headerStyle: { backgroundColor: colors.headerBg },
      contentStyle: { backgroundColor: colors.bg },
      header: ({ options, route, navigation, back }) => <TabScreenHeader title={typeof options.headerTitle === 'string' ? options.headerTitle : options.title ?? route.name} onBack={back ? () => navigation.goBack() : undefined} />
    }}>
        <Stack.Screen
            name="index"
            options={{
                title:"Home",
            }}/>

        
    </Stack>
  );
}

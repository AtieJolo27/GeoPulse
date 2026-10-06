import { Ionicons } from '@expo/vector-icons';
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '@/app/lib/useThemeColors';
import "../../global.css";

export default function RootLayout() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  return (
    <Tabs screenOptions={{
      headerShown: false,
      animation: 'fade',
      sceneStyle: { backgroundColor: colors.bg },
      tabBarHideOnKeyboard: true,
      tabBarStyle: {
        backgroundColor: colors.headerBg,
        height: 64 + insets.bottom,
        paddingBottom: insets.bottom,
        paddingTop: 7,
        shadowColor: '#123E26',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 10,
        borderTopWidth: 0,
      },
      tabBarActiveTintColor: '#FFFFFF',
      tabBarInactiveTintColor: 'rgba(255,255,255,0.62)',
      tabBarLabelStyle: {
        fontSize: 11,
        fontWeight: '700',
      },
     }}>
      <Tabs.Screen name='home'
      options={{
        title: "Home",
        tabBarIcon: ({color, size, focused}) =>
          <Ionicons name={focused ? 'home' : 'home-outline'} color={color} size={size} />
      }}
      />
      <Tabs.Screen name="crop"
        options={{
          title: "Crops",
        tabBarIcon: ({color, size, focused}) =>
            <Ionicons name={focused ? 'leaf' : 'leaf-outline'} color={color} size={size} />
        }}
        />
      <Tabs.Screen name="fertilizer"
        options={{
          title: "Fertilizers",
        tabBarIcon: ({color, size, focused}) =>
            <Ionicons name={focused ? 'nutrition' : 'nutrition-outline'} color={color} size={size} />
        }}
        />
      <Tabs.Screen name="soil_moisture"
        options={{
          title: "Soil Moisture",
        tabBarIcon: ({color, size, focused}) =>
            <Ionicons name={focused ? 'water' : 'water-outline'} color={color} size={size} />
        }}
        />
      <Tabs.Screen name="history"
        options={{
          title: "History",
        tabBarIcon: ({color, size, focused}) =>
            <Ionicons name={focused ? 'stats-chart' : 'stats-chart-outline'} color={color} size={size} />
        }}
        />

    </Tabs>
  );
}

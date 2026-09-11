import { Ionicons } from '@expo/vector-icons';
import { Tabs } from "expo-router";
import "../global.css";

export default function RootLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      animation: 'fade',
      tabBarStyle: {
        backgroundColor: '#1B5E37',
        borderRadius: 22,
        height: 68,
        marginHorizontal: 14,
        marginBottom: 18,
        paddingBottom: 7,
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
      <Tabs.Screen name="irrigation"
        options={{
          title: "Irrigation",
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

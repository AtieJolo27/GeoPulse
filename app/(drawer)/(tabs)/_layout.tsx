import { PlatformPressable } from 'expo-router/react-navigation';
import { TutorialTarget } from '@/shared/appLib/TutorialContext';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '@/shared/appLib/useThemeColors';
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
        backgroundColor: colors.cardBg,
        height: 72 + insets.bottom,
        paddingBottom: Math.max(insets.bottom, 8),
        paddingTop: 10,
        shadowColor: '#102D22',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
        elevation: 4,
        borderTopWidth: 1,
        borderTopColor: colors.border,
      },
      tabBarActiveTintColor: colors.greenText,
      tabBarInactiveTintColor: colors.mutedText,
      tabBarActiveBackgroundColor: colors.cardBgAlt,
      tabBarItemStyle: { borderRadius: 16, marginHorizontal: 3 },
      tabBarLabelStyle: {
        fontSize: 11,
        fontWeight: '700',
      },
     }}>
      <Tabs.Screen name='home'
      options={{
        title: "Home",
        tabBarButton: props => <TutorialTarget id="home" persistent style={{ flex: 1 }}><PlatformPressable {...props} /></TutorialTarget>,
        tabBarIcon: ({color, size, focused}) =>
          <Ionicons name={focused ? 'home' : 'home-outline'} color={color} size={size} />
      }}
      />
      <Tabs.Screen name="crop"
        options={{
          title: "Crops",
        tabBarButton: props => <TutorialTarget id="crop" persistent style={{ flex: 1 }}><PlatformPressable {...props} /></TutorialTarget>,
        tabBarIcon: ({color, size, focused}) =>
            <Ionicons name={focused ? 'leaf' : 'leaf-outline'} color={color} size={size} />
        }}
        />
      <Tabs.Screen name="fertilizer"
        options={{
          title: "Fertilizers",
        tabBarButton: props => <TutorialTarget id="fertilizer" persistent style={{ flex: 1 }}><PlatformPressable {...props} /></TutorialTarget>,
        tabBarIcon: ({color, size, focused}) =>
            <Ionicons name={focused ? 'nutrition' : 'nutrition-outline'} color={color} size={size} />
        }}
        />
      <Tabs.Screen name="soil_moisture"
        options={{
          title: "Soil Moisture",
        tabBarButton: props => <TutorialTarget id="soil_moisture" persistent style={{ flex: 1 }}><PlatformPressable {...props} /></TutorialTarget>,
        tabBarIcon: ({color, size, focused}) =>
            <Ionicons name={focused ? 'water' : 'water-outline'} color={color} size={size} />
        }}
        />
      <Tabs.Screen name="history"
        options={{
          title: "Manage",
        tabBarButton: props => <TutorialTarget id="history" persistent style={{ flex: 1 }}><PlatformPressable {...props} /></TutorialTarget>,
        tabBarIcon: ({color, size, focused}) =>
            <Ionicons name={focused ? 'grid' : 'grid-outline'} color={color} size={size} />
        }}
        />

    </Tabs>
  );
}

import { Ionicons } from '@expo/vector-icons';
import { Drawer, DrawerContentScrollView, DrawerItem, DrawerItemList } from 'expo-router/drawer';
import { useApp } from '@/app/lib/AppContext';
import { Alert } from 'react-native';
import { useThemeColors } from '@/app/lib/useThemeColors';
export default function DrawerLayout(){
    const { t, isDarkMode, fontScale, user, logout, loading } = useApp();
    const colors = useThemeColors();
    return(

        <Drawer
        drawerContent={(props) => (
            <DrawerContentScrollView {...props}>
                <DrawerItemList {...props} />
                {user && (
                    <DrawerItem
                        label={t('Sign Out', 'Mag-log out')}
                        labelStyle={{ fontSize: 15 * fontScale }}
                        inactiveTintColor="rgba(255,255,255,0.62)"
                        icon={({ color, size }) => <Ionicons name="log-out-outline" color={color} size={size} />}
                        onPress={async () => {
                            if (loading) return;
                            try {
                                await logout();
                                props.navigation.closeDrawer();
                            } catch {
                                Alert.alert(t('Logout failed', 'Nabigo ang pag-logout'));
                            }
                        }}
                    />
                )}
            </DrawerContentScrollView>
        )}
        screenOptions={{
            headerShown: false, 
            sceneStyle: { backgroundColor: colors.bg },
            drawerPosition: 'right',
            drawerStyle:{
                backgroundColor: isDarkMode ? '#123E26' : '#1B5E37',
            },
            drawerActiveTintColor: '#FFFFFF',
            drawerLabelStyle: { fontSize: 15 * fontScale },
      drawerInactiveTintColor: 'rgba(255,255,255,0.62)',
        }}>
            <Drawer.Screen name="(tabs)"
            options={{
                drawerLabel: t('Home', 'Home'),
                drawerIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
            }}
            />
            <Drawer.Screen name="profile"
            options={{
                drawerLabel: t('Profile', 'Profile'),
                drawerIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} />,
            }}
            />
            <Drawer.Screen name="tips"
            options={{
                drawerLabel: t('Tips and Guides', 'Mga Tip at Gabay'),
                drawerIcon: ({ color, size }) => <Ionicons name="book" color={color} size={size} />,
            }}
            />
            <Drawer.Screen name="settings"
            options={{
                drawerLabel: t('Settings', 'Mga Setting'),
                drawerIcon: ({ color, size }) => <Ionicons name="cog" color={color} size={size} />,
            }}
            />
        </Drawer>

    );
}

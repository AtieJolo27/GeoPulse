import { Ionicons } from '@expo/vector-icons';
import { Drawer, DrawerContentScrollView, DrawerItem, DrawerItemList } from 'expo-router/drawer';
import { useApp } from '@/shared/appLib/AppContext';
import { Alert, Text, View } from 'react-native';
import { useThemeColors } from '@/shared/appLib/useThemeColors';
export default function DrawerLayout(){
    const { t, fontScale, user, logout, loading } = useApp();
    const colors = useThemeColors();
    return(

        <Drawer
        drawerContent={(props) => (
            <DrawerContentScrollView {...props}>
                <View style={{ padding: 24, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: colors.cardBgAlt, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                        <Ionicons name="leaf" size={26} color={colors.greenText} />
                    </View>
                    <Text style={{ fontSize: 26 * fontScale, fontWeight: '800', letterSpacing: -0.8, color: colors.text }}>GeoPulse</Text>
                    <Text style={{ color: colors.subText, marginTop: 6, fontSize: 13 * fontScale }}>{t('Your field, at a glance.', 'Ang iyong bukid sa isang tingin.')}</Text>
                </View>
                <DrawerItemList {...props} />
                {user && (
                    <DrawerItem
                        label={t('Sign Out', 'Mag-log out')}
                        labelStyle={{ fontSize: 15 * fontScale }}
                        inactiveTintColor={colors.subText}
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
                backgroundColor: colors.cardBg,
            },
            drawerActiveTintColor: colors.greenText,
            drawerActiveBackgroundColor: colors.cardBgAlt,
            drawerItemStyle: { borderRadius: 16, marginVertical: 4 },
            drawerLabelStyle: { fontSize: 15 * fontScale, fontWeight: '600' },
      drawerInactiveTintColor: colors.subText,
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

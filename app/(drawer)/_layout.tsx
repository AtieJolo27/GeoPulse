import { Ionicons } from '@expo/vector-icons';
import { Drawer } from 'expo-router/drawer';
import { StyleSheet } from 'react-native';
export default function DrawerLayout(){
    return(

        <Drawer
        screenOptions={{
            headerShown: false, 
            drawerPosition: 'right',
            drawerStyle:{
                backgroundColor: '#1B5E37',
            },
            drawerActiveTintColor: '#FFFFFF',
      drawerInactiveTintColor: 'rgba(255,255,255,0.62)',
        }}>
            <Drawer.Screen name="(tabs)"
            options={{
                drawerLabel: 'Home',
                drawerIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
            }}
            />
            <Drawer.Screen name="profile"
            options={{
                drawerLabel: 'Profile',
                drawerIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} />,
            }}
            />
            <Drawer.Screen name="tips"
            options={{
                drawerLabel: 'Tips and Guide',
                drawerIcon: ({ color, size }) => <Ionicons name="book" color={color} size={size} />,
            }}
            />
            <Drawer.Screen name="settings"
            options={{
                drawerLabel: 'Settings',
                drawerIcon: ({ color, size }) => <Ionicons name="cog" color={color} size={size} />,
            }}
            />
        </Drawer>

    );
}


const styles = StyleSheet.create({})
import SensorWifiScreen from '@/app/components/SensorWifiScreen';
import { useApp } from '@/app/lib/AppContext';
import { useThemeColors } from '@/app/lib/useThemeColors';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { useState } from 'react';
import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { lightHaptic, mediumHaptic } from '../../lib/haptics';

export function WifiButton() {
    const colors = useThemeColors();
    const { t, fontScale } = useApp();

    const [wifiModalVisible, setWifiModalVisible] = useState(false);

    return (
        <>
            <TouchableOpacity
                onPress={() => {
                    lightHaptic();
                    setWifiModalVisible(true);
                }}
                className="mx-2 center"
                style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.2,
                    shadowRadius: 18,
                    elevation: 12,
                }}
                accessibilityRole="button"
                accessibilityLabel={t('Sensor Wi-Fi', 'Wi-Fi ng Sensor')}
            >
                <Ionicons name="wifi-outline" size={22} color="white" />
            </TouchableOpacity>

            <Modal
                visible={wifiModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setWifiModalVisible(false)}
            >
                <Pressable
                    className="flex-1"
                    style={{
                        backgroundColor: 'rgba(0,0,0,0.3)',
                    }}
                    onPress={() => setWifiModalVisible(false)}
                >
                    <Pressable
                        className="absolute rounded-3xl"
                        style={{
                            top: 66,
                            right: 16,
                            width: '88%',
                            maxWidth: 420,
                            maxHeight: 480,

                            // Same background as the content
                            backgroundColor: '#FFFFFF',

                            overflow: 'hidden',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 8 },
                            shadowOpacity: 0.2,
                            shadowRadius: 18,
                            elevation: 12,
                        }}
                        onPress={(event) => event.stopPropagation()}
                    >
                        {/* HEADER */}
                        <View
                            style={{
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                paddingHorizontal: 20,
                                paddingVertical: 16,

                                // Match the content background
                                backgroundColor: '#f4f7f5',
                            }}
                        >
                            <View className="flex-row items-center">
                                <Ionicons
                                    name="wifi-outline"
                                    size={22}
                                    color="#1B5E37"
                                />

                                <Text
                                    style={{
                                        marginLeft: 10,
                                        fontSize: 18,
                                        fontWeight: 'bold',
                                        color: '#173D28',
                                    }}
                                >
                                    {t('Sensor Wi-Fi', 'Wi-Fi ng Sensor')}
                                </Text>
                            </View>

                            <TouchableOpacity
                                onPress={() => {
                                    mediumHaptic();
                                    setWifiModalVisible(false);
                                }}
                                accessibilityRole="button"
                                accessibilityLabel={t('Close', 'Isara')}
                            >
                                <Ionicons
                                    name="close-circle"
                                    size={28}
                                    color="#1B5E37"
                                />
                            </TouchableOpacity>
                        </View>

                        {/* CONTENT */}
                        <SensorWifiScreen />
                    </Pressable>
                </Pressable>
            </Modal>
        </>
    );
}
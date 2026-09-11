import { useApp } from '@/app/lib/AppContext';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';

type WeatherDay = { date: string; high: number; low: number; code: number };

const weatherDetails = (code: number) => {
  if (code === 0) return { icon: 'sunny-outline' as const, label: 'Clear' };
  if (code <= 2) return { icon: 'partly-sunny-outline' as const, label: 'Partly cloudy' };
  if (code === 3 || code === 45 || code === 48) return { icon: 'cloudy-outline' as const, label: 'Cloudy' };
  if (code <= 67 || (code >= 80 && code <= 82)) return { icon: 'rainy-outline' as const, label: 'Rain' };
  if (code <= 77) return { icon: 'snow-outline' as const, label: 'Snow' };
  return { icon: 'thunderstorm-outline' as const, label: 'Thunderstorms' };
};

const dayLabel = (date: string, index: number) => index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(new Date(`${date}T12:00:00`));

export function WeatherIndicator() {
  const { t } = useApp();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forecast, setForecast] = useState<WeatherDay[]>([]);
  const [currentTemperature, setCurrentTemperature] = useState<number | null>(null);

  const loadForecast = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') throw new Error('Location permission is needed to show the forecast for your field.');
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = location.coords;
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=7`);
      if (!response.ok) throw new Error('Unable to load the weather forecast right now.');
      const data = await response.json();
      const daily = data?.daily;
      if (!daily?.time || !daily?.weather_code || !daily?.temperature_2m_max || !daily?.temperature_2m_min) throw new Error('The weather service returned an incomplete forecast.');
      setCurrentTemperature(Number.isFinite(data.current?.temperature_2m) ? Math.round(data.current.temperature_2m) : null);
      setForecast(daily.time.map((date: string, index: number) => ({ date, code: daily.weather_code[index], high: Math.round(daily.temperature_2m_max[index]), low: Math.round(daily.temperature_2m_min[index]) })));
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to load the weather forecast right now.'); }
    finally { setLoading(false); }
  }, []);

  const openForecast = () => { setVisible(true); if (!forecast.length && !loading) loadForecast(); };

  useEffect(() => {
    loadForecast();
  }, [loadForecast]);

  return <>
    <TouchableOpacity onPress={openForecast} activeOpacity={0.7} className="mr-2 h-10 flex-row items-center justify-center rounded-full px-2" style={{ minWidth: 66, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }} accessibilityRole="button" accessibilityLabel={currentTemperature === null ? t('Open 7-day weather forecast', 'Buksan ang 7-araw na taya ng panahon') : t(`Open weather forecast, currently ${currentTemperature} degrees Celsius`, `Buksan ang taya ng panahon, kasalukuyang ${currentTemperature} degrees Celsius`)}>
      <Ionicons name="partly-sunny-outline" size={21} color="#FFFFFF" />
      <Text className="ml-1" style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>{currentTemperature === null ? '--' : `${currentTemperature}°C`}</Text>
    </TouchableOpacity>
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <Pressable className="flex-1" style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }} onPress={() => setVisible(false)}>
        <Pressable className="absolute right-4 top-16 w-[88%] rounded-3xl p-5" style={{ backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 18, elevation: 12 }} onPress={(event) => event.stopPropagation()}>
          <View className="flex-row items-center justify-between"><View className="flex-row items-center"><Ionicons name="partly-sunny-outline" size={25} color="#D97706" /><View className="ml-2"><Text className="text-base font-extrabold" style={{ color: '#173D28' }}>{t('Weather', 'Panahon')}</Text><Text className="text-xs" style={{ color: '#5C6F63' }}>{t('7-day forecast for your location', '7-araw na taya para sa inyong lokasyon')}</Text></View></View><TouchableOpacity onPress={() => setVisible(false)} accessibilityRole="button" accessibilityLabel={t('Close weather forecast', 'Isara ang taya ng panahon')}><Ionicons name="close" size={24} color="#365443" /></TouchableOpacity></View>
          {loading ? <View className="items-center py-10"><ActivityIndicator color="#1B5E37" /><Text className="mt-3 text-sm" style={{ color: '#5C6F63' }}>{t('Getting your local forecast…', 'Kinukuha ang lokal na taya…')}</Text></View> : error ? <View className="items-center py-8"><Ionicons name="location-outline" size={30} color="#A16207" /><Text className="mt-3 text-center text-sm" style={{ color: '#5C6F63' }}>{error}</Text><TouchableOpacity onPress={loadForecast} className="mt-4 rounded-full px-4 py-2" style={{ backgroundColor: '#E7F4EA' }}><Text className="font-bold" style={{ color: '#1B5E37' }}>{t('Try again', 'Subukang muli')}</Text></TouchableOpacity></View> : <ScrollView className="mt-5" showsVerticalScrollIndicator={false} style={{ maxHeight: 390 }}>{forecast.map((day, index) => { const details = weatherDetails(day.code); return <View key={day.date} className="flex-row items-center justify-between border-b py-3" style={{ borderColor: '#E7EEE9' }}><Text className="w-20 text-sm font-bold" style={{ color: '#173D28' }}>{dayLabel(day.date, index)}</Text><View className="flex-row flex-1 items-center"><Ionicons name={details.icon} size={22} color="#D97706" /><Text className="ml-2 text-sm" style={{ color: '#5C6F63' }}>{details.label}</Text></View><Text className="text-sm font-bold" style={{ color: '#173D28' }}>{day.high}° <Text style={{ color: '#7E8D83' }}>{day.low}°</Text></Text></View>; })}</ScrollView>}
        </Pressable>
      </Pressable>
    </Modal>
  </>;
}

import React, { useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useApp } from '@/app/lib/AppContext';
import { useThemeColors } from '@/app/lib/useThemeColors';
import { localDate } from '@/lib/plantingDate';

export default function PlantingDatePicker({ value, onChange }: { value: string; onChange: (date: string) => void }) {
  const { t, language, fontScale } = useApp();
  const colors = useThemeColors();
  const [visible, setVisible] = useState(false);
  const [month, setMonth] = useState(new Date());
  const today = localDate();
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const locale = language === 'tagalog' ? 'fil-PH' : 'en-PH';
  const button = { padding: 12, minHeight: 44, borderRadius: 10, backgroundColor: colors.cardBgAlt };
  return <View style={{ marginVertical: 12 }}>
    <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 6 }}>{t('Actual planting date', 'Aktuwal na petsa ng pagtatanim')}</Text>
    <TouchableOpacity accessibilityRole="button" style={button} onPress={() => {
      setMonth(value ? new Date(`${value}T12:00:00`) : new Date());
      setVisible(true);
    }}>
      <Text style={{ color: colors.text, fontSize: 14 * fontScale }}>{value ? new Date(`${value}T12:00:00`).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' }) : t('Choose planting date', 'Piliin ang petsa')}</Text>
    </TouchableOpacity>
    <Text style={{ color: colors.mutedText, marginTop: 6 }}>{t('Choose when you planted, even if it was before adding this crop.', 'Piliin ang araw ng pagtatanim kahit bago pa idagdag ang pananim dito.')}</Text>
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <ScrollView style={{ flexGrow: 0, maxHeight: '90%', borderRadius: 20, backgroundColor: colors.cardBg }} contentContainerStyle={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <TouchableOpacity style={button} accessibilityLabel={t('Previous month', 'Nakaraang buwan')} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><Text style={{ color: colors.text }}>{'<'}</Text></TouchableOpacity>
            <Text style={{ color: colors.text, fontWeight: '700', flex: 1, textAlign: 'center' }}>{first.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}</Text>
            <TouchableOpacity style={button} disabled={localDate(first).slice(0, 7) >= today.slice(0, 7)} accessibilityLabel={t('Next month', 'Susunod na buwan')} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><Text style={{ color: colors.text }}>{'>'}</Text></TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: 12 }}>
            {Array.from({ length: 7 }, (_, i) => <Text key={`weekday-${i}`} style={{ width: '14.2857%', textAlign: 'center', color: colors.mutedText }}>{new Date(2024, 0, 7 + i).toLocaleDateString(locale, { weekday: 'narrow' })}</Text>)}
            {Array.from({ length: first.getDay() }, (_, i) => <View key={`blank-${i}`} style={{ width: '14.2857%' }} />)}
            {Array.from({ length: count }, (_, i) => {
              const day = localDate(new Date(month.getFullYear(), month.getMonth(), i + 1));
              return <TouchableOpacity key={day} accessibilityRole="button" accessibilityLabel={day} accessibilityState={{ selected: value === day, disabled: day > today }} disabled={day > today} onPress={() => { onChange(day); setVisible(false); }} style={{ width: '14.2857%', minHeight: 44, justifyContent: 'center', borderRadius: 8, backgroundColor: value === day ? colors.primary : 'transparent', opacity: day > today ? 0.3 : 1 }}><Text style={{ color: value === day ? 'white' : colors.text, textAlign: 'center' }}>{i + 1}</Text></TouchableOpacity>;
            })}
          </View>
          <TouchableOpacity style={button} onPress={() => setVisible(false)}><Text style={{ color: colors.text, textAlign: 'center' }}>{t('Close', 'Isara')}</Text></TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  </View>;
}

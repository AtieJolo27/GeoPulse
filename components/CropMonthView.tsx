import { useApp } from '@/app/lib/AppContext';
import { useThemeColors } from '@/app/lib/useThemeColors';
import type { CropEvent } from '@/lib/cropCalendar';
import { localDate } from '@/lib/plantingDate';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

export const HARVEST_COLOR = '#C17A18';
export const FERTILIZER_COLOR = '#357AC4';

export default function CropMonthView({ value, onChange, events }: { value: string; onChange: (date: string) => void; events: Pick<CropEvent, 'kind' | 'event_date' | 'completed'>[] }) {
  const { language, t } = useApp();
  const colors = useThemeColors();
  const [month, setMonth] = useState(() => new Date(`${value}T12:00:00`));
  const locale = language === 'tagalog' ? 'fil-PH' : 'en-PH';
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const slots = Math.ceil((first.getDay() + count) / 7) * 7;
  const today = localDate();
  return <View style={{ gap: 14 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('Previous month', 'Nakaraang buwan')} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} style={{ padding: 10 }}><Ionicons name="chevron-back" size={20} color={colors.text} /></TouchableOpacity>
      <View style={{ alignItems: 'center' }}>
        <Text style={{ color: colors.text, fontSize: 19, fontWeight: '800' }}>{first.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}</Text>
        <TouchableOpacity accessibilityRole="button" onPress={() => { setMonth(new Date()); onChange(today); }} style={{ padding: 6 }}><Text style={{ color: colors.greenText, fontSize: 12, fontWeight: '700' }}>{t('Go to today', 'Bumalik sa ngayon')}</Text></TouchableOpacity>
      </View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('Next month', 'Susunod na buwan')} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} style={{ padding: 10 }}><Ionicons name="chevron-forward" size={20} color={colors.text} /></TouchableOpacity>
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {Array.from({ length: 7 }, (_, i) => <Text key={`week-${i}`} style={{ width: '14.2857%', textAlign: 'center', color: colors.mutedText, fontSize: 12, fontWeight: '700', paddingBottom: 12 }}>{new Date(2024, 0, 7 + i).toLocaleDateString(locale, { weekday: 'narrow' })}</Text>)}
      {Array.from({ length: slots }, (_, slot) => {
        const day = slot - first.getDay() + 1;
        if (day < 1 || day > count) return <View key={slot} style={{ width: '14.2857%', minHeight: 54 }} />;
        const date = localDate(new Date(month.getFullYear(), month.getMonth(), day));
        const tasks = events.filter(event => event.event_date === date);
        const harvest = tasks.some(task => task.kind === 'harvest');
        const fertilizer = tasks.some(task => task.kind === 'fertilizer');
        const selected = date === value;
        return <TouchableOpacity key={slot} accessibilityRole="button" accessibilityLabel={`${date}, ${tasks.length} ${t('tasks', 'gawain')}`} accessibilityState={{ selected }} onPress={() => onChange(date)} style={{ width: '14.2857%', minHeight: 54, padding: 2 }}>
          <View style={{ flex: 1, borderRadius: 12, borderWidth: 1, borderColor: selected ? colors.primary : date === today ? colors.primaryLight : 'transparent', backgroundColor: selected ? colors.primary : colors.bg, alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <Text style={{ color: selected ? '#FFFFFF' : colors.text, fontWeight: selected || date === today ? '800' : '500', fontSize: 14 }}>{day}</Text>
            <View style={{ flexDirection: 'row', gap: 3, minHeight: 6 }}>
              {harvest && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: selected ? '#FFE3A6' : HARVEST_COLOR }} />}
              {fertilizer && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: selected ? '#B9DDFF' : FERTILIZER_COLOR }} />}
            </View>
          </View>
        </TouchableOpacity>;
      })}
    </View>
    <View style={{ flexDirection: 'row', gap: 18, justifyContent: 'center' }}>
      {([{ kind: 'harvest', color: HARVEST_COLOR, text: t('Harvest', 'Ani') }, { kind: 'fertilizer', color: FERTILIZER_COLOR, text: t('Fertilizer', 'Pataba') }]).map(item => <View key={item.kind} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><View style={{ height: 8, width: 8, borderRadius: 4, backgroundColor: item.color }} /><Text style={{ color: colors.subText, fontSize: 12 }}>{item.text}</Text></View>)}
    </View>
  </View>;
}

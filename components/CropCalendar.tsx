import { useApp } from '@/app/lib/AppContext';
import { useThemeColors } from '@/app/lib/useThemeColors';
import { getApiUrl } from '@/lib/apiConfig';
import { CropEvent, parseCropSchedule, reminderTime, validCalendarDate } from '@/lib/cropCalendar';
import { CalendarData, createCropEventStore, EventInput } from '@/lib/cropEventStore';
import { readCropScheduleResponse } from '@/lib/cropScheduleResponse';
import { localDate } from '@/lib/plantingDate';
import { enablePushNotifications, disablePushNotifications } from '@/lib/pushNotifications';
import { supabase } from '@/lib/supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { AppState, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import CropMonthView, { FERTILIZER_COLOR, HARVEST_COLOR } from './CropMonthView';

export default function CropCalendar() {
  const { user, zones, activeZoneId } = useApp();
  const zone = zones.find(z => z.id === activeZoneId);
  return <CalendarEditor key={`${user?.id}-${zone?.id}-${zone?.current_crop}-${zone?.planted_on}`} />;
}

function CalendarEditor() {
  const { user, zones, activeZoneId, setActiveZoneId, language, t } = useApp();
  const colors = useThemeColors();
  const zone = zones.find(z => z.id === activeZoneId);
  const userId = user?.id;
  const zoneId = zone?.id;
  const [store] = useState(() => userId && zoneId != null ? createCropEventStore(supabase, localStorage, userId, zoneId) : null);
  const [events, setEvents] = useState<CropEvent[]>([]);
  const [deviceOnly, setDeviceOnly] = useState(false);
  const [date, setDate] = useState(localDate());
  const [kind, setKind] = useState<'harvest' | 'fertilizer'>('harvest');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState<ReturnType<typeof parseCropSchedule> | null>(null);
  const [editing, setEditing] = useState<CropEvent | null>(null);
  const [loading, setLoading] = useState(Boolean(store));
  const [showAll, setShowAll] = useState(false);
  const apply = (data: CalendarData) => { setEvents(data.events); setDeviceOnly(data.deviceOnly); };
  useFocusEffect(React.useCallback(() => {
    let active = true;
    const refresh = async () => {
      if (!store) return;
      try { const data = await store.load(); if (active) { setEvents(data.events); setDeviceOnly(data.deviceOnly); } }
      catch (error) { if (active) setMessage(error instanceof Error ? error.message : 'Unable to load dates.'); }
      finally { if (active) setLoading(false); }
    };
    void refresh();
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { active = false; listener.remove(); };
  }, [store, setMessage, setEvents, setDeviceOnly, setLoading]));
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setMessage('');
    try { await action(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(false); }
  };
  const save = async (items: { kind: 'harvest' | 'fertilizer'; date: string }[], source: 'manual' | 'ai') => {
    if (!store || !user || !zone?.current_crop || !zone.planted_on) throw new Error(t('Record a crop and planting date on Home first.', 'Itala muna ang pananim at petsa ng pagtatanim sa Home.'));
    if (items.some(item => !validCalendarDate(item.date) || item.date < zone.planted_on!)) throw new Error(t('Dates must be on or after planting.', 'Dapat kasabay o pagkatapos ng pagtatanim ang petsa.'));
    const rows: EventInput[] = items.map(item => ({ user_id: user.id, zone_id: zone.id, crop: zone.current_crop!, planted_on: zone.planted_on!, kind: item.kind, event_date: item.date, notify_at: reminderTime(item.date), source }));
    const result = await store.save(rows, source === 'manual' ? editing : null);
    apply(result); setEditing(null); setDraft(null);
    if (source === 'ai') { setDate(items[0].date); setShowAll(true); }
    setMessage(result.deviceOnly
      ? t('Saved on this device. Cloud reminders will be available after calendar setup.', 'Na-save sa device na ito. Magagamit ang cloud reminders kapag na-set up ang kalendaryo.')
      : t('Saved. Push reminders are sent at 8 a.m. for upcoming dates when enabled.', 'Na-save. May push reminder sa alas-8 ng umaga para sa mga susunod na petsa kapag naka-enable.'));
  };
  const predict = async () => {
    if (!zone?.current_crop || !zone.planted_on) throw new Error(t('Record a crop and planting date first.', 'Itala muna ang pananim at petsa ng pagtatanim.'));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35000);
    try {
      const response = await fetch(getApiUrl('/api/crop-schedule'), {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ crop: zone.current_crop, planted_on: zone.planted_on, soil_type: zone.soil_type, language }), signal: controller.signal,
      });
      const data = await readCropScheduleResponse(response);
      const schedule = parseCropSchedule(JSON.stringify(data), zone.planted_on);
      setDraft(schedule); setDate(schedule.harvest_date);
    } catch (error) {
      if (controller.signal.aborted) throw new Error(t('AI took too long. Please try again.', 'Matagal ang AI. Subukan muli.'));
      throw error;
    } finally { clearTimeout(timer); }
  };
  const button = (label: string, action: () => Promise<void>, disabled = false, primary = false) => <TouchableOpacity accessibilityRole="button" disabled={busy || disabled} onPress={() => void run(action)} style={{ padding: 13, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: primary ? colors.primary : colors.border, backgroundColor: primary ? colors.primary : colors.cardBg, opacity: busy || disabled ? 0.5 : 1 }}><Text style={{ color: primary ? '#FFFFFF' : colors.greenText, fontWeight: '700', textAlign: 'center' }}>{label}</Text></TouchableOpacity>;
  const visibleEvents = events.filter(event => showAll || event.event_date === date);
  const previewEvents = draft ? [{ event_date: draft.harvest_date, kind: 'harvest' as const, completed: false }, ...draft.fertilizer_dates.map(event_date => ({ event_date, kind: 'fertilizer' as const, completed: false }))] : [];
  const canSave = !!store && !!zone?.current_crop && !!zone.planted_on;
  return <View style={{ marginVertical: 20, gap: 14 }}>
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
      <View style={{ backgroundColor: colors.primary, padding: 12, borderRadius: 15 }}><Ionicons name="calendar-outline" size={24} color="#FFFFFF" /></View>
      <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: 23, fontWeight: '800' }}>{t('Crop calendar', 'Kalendaryo ng pananim')}</Text><Text style={{ color: colors.subText, marginTop: 3 }}>{t('Plan your harvest and fertilizer tasks', 'Planuhin ang ani at paglalagay ng pataba')}</Text></View>
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {zones.map(item => <TouchableOpacity key={item.id} accessibilityRole="button" accessibilityState={{ selected: zoneId === item.id }} disabled={busy} onPress={() => void setActiveZoneId(item.id)} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: zoneId === item.id ? colors.primary : colors.border, backgroundColor: zoneId === item.id ? colors.primary : colors.cardBg }}><Text style={{ color: zoneId === item.id ? '#FFFFFF' : colors.text, fontWeight: '600' }}>{t(item.name_en, item.name_tl)}</Text></TouchableOpacity>)}
    </View>
    <Text style={{ color: colors.subText }}>{zone?.current_crop ? `${zone.current_crop} | ${t('Planted', 'Itinanim')}: ${zone.planted_on ?? t('Date missing', 'Walang petsa')}` : t('Record a planted crop and planting date on Home to add tasks.', 'Itala ang pananim at petsa ng pagtatanim sa Home para magdagdag ng gawain.')}</Text>
    {deviceOnly && <View style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.warning, gap: 6 }}><Text style={{ color: colors.text, fontWeight: '700' }}>{t('Saved on this device', 'Naka-save sa device na ito')}</Text><Text style={{ color: colors.subText }}>{t('Calendar cloud setup is pending. Your dates stay here and sync when it is ready. Push reminders need cloud setup.', 'Hindi pa handa ang cloud calendar. Nananatili rito ang mga petsa at isi-sync kapag handa na. Kailangan ng cloud setup para sa push reminders.')}</Text>{button(t('Check cloud sync', 'Suriin ang cloud sync'), async () => { if (store) apply(await store.load()); })}</View>}
    <View style={{ padding: 12, borderRadius: 22, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.cardBg }}>
      <CropMonthView key={date.slice(0, 7)} value={date} plantedOn={zone?.current_crop ? zone.planted_on : null} onChange={value => { setDate(value); setShowAll(false); }} events={[...events, ...previewEvents]} />
    </View>
    <View style={{ padding: 16, borderRadius: 18, borderWidth: 1, borderColor: colors.border, gap: 12 }}>
      <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>{new Date(`${date}T12:00:00`).toLocaleDateString(language === 'tagalog' ? 'fil-PH' : 'en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
      {zone?.current_crop && date === zone.planted_on && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Ionicons name="leaf-outline" size={18} color={colors.greenText} /><Text style={{ color: colors.text, fontWeight: '700', flex: 1 }}>{t(`${zone.current_crop} planted on this day`, `Itinanim ang ${zone.current_crop} sa araw na ito`)}</Text></View>}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['harvest', 'fertilizer'] as const).map(value => <TouchableOpacity key={value} accessibilityRole="button" accessibilityState={{ selected: kind === value }} onPress={() => setKind(value)} style={{ flex: 1, padding: 12, flexDirection: 'row', gap: 7, justifyContent: 'center', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: kind === value ? colors.primary : colors.border, backgroundColor: kind === value ? colors.primary : colors.bg }}><Ionicons name={value === 'harvest' ? 'basket-outline' : 'leaf-outline'} size={18} color={kind === value ? '#FFFFFF' : colors.text} /><Text style={{ color: kind === value ? '#FFFFFF' : colors.text }}>{value === 'harvest' ? t('Harvest', 'Ani') : t('Fertilizer', 'Pataba')}</Text></TouchableOpacity>)}
      </View>
      {button(editing ? t('Save changes', 'I-save ang pagbabago') : t('Add task on this date', 'Magdagdag ng gawain sa petsang ito'), () => save([{ kind, date }], 'manual'), !canSave, true)}
      {editing && button(t('Cancel edit', 'Kanselahin'), async () => { setEditing(null); })}
      {button(t('Suggest dates with AI', 'Magmungkahi ng petsa gamit ang AI'), predict, !canSave)}
    </View>
    {draft && <View style={{ padding: 16, borderRadius: 18, borderWidth: 1, borderColor: colors.primary, gap: 10 }}>
      <Text style={{ color: colors.greenText, fontWeight: '800', fontSize: 17 }}>{t('AI preview on calendar', 'AI preview sa kalendaryo')}</Text>
      <Text style={{ color: colors.text }}>{t('Estimated harvest', 'Tantyang ani')}: {draft.harvest_date}{'\n'}{t('Fertilizer review dates', 'Mga petsa ng pagsusuri ng pataba')}: {draft.fertilizer_dates.join(', ') || '-'}</Text>
      <Text style={{ color: colors.subText }}>{draft.explanation}</Text>
      <Text style={{ color: colors.subText }}>{t('These dates are estimates. Check your variety and field conditions before saving.', 'Tantiya lamang ang mga petsa. Suriin ang barayti at kondisyon ng bukid bago i-save.')}</Text>
      {button(t('Save suggested dates', 'I-save ang mungkahi'), () => save([{ kind: 'harvest', date: draft.harvest_date }, ...draft.fertilizer_dates.map(value => ({ kind: 'fertilizer' as const, date: value }))], 'ai'), false, true)}
      {button(t('Discard preview', 'Alisin ang preview'), async () => { setDraft(null); })}
    </View>}
    {busy && <Text style={{ color: colors.subText }}>{t('Working...', 'Pinoproseso...')}</Text>}
    {!!message && <Text accessibilityRole="alert" style={{ color: colors.text, lineHeight: 20 }}>{message}</Text>}
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>{showAll ? t('All saved tasks', 'Lahat ng naka-save na gawain') : t('Tasks for this date', 'Gawain sa petsang ito')}</Text><TouchableOpacity accessibilityRole="button" onPress={() => setShowAll(value => !value)} style={{ paddingVertical: 10 }}><Text style={{ color: colors.greenText, fontWeight: '700' }}>{showAll ? t('Selected day', 'Napiling araw') : t('View all', 'Tingnan lahat')}</Text></TouchableOpacity></View>
    {loading ? <Text style={{ color: colors.subText }}>{t('Loading dates...', 'Kinukuha ang mga petsa...')}</Text> : visibleEvents.length === 0 ? <View style={{ padding: 20, alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: colors.border, gap: 8 }}><Ionicons name="calendar-clear-outline" size={30} color={colors.mutedText} /><Text style={{ color: colors.subText }}>{t('No tasks here yet. Tap a day to add one.', 'Wala pang gawain dito. Pumili ng araw para magdagdag.')}</Text></View> : visibleEvents.map(event => <View key={event.id} style={{ borderWidth: 1, borderLeftWidth: 4, borderColor: colors.border, borderLeftColor: event.kind === 'harvest' ? HARVEST_COLOR : FERTILIZER_COLOR, borderRadius: 14, padding: 14, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}><Ionicons name={event.completed ? 'checkmark-circle' : event.kind === 'harvest' ? 'basket-outline' : 'leaf-outline'} size={22} color={event.kind === 'harvest' ? HARVEST_COLOR : FERTILIZER_COLOR} /><View style={{ flex: 1 }}><Text style={{ color: colors.text, fontWeight: '800', textDecorationLine: event.completed ? 'line-through' : 'none' }}>{event.crop} - {event.kind === 'harvest' ? t('Harvest', 'Ani') : t('Fertilizer', 'Pataba')}</Text><Text style={{ color: colors.subText, marginTop: 3 }}>{event.event_date}{event.completed ? ` | ${t('Done', 'Tapos')}` : event.event_date < localDate() ? ` | ${t('Overdue', 'Lampas na')}` : ''}{event.source === 'ai' ? ' | AI' : ''}</Text></View></View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {button(t('Edit', 'Baguhin'), async () => { setEditing(event); setDate(event.event_date); setKind(event.kind); })}
        {button(event.completed ? t('Reopen', 'Buksan muli') : t('Mark done', 'Tapos na'), async () => { if (store) apply(await store.complete(event)); })}
        {button(t('Remove', 'Alisin'), async () => { if (store) apply(await store.remove(event)); if (editing?.id === event.id) setEditing(null); })}
      </View>
    </View>)}
    <View style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: 16, gap: 10 }}>
      <Text style={{ color: colors.text, fontWeight: '800' }}>{t('Reminder settings', 'Mga setting ng paalala')}</Text>
      {button(t('Enable push alerts', 'I-enable ang push alerts'), async () => { if (!user) throw new Error('Sign in first.'); await enablePushNotifications(user.id, language, zones.map(z => z.id)); setMessage(t('Push alerts enabled.', 'Naka-enable ang push alerts.')); }, deviceOnly)}
      {button(t('Disable alerts on this device', 'I-disable ang alerts sa device'), async () => { await disablePushNotifications(); setMessage(t('Push alerts disabled.', 'Naka-disable ang push alerts.')); })}
    </View>
  </View>;
}

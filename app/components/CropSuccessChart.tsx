import { useApp } from '@/app/lib/AppContext';
import { useThemeColors } from '@/app/lib/useThemeColors';
import { supabase } from '@/lib/supabaseClient';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';

type Outcome = { crop: string; successful: boolean };

export default function CropSuccessChart() {
  const { activeZoneId, zones, t, fontScale } = useApp();
  const colors = useThemeColors();
  const zone = zones.find(item => item.id === activeZoneId);
  // A zone change remounts the data view and clears the previous zone's results.
  return <View>{zone ? <ZoneSuccess key={zone.id} zoneId={zone.id} crop={zone.current_crop ?? ''} /> : <Text style={{ color: colors.subText, fontSize: 14 * fontScale }}>{t('Select a zone on the dashboard first.', 'Pumili muna ng sona sa dashboard.')}</Text>}</View>;
}

function ZoneSuccess({ zoneId, crop }: { zoneId: number; crop: string }) {
  const { t, fontScale } = useApp();
  const colors = useThemeColors();
  const [rows, setRows] = useState<Outcome[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await supabase.from('crop_outcomes').select('crop, successful').eq('zone_id', zoneId);
      if (result.error) throw result.error;
      setRows(result.data ?? []); setError(false);
    } catch { setError(true); }
    finally { setLoading(false); }
  }, [zoneId]);
  useEffect(() => { void load(); }, [load]);
  const record = (successful: boolean) => {
    Alert.alert(t('Record completed growing cycle?', 'Itala ang natapos na pagtatanim?'), t(`Record ${crop.replace(/_/g, ' ')} as ${successful ? 'successful' : 'unsuccessful'} only once per completed cycle. Successful means it produced a usable harvest.`, `Itala ang ${crop.replace(/_/g, ' ')} bilang ${successful ? 'matagumpay' : 'hindi matagumpay'} nang isang beses lamang bawat natapos na pagtatanim. Matagumpay kapag may napakinabangang ani.`), [
      { text: t('Cancel', 'Kanselahin'), style: 'cancel' },
      { text: t('Save result', 'I-save ang resulta'), onPress: () => { void (async () => {
        setSaving(true);
        try {
          const result = await supabase.from('crop_outcomes').insert({ zone_id: zoneId, crop, successful });
          if (result.error) throw result.error;
          await load();
        } catch { Alert.alert(t('Unable to save result', 'Hindi ma-save ang resulta'), t('Check your connection and database setup, then try again.', 'Suriin ang koneksyon at database setup, at subukan muli.')); }
        finally { setSaving(false); }
      })(); } },
    ]);
  };
  const groups = new Map<string, { total: number; success: number }>();
  for (const row of rows) {
    const group = groups.get(row.crop) ?? { total: 0, success: 0 };
    group.total++; if (row.successful) group.success++;
    groups.set(row.crop, group);
  }
  return <View style={{ padding: 16, gap: 16 }}>
    <Text style={{ color: colors.subText, fontSize: 13 * fontScale, lineHeight: 20 * fontScale }}>{t('Success rate = completed cycles with a usable harvest ÷ all recorded completed cycles × 100. Results are farmer-reported for this zone, not predictions. Small samples may be misleading.', 'Success rate = natapos na pagtatanim na may napakinabangang ani ÷ lahat ng naitalang natapos na pagtatanim × 100. Iniulat ng magsasaka para sa sonang ito; hindi hula. Maaaring mapanlinlang ang kaunting datos.')}</Text>
    {loading ? <Text style={{ color: colors.subText }}>{t('Loading results...', 'Naglo-load ng resulta...')}</Text> : error ? <>
      <Text accessibilityRole="alert" style={{ color: colors.subText }}>{t('Unable to load harvest results. Check your connection and make sure the crop outcomes database migration has been applied.', 'Hindi makuha ang resulta ng ani. Suriin ang koneksyon at tiyaking nailapat ang crop outcomes migration sa database.')}</Text>
      <TouchableOpacity accessibilityRole="button" onPress={() => { void load(); }}><Text style={{ color: colors.greenText }}>{t('Retry', 'Subukan muli')}</Text></TouchableOpacity>
    </> : groups.size === 0 ? <Text style={{ color: colors.subText }}>{t('No completed cycles recorded for this zone. Record a harvest result to start the graph.', 'Wala pang naitalang natapos na pagtatanim sa sonang ito. Magtala ng resulta ng ani para simulan ang graph.')}</Text> : [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([name, group]) => {
      const rate = group.success / group.total * 100;
      return <View key={name} accessible accessibilityLabel={`${name}: ${rate.toFixed(1)}%, ${group.success}/${group.total}`}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 * fontScale, textTransform: 'capitalize' }}>{name.replace(/_/g, ' ')} · {rate.toFixed(1)}%</Text>
        <View style={{ height: 18, borderRadius: 9, overflow: 'hidden', backgroundColor: colors.progressTrack, marginVertical: 8 }}><View style={{ height: 18, width: `${rate}%`, backgroundColor: colors.primary }} /></View>
        <Text style={{ color: colors.subText }}>{group.success}/{group.total} {t('completed cycles successful', 'matagumpay na natapos na pagtatanim')}</Text>
      </View>;
    })}
    {!!crop && !error && !loading && <>
      <Text style={{ color: colors.text, fontWeight: '700' }}>{t('Record harvest result', 'Itala ang resulta ng ani')}: {crop.replace(/_/g, ' ')}</Text>
      {[true, false].map(success => <TouchableOpacity key={String(success)} accessibilityRole="button" disabled={saving} onPress={() => record(success)} style={{ padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder, opacity: saving ? 0.5 : 1 }}><Text style={{ color: colors.greenText }}>{success ? t('Usable harvest', 'May napakinabangang ani') : t('No usable harvest', 'Walang napakinabangang ani')}</Text></TouchableOpacity>)}
    </>}
  </View>;
}

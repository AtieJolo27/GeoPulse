import { supabase } from '@/lib/supabaseClient';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useApp } from '@/app/lib/AppContext';
import { useThemeColors } from '@/app/lib/useThemeColors';
import { getApiUrl } from '@/lib/apiConfig';
import { Ionicons } from '@expo/vector-icons';

interface SoilData {
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  ph: number;
  air_temperature: number;
  humidity: number;
}

const REFERENCE_LINKS = [
  {
    label: 'DA-BSWM FertMap — crop-specific soil guidance',
    url: 'https://nshp.bswm.da.gov.ph/fertmap/',
  },
  {
    label: 'DA-BSWM National Soil Health Program',
    url: 'https://nshp.bswm.da.gov.ph/',
  },
  {
    label: 'FAO — Soil fertility guidance',
    url: 'https://www.fao.org/global-soil-partnership/areas-of-work/soil-fertility/en/',
  },
];

export default function Reasoning() {
  const { t, language, fontScale } = useApp();
  const colors = useThemeColors();
  const { fertilizer } = useLocalSearchParams<{ fertilizer: string }>();
  const fs = (size: number) => Math.round(size * fontScale);

  const [soilData, setSoilData] = useState<SoilData | null>(null);
  const [aiResponse, setAiResponse] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const assessmentText = aiResponse.split(/\bReferences\s*:/i)[0]?.trim();

  function openReference(url: string) {
    void Linking.openURL(url).catch(() => {
      setAiError('Unable to open this reference on this device.');
    });
  }

  useEffect(() => {
    getLatestSoil();
  }, []);

  useEffect(() => {
    if (soilData && fertilizer) {
      askGroqAutomatically(fertilizer, soilData);
    }
  }, [soilData, fertilizer, language]);

  async function getLatestSoil() {
    try {
      setFetchError(null);
      setLoadingData(true);

      const { data, error } = await supabase
        .from('crop_predictions')
        .select('nitrogen, phosphorus, potassium, ph, air_temperature, humidity')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      setSoilData(data);
    } catch (err: any) {
      console.warn('Supabase error:', err);
      setFetchError(err.message || 'Failed to load soil data');
    } finally {
      setLoadingData(false);
    }
  }

  async function askGroqAutomatically(targetFertilizer: string, data: SoilData) {
    setLoadingAI(true);
    setAiResponse('');
    setAiError(null);

    const responseLanguage =
      language === 'tagalog'
        ? `Respond entirely in Tagalog (Filipino). Use Filipino farming terms where appropriate.`
        : `Respond entirely in English.`;

    const dynamicPrompt = `
      Give a simple fertilizer recommendation for ${targetFertilizer} using these soil conditions:
      - Nitrogen (N): ${data.nitrogen}
      - Phosphorus (P): ${data.phosphorus}
      - Potassium (K): ${data.potassium}
      - pH level: ${data.ph}
      - Air Temperature: ${data.air_temperature}°C
      - Humidity: ${data.humidity}%
      
      State whether using it is advisable and explain the main reason from these readings. Recommend practical ways to maintain soil nutrients and crop health now, before consulting a local DA agricultural technician for crop-specific fertilizer rates. Write formally but in simple farmer-friendly language. Do not give an exact application rate.
      
      CRITICAL: ${responseLanguage} Do NOT provide bilingual or dual-language responses. Use ONLY the specified language. Don't change terms that have no direct translation such as phosphorus, nitrogen, potassium, pH.
    `;

    try {
      const apiUrl = getApiUrl('/api/groq');

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: dynamicPrompt }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || `API error: ${res.status}`);
      }

      setAiResponse(json.data || 'No explanation returned.');
    } catch (err: any) {
      console.warn(err);
      setAiError(err.message || 'Failed to reach AI backend.');
      setAiResponse('');
    } finally {
      setLoadingAI(false);
    }
  }

  // Loading state for initial data fetch
  if (loadingData) {
    return (
      <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ fontSize: fs(14), marginTop: 16, color: colors.subText }}>
          {t('Loading soil data...', 'Naglo-load ng datos ng lupa...')}
        </Text>
      </ScrollView>
    );
  }

  // Error state for data fetch
  if (fetchError) {
    return (
      <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.bg }]}>
        <Ionicons name="cloud-offline-outline" size={48} color={colors.mutedText} />
        <Text style={{ fontSize: fs(18), fontWeight: 'bold', marginTop: 16, textAlign: 'center', color: colors.text }}>
          {t('Error Loading Data', 'Error sa Pag-load ng Datos')}
        </Text>
        <Text style={{ fontSize: fs(14), marginTop: 8, textAlign: 'center', color: colors.subText }}>
          {fetchError}
        </Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={{ fontSize: fs(24), fontWeight: 'bold', marginBottom: 20, textTransform: 'capitalize', color: colors.text }}>
        {fertilizer}
      </Text>

      {soilData && (
        <View
          className="w-full rounded-xl p-4 mb-4"
          style={{ backgroundColor: colors.soilCardBg, borderColor: colors.soilCardBorder, borderWidth: 1 }}
        >
          <Text style={{ fontWeight: 'bold', fontSize: fs(18), marginBottom: 8, color: colors.text }}>
            {t('Current Soil Status', 'Kasalukuyang Katayuan ng Lupa')}
          </Text>

          <Text style={{ fontSize: fs(14), color: colors.subText }}>
            N: {soilData.nitrogen} | P: {soilData.phosphorus} | K: {soilData.potassium} | pH: {soilData.ph}
          </Text>

          <Text style={{ fontSize: fs(14), color: colors.subText }}>
            {t('Temp', 'Temp')}: {soilData.air_temperature}°C | {t('Humidity', 'Halumigmig')}: {soilData.humidity}%
          </Text>
        </View>
      )}

      <View
        className="w-full rounded-xl p-4"
        style={{
          backgroundColor: colors.isDarkMode ? '#2D1F14' : '#FFF7ED',
          borderColor: colors.isDarkMode ? '#4A2D1A' : '#FFEDD5',
          borderWidth: 1,
        }}
      >
        <Text
          style={{ fontWeight: 'bold', fontSize: fs(18), marginBottom: 8, color: colors.isDarkMode ? '#FDBA74' : '#9A3412' }}
        >
          ✨ {t('AI Suitability Analysis', 'Pagsusuri ng Kaangkupan ng AI')}
        </Text>

        {loadingAI ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ marginLeft: 10, fontSize: fs(13), color: colors.subText }}>
              {t('Analyzing soil nutrient fit...', 'Sinusuri ang akma ng nutrisyon ng lupa...')}
            </Text>
          </View>
        ) : aiError ? (
          <View>
            <Text style={{ fontSize: fs(16), lineHeight: 24, color: '#DC2626' }}>
              {t('AI analysis unavailable.', 'Hindi available ang pagsusuri ng AI.')}
            </Text>
            <Text style={{ fontSize: fs(14), marginTop: 8, color: colors.subText }}>
              {aiError}
            </Text>
          </View>
        ) : aiResponse ? (
          <View>
            <Text style={{ fontSize: fs(16), lineHeight: 24, color: colors.subText }}>
              {assessmentText}
            </Text>

            <Text style={{ marginTop: 16, marginBottom: 6, fontWeight: '700', fontSize: fs(14), color: colors.text }}>
              {t('Sources — tap to open', 'Mga Sanggunian — pindutin upang buksan')}
            </Text>
            {REFERENCE_LINKS.map((reference) => (
              <Pressable
                key={reference.url}
                onPress={() => openReference(reference.url)}
                accessibilityRole="link"
                accessibilityLabel={`${reference.label}. Opens in browser.`}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 7,
                  opacity: pressed ? 0.65 : 1,
                })}
              >
                <Ionicons name="open-outline" size={16} color={colors.primary} />
                <Text style={{ marginLeft: 7, fontSize: fs(14), color: colors.primary, textDecorationLine: 'underline' }}>
                  [{REFERENCE_LINKS.indexOf(reference) + 1}] {reference.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={{ fontSize: fs(16), lineHeight: 24, color: colors.subText }}>
            {t('Awaiting metrics to analyze...', 'Naghihintay ng sukatan para suriin...')}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, alignItems: 'center' },
  loadingContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
});

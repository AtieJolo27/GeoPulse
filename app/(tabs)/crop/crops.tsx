import BestCrop from '@/app/components/BestCrop';
import Recommended_Crops from '@/app/components/RecommendedCrops';
import { useApp } from '@/app/lib/AppContext';
import { useThemeColors } from '@/app/lib/useThemeColors';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { CACHE_KEYS, getCache, setCache } from '../../../lib/cache';
import { supabase } from '../../../lib/supabaseClient';

interface CropRecommendation {
  crop: string;
  confidence: number;
}

interface CropPrediction {
  id: number;
  best_crop: string;
  recommendations: CropRecommendation[];
  [key: string]: any;
}

export default function Crops() {
  const { t, fontScale } = useApp();
  const colors = useThemeColors();
  const fs = (size: number) => Math.round(size * fontScale);
  const [crops, setCrops] = useState<CropPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const getCrops = useCallback(async () => {
    try {
      setError(null);

      // Try cache first
      const cached = await getCache<CropPrediction[]>(CACHE_KEYS.CROP_PREDICTIONS);
      if (cached && cached.length > 0) {
        setCrops(cached);
        setLoading(false);
      }

      const { data, error: fetchError } = await supabase
        .from('crop_predictions')
        .select()
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      const fetched = data ?? [];
      setCrops(fetched);

      // Update cache in background
      if (fetched.length > 0) {
        await setCache(CACHE_KEYS.CROP_PREDICTIONS, fetched);
      }
    } catch (err: any) {
      console.warn('getCrops error:', err);
      setError(err.message || 'Failed to fetch crop recommendations');
      // Keep stale cache if available
      if (crops.length === 0) {
        const cached = await getCache<CropPrediction[]>(CACHE_KEYS.CROP_PREDICTIONS);
        if (cached) {
          setCrops(cached);
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    getCrops();

    const channel = supabase
      .channel('crop_predictions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crop_predictions' },
        (payload) => {
          console.log('Changes Detected', payload);
          getCrops();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [getCrops]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    getCrops();
  }, [getCrops]);

  // Loading state
  if (loading && crops.length === 0) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ fontSize: fs(14), marginTop: 16, color: colors.subText }}>
          {t('Loading crop recommendations...', 'Naglo-load ng mga rekomendasyon sa pananim...')}
        </Text>
      </View>
    );
  }

  // Error state
  if (error && crops.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: colors.bg }}>
        <Ionicons name="alert-circle-outline" size={64} color="#DC2626" />
        <Text style={{ fontSize: fs(18), fontWeight: 'bold', marginTop: 16, textAlign: 'center', color: colors.text }}>
          {t('Error Loading Crops', 'Error sa Pag-load ng mga Pananim')}
        </Text>
        <Text style={{ fontSize: fs(14), marginTop: 8, textAlign: 'center', color: colors.subText }}>
          {error}
        </Text>
        <TouchableOpacity
          onPress={getCrops}
          className="mt-6 rounded-xl py-3 px-8"
          style={{ backgroundColor: colors.primary }}
        >
          <Text style={{ fontWeight: 'bold', fontSize: fs(14), color: '#F0FDF4' }}>
            {t('Retry', 'Subukan Muli')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Empty state
  if (crops.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: colors.bg }}>
        <Ionicons name="leaf-outline" size={64} color={colors.greenText} />
        <Text style={{ fontSize: fs(18), fontWeight: 'bold', marginTop: 16, textAlign: 'center', color: colors.text }}>
          {t('No Recommendations Yet', 'Wala Pang Rekomendasyon')}
        </Text>
        <Text style={{ fontSize: fs(14), marginTop: 8, textAlign: 'center', color: colors.subText }}>
          {t(
            'Submit soil sensor readings to get crop recommendations.',
            'Magsumite ng mga pagbasa ng sensor ng lupa para makakuha ng mga rekomendasyon sa pananim.'
          )}
        </Text>
      </View>
    );
  }

  const latest = crops[0];

  const sortedRecs = [...(latest?.recommendations ?? [])]
    .filter((r) => r.confidence > 0)
    .sort((a, b) => b.confidence - a.confidence);

  const bestRec = sortedRecs[0];
  const otherRecs = sortedRecs.slice(1);

  return <FlatList
    data={otherRecs}
    keyExtractor={(item) => item.crop}
    renderItem={({ item }) => <Recommended_Crops crop_name={item.crop} percentage={Math.round(item.confidence)} fontScale={fontScale} />}
    style={{ backgroundColor: colors.bg }}
    contentContainerStyle={{ padding: 20, paddingBottom: 110 }}
    ListHeaderComponent={<>
      <Text style={{ fontSize: fs(14), color: colors.subText }}>Crop guide</Text>
      <Text style={{ fontSize: fs(24), fontWeight: '800', color: colors.text, marginTop: 2, marginBottom: 16 }}>{t('What should you plant?', 'Ano ang dapat ninyong itanim?')}</Text>
      {latest && bestRec ? <BestCrop crop_name={latest.best_crop} percentage={Math.round(bestRec.confidence)} fontScale={fontScale} /> : null}
      <View className="mt-6 mb-2"><Text style={{ fontSize: fs(18), fontWeight: '800', color: colors.text }}>{t('Other suitable crops', 'Iba pang angkop na pananim')}</Text></View>
    </>}
    ListEmptyComponent={<Text style={{ color: colors.subText, textAlign: 'center', paddingVertical: 16 }}>{t('No other crop recommendations yet.', 'Wala pang ibang rekomendasyon sa pananim.')}</Text>}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary, colors.primaryLight]} />}
  />;
}


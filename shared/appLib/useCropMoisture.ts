import { useEffect, useState } from 'react';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import { parseCropMoisture, findCropMoisture, type CropMoistureRange } from '@/lib/cropMoisture';

let pending: Promise<CropMoistureRange[]> | null = null;
function loadRanges() {
  if (!pending) pending = (async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const asset = Asset.fromModule(require('../../backend/app/machine_learning/datasets/crop_recommendation_dataset_ph_full.csv'));
    await asset.downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    let text: string;
    if (Platform.OS === 'web') {
      const response = await fetch(uri);
      if (!response.ok) throw new Error('Unable to load moisture dataset');
      text = await response.text();
    } else text = await new File(uri).text();
    return parseCropMoisture(text);
  })().catch(error => { pending = null; throw error; });
  return pending;
}

export function useCropMoisture(crop?: string | null, soilType?: string | null) {
  const [state, setState] = useState<{ rows: CropMoistureRange[] | null; failed: boolean }>({ rows: null, failed: false });
  useEffect(() => {
    let active = true;
    void loadRanges().then(rows => { if (active) setState({ rows, failed: false }); }).catch(() => { if (active) setState({ rows: null, failed: true }); });
    return () => { active = false; };
  }, []);
  return { range: findCropMoisture(state.rows ?? [], crop, soilType), loading: !state.rows && !state.failed, failed: state.failed };
}

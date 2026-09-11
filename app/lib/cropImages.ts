import { ImageSourcePropType } from 'react-native';

// Bundled assets keep recommendation images available when the device is offline.
const cropFallback = require('../../assets/images/crops/default.jpg');
const fertilizerFallback = require('../../assets/images/fertilizers/default.jpg');

export const CROP_IMAGES: Record<string, ImageSourcePropType> = {
  apple: require('../../assets/images/crops/apple.jpg'),
  banana: require('../../assets/images/crops/banana.jpg'),
  blackgram: require('../../assets/images/crops/blackgram.jpg'),
  chickpea: cropFallback,
  coconut: require('../../assets/images/crops/coconut.jpg'),
  coffee: require('../../assets/images/crops/coffee.jpg'),
  cotton: cropFallback,
  grapes: cropFallback,
  jute: cropFallback,
  kidneybeans: cropFallback,
  lentil: cropFallback,
  maize: require('../../assets/images/crops/maize.jpg'),
  mango: require('../../assets/images/crops/mango.jpg'),
  mothbeans: require('../../assets/images/crops/mothbeans.jpg'),
  mungbean: cropFallback,
  muskmelon: require('../../assets/images/crops/muskmelon.jpg'),
  orange: require('../../assets/images/crops/orange.jpg'),
  papaya: cropFallback,
  pigeonpeas: cropFallback,
  pomegranate: cropFallback,
  rice: require('../../assets/images/crops/rice.jpg'),
  watermelon: cropFallback,
  default: cropFallback,
};

export const FERTILIZER_IMAGES: Record<string, ImageSourcePropType> = {
  urea: require('../../assets/images/fertilizers/urea.jpg'),
  dap: require('../../assets/images/fertilizers/dap.jpg'),
  '14-14-14': require('../../assets/images/fertilizers/14-14-14.jpg'),
  '20-0-0': require('../../assets/images/fertilizers/20-0-0.jpg'),
  '16-20-0': require('../../assets/images/fertilizers/16-20-0.jpg'),
  'muriate of potash': require('../../assets/images/fertilizers/muriate-of-potash.jpg'),
  'single superphosphate': require('../../assets/images/fertilizers/single-superphosphate.jpg'),
  compost: require('../../assets/images/fertilizers/compost.jpg'),
  default: fertilizerFallback,
};

export function getCropImage(name: string): ImageSourcePropType {
  return CROP_IMAGES[name.toLowerCase().trim()] ?? CROP_IMAGES.default;
}

export function getFertilizerImage(name: string): ImageSourcePropType {
  return FERTILIZER_IMAGES[name.toLowerCase().trim()] ?? FERTILIZER_IMAGES.default;
}

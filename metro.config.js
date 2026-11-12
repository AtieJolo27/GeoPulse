const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');
 
const config = getDefaultConfig(__dirname)
config.resolver.assetExts.push('csv');
module.exports = withNativeWind(config, { input: './app/global.css' })
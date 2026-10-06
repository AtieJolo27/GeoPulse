const { withAndroidManifest } = require('expo/config-plugins');

// The ESP32 provisioning endpoints use HTTP on the local Wi-Fi network.
module.exports = function withSensorHttp(config) {
  return withAndroidManifest(config, config => {
    const application = config.modResults.manifest.application?.[0];
    if (!application) throw new Error('Android application manifest is missing');
    application.$['android:usesCleartextTraffic'] = 'true';
    return config;
  });
};
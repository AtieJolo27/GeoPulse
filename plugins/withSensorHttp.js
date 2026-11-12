const { withAndroidManifest } = require('expo/config-plugins');

// Sensors serve HTTP on a router-assigned LAN address or their setup AP.
module.exports = function withSensorHttp(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (!application) throw new Error('Android application manifest is missing');
    application.$['android:usesCleartextTraffic'] = 'true';
    return config;
  });
};

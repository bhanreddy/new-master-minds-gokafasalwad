const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withManifestMerger(config) {
    return withAndroidManifest(config, (config) => {
        const androidManifest = config.modResults.manifest;

        // Ensure xmlns:tools exists
        if (!androidManifest.$['xmlns:tools']) {
            androidManifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
        }

        const application = androidManifest.application[0];
        if (application['meta-data']) {
            const colorMeta = application['meta-data'].find(
                (item) => item.$['android:name'] === 'com.google.firebase.messaging.default_notification_color'
            );

            if (colorMeta) {
                colorMeta.$['tools:replace'] = 'android:resource';
            }
        }

        return config;
    });
};

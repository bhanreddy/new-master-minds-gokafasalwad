const { withProjectBuildGradle } = require('@expo/config-plugins');

module.exports = function withNotifee(config) {
    return withProjectBuildGradle(config, (config) => {
        if (!config.modResults.contents.includes('@notifee/react-native/android/libs')) {
            config.modResults.contents = config.modResults.contents.replace(
                /allprojects\s*{\s*repositories\s*{/,
                `allprojects {\n  repositories {\n    maven { url "$rootDir/../node_modules/@notifee/react-native/android/libs" }`
            );
        }
        return config;
    });
};

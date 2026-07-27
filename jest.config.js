module.exports = {
    preset: 'jest-expo',
    setupFiles: ['./jest.setup.js'],
    // driverLocationMath.test.ts is written against Node's built-in test
    // runner (`node --test`), not Jest, so Jest cannot collect it.
    testPathIgnorePatterns: ['/node_modules/', 'src/services/driverLocationMath.test.ts'],
    transformIgnorePatterns: [
        'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@react-native/.*|react-native-reanimated|expo-router)'
    ],
};

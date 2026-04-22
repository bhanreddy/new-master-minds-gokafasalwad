module.exports = function (api) {
    api.cache(true);
    return {
        presets: [
            [
                'babel-preset-expo',
                {
                    web: { worklets: false, decorators: false },
                    native: { worklets: false, decorators: false },
                },
            ],
        ],
        plugins: [
            '@babel/plugin-transform-flow-strip-types',
            ['@babel/plugin-proposal-decorators', { legacy: true }],
            ['@babel/plugin-transform-class-properties', { loose: true }],
            ['@babel/plugin-transform-private-methods', { loose: true }],
            ['@babel/plugin-transform-private-property-in-object', { loose: true }],
            'react-native-worklets/plugin',
        ],
        env: {
            production: {
                plugins: ['transform-remove-console'],
            },
        },
    };
};

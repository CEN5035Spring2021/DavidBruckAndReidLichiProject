module.exports = function(api) {
    api.cache(true);

    return {
        exclude: [
            'node_modules/@babel/**',
            'node_modules/core-js/**',
            'node_modules/@microsoft/signalr/**'
        ],
        presets: [
            [
                '@babel/preset-env',
                {
                    corejs: {
                        version: '3',
                        proposals: true
                    },
                    useBuiltIns: 'usage'
                }
            ]
        ],
        plugins: [
            '@babel/proposal-class-properties',
            '@babel/proposal-object-rest-spread',
            '@babel/plugin-transform-regenerator',
            '@babel/plugin-syntax-dynamic-import',
            '@babel/plugin-transform-arrow-functions',
            [
                '@babel/plugin-transform-for-of',
                {
                    loose: true
                }
            ]
        ]
    };
};

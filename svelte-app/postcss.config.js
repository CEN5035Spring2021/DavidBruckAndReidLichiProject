const POSTCSS_STAGE = 3;
module.exports = {
    plugins: {
        'postcss-preset-env': {
            autoprefixer: {
                flexbox: 'no-2009'
            },
            stage: POSTCSS_STAGE,
            features: {
                'custom-properties': false
            }
        }
    }
};

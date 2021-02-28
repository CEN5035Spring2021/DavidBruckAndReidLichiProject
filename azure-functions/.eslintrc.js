module.exports = {
    root: true,
    extends: [
        '../.eslintrc.js'
    ],
    parserOptions: {
        project: [
            './azure-functions/tsconfig.json'
        ]
    },
    env: {
        es6: true
    }
};

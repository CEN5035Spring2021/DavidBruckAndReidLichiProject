module.exports = {
    root: true,
    extends: [
        '../.eslintrc.js'
    ],
    parserOptions: {
        project: [
            './svelte-app-tests/tsconfig.json'
        ]
    }
};

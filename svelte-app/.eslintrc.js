module.exports = {
    root: true,
    extends: [
        '../.eslintrc.js'
    ],
    parserOptions: {
        project: [
            './svelte-app/tsconfig.json'
        ],
        extraFileExtensions: [
            '.svelte'
        ]
    }
};

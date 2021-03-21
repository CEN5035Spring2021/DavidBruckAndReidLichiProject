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
    },
    rules: {
        'no-magic-numbers': [
            'error',
            {
                ignore: [
                    1
                ],
                ignoreArrayIndexes: true,
                detectObjects: true
            }
        ],
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': 'off'
    }
};

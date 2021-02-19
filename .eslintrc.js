module.exports = {
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:@typescript-eslint/recommended-requiring-type-checking'
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        tsconfigRootDir: __dirname
    },
    env: {
        node: true,
        browser: true,
        es2020: true
    },
    plugins: [
        'svelte3',
        '@typescript-eslint'
    ],
    rules: {
        indent: [
            'error',
            4,
            {
                SwitchCase: 1
            }
        ],
        '@typescript-eslint/consistent-type-imports': [
            'error',
            {
                prefer: 'type-imports',
                disallowTypeAnnotations: true
            }
        ],
        eqeqeq: [
            'error',
            'smart'
        ],
        'object-curly-spacing': [
            'error',
            'always'
        ],
        'array-bracket-spacing': [
            'error',
            'always'
        ],
        'no-var': 1,
        quotes: [
            'error',
            'single',
            {
                avoidEscape: true
            }
        ],
        'quote-props': [
            'error',
            'consistent-as-needed'
        ],
        'max-len': [
            'error',
            120
        ],
        'no-eval': 'error',
        'no-magic-numbers': [
            'error',
            {
                ignore: [
                    1
                ],
                detectObjects: true
            }
        ],
        'no-trailing-spaces': 'error',
        'semi-spacing': 'error',
        semi: [
            'error',
            'always'
        ],
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': 'off'
    },
    overrides: [
        {
            files: [
                '*.ts',
                '*.json'
            ],
            extends: [
                'plugin:@typescript-eslint/recommended'
            ]
        },
        {
            files: [
                '*.svelte'
            ],
            processor: 'svelte3/svelte3'
        }
    ],
    settings: {
        'svelte3/typescript': require('typescript')
    }
  };

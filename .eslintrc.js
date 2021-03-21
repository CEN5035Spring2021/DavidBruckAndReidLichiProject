module.exports = {
    extends: [
        'eslint:recommended'
    ],
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
        'jsonc/indent': [
            'error',
            2
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
            'as-needed'
        ],
        'max-len': [
            'error',
            120
        ],
        'no-eval': 'error',
        'no-trailing-spaces': 'error',
        'semi-spacing': 'error',
        semi: [
            'error',
            'always'
        ],
        '@typescript-eslint/array-type': [
            'error',
            {
                default: 'array-simple'
            }
        ],
        '@typescript-eslint/consistent-type-assertions': [
            'error',
            {
                assertionStyle: 'as',
                objectLiteralTypeAssertions: 'allow-as-parameter'
            }
        ],
        '@typescript-eslint/member-delimiter-style': 'error',
        'comma-dangle': 'error',
        '@typescript-eslint/comma-dangle': 'error',
        'space-before-blocks': 'error',
        'block-spacing': 'error',
        '@typescript-eslint/space-infix-ops': 'error',
        '@typescript-eslint/space-before-function-paren': [
            'error',
            'never'
        ],
        '@typescript-eslint/func-call-spacing': 'error',
        '@typescript-eslint/keyword-spacing': 'error',
        '@typescript-eslint/object-curly-spacing': [
            'error',
            'always'
        ],
        '@typescript-eslint/no-unused-expressions': [
            'error',
            {
                allowShortCircuit: true,
                allowTernary: true
            }
        ],
        'no-multiple-empty-lines': [
            'error',
            {
                max: 1,
                maxBOF: 0,
                maxEOF: 0
            }
        ],
        'eol-last': 'error',
        'spaced-comment': [
            'error',
            'always',
            {
                block: {
                    markers: [
                        '!'
                    ]
                }
            }
        ],
        'capitalized-comments': [
            'error',
            'always',
            {
                line: {
                    ignoreConsecutiveComments: true
                },
                block: {
                    ignoreInlineComments: true
                }
            }
        ]
    },
    overrides: [
        {
            files: [
                '*.ts'
            ],
            parser: '@typescript-eslint/parser',
            extends: [
                'plugin:@typescript-eslint/recommended',
                'plugin:@typescript-eslint/recommended-requiring-type-checking'
            ]
        },
        {
            files: [
                '*.svelte'
            ],
            parser: '@typescript-eslint/parser',
            processor: 'svelte3/svelte3',
            extends: [
                'plugin:@typescript-eslint/recommended',
                'plugin:@typescript-eslint/recommended-requiring-type-checking'
            ]
        },
        {
            files: [
                '*.json'
            ],
            extends: [
                'plugin:jsonc/recommended-with-jsonc'
            ]
        }
    ],
    settings: {
        'svelte3/typescript': require('typescript')
    }
  };

module.exports = {
    root: true,
    extends: [
        '../.eslintrc.js'
    ],
    parserOptions: {
        project: [
            './dev-smtp-server/tsconfig.json'
        ]
    }
};

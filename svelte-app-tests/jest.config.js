// @ts-check

/** @typedef { import('@jest/types').Config.InitialOptions } InitialOptions */

/** @type { InitialOptions } */
module.exports = {
    preset: 'jest-puppeteer',
    testMatch: [
        '<rootDir>/specs/**/*.spec.ts'
    ],
    setupFilesAfterEnv: [
        '<rootDir>/jest.setup.ts'
    ],
    transform: {
        '^.+\\.ts$': 'ts-jest'
    },
    moduleDirectories: [
        'node_modules'
    ],
    moduleFileExtensions: [
        'ts',
        'js',
        'json',
        'node'
    ],
    globalSetup: '<rootDir>/config/global-setup.ts',
    globalTeardown: '<rootDir>/config/global-teardown.ts',
    globals: {
        tsConfig: '<rootDir>/tsconfig.json'
    },
    testTimeout: 120000
};

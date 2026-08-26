export default {
  displayName: 'api',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  transformIgnorePatterns: ['node_modules/(?!(jose)/)'],
  moduleNameMapper: {
    '^config$': '<rootDir>/src/test/config.mock.ts',
  },
  setupFiles: ['<rootDir>/jest.setup.js'],
  reporters: [
     'default',
     [
       'jest-junit',
       {
         outputDirectory: './test-results',
         outputName: 'junit-api.xml',
       },
     ],
   ],
};

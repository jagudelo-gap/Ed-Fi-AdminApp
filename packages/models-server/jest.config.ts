export default {
  displayName: 'models-server',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleNameMapper: {
    '^config$': '<rootDir>/src/test/config.mock.ts',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/packages/models-server',
  reporters: [
     'default',
     [
       'jest-junit',
       {
         outputDirectory: './test-results',
         outputName: 'junit-models-server.xml',
       },
     ],
   ],
};

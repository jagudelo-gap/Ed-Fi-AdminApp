export default {
  displayName: 'utils',
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/packages/utils',
  reporters: [
     'default',
     [
       'jest-junit',
       {
         outputDirectory: './test-results',
         outputName: 'junit-utils.xml',
       },
     ],
   ],
};

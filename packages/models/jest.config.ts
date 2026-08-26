export default {
  displayName: 'models',
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/packages/models',
  reporters: [
     'default',
     [
       'jest-junit',
       {
         outputDirectory: './test-results',
         outputName: 'junit-models.xml',
       },
     ],
   ],
};

export default {
  displayName: 'fe',
  preset: '../../jest.preset.js',
  transform: {
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nx/react/babel'] }],
  },
  setupFiles: ['<rootDir>/jest.setup.js'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/packages/fe',
  reporters: [
     'default',
     [
       'jest-junit',
       {
         outputDirectory: './test-results',
         outputName: 'junit-fe.xml',
       },
     ],
   ],
};

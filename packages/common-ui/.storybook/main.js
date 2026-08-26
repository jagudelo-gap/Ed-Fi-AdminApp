import { mergeConfig } from 'vite';
import path from 'path';

const config = {
  stories: ['../src/lib/**/*.@(mdx|stories.@(js|jsx|ts|tsx))'],

  addons: [
    '@storybook/addon-essentials',
    '@chakra-ui/storybook-addon',
    'storybook-addon-react-router-v6',
  ],

  framework: {
    name: '@storybook/react-vite',
    options: {},
  },

  async viteFinal(config) {
    return mergeConfig(config, {
      resolve: {
        alias: {
          '@edanalytics/utils': path.resolve(__dirname, '../../utils/src/index.ts'),
          '@edanalytics/models': path.resolve(__dirname, '../../models/src/index.ts'),
        },
      },
    });
  },

  docs: {},

  typescript: {
    reactDocgen: 'react-docgen-typescript',
  },
};

export default config;

// To customize your webpack configuration you can use the webpackFinal field.
// Check https://storybook.js.org/docs/react/builders/webpack#extending-storybooks-webpack-config
// and https://nx.dev/packages/storybook/documents/custom-builder-configs

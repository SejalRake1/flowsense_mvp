const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs'];

config.resolver.assetExts = [
  ...config.resolver.assetExts,
  'css',
];

module.exports = config;

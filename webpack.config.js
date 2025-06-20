// webpack.config.js
const webpack = require('webpack');
const { withExpo } = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await withExpo(env, argv);

  // 1) Remove any old alias entries you added
  // 2) Add this plugin to catch *all* expo-sqlite imports:
  config.plugins = [
    ...(config.plugins || []),
    new webpack.NormalModuleReplacementPlugin(
      // any import path that starts with "expo-sqlite"
      /^expo-sqlite(\/.*)?$/,
      // redirect it to the WebSQL shim
      '@expo/websql'
    ),
  ];

  return config;
};

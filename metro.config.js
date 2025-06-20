// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// 1. Let Metro resolve .wasm files as assets
config.resolver.assetExts.push('wasm');

module.exports = config;

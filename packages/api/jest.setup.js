// Ensure node-config finds the API config directory and loads testing.js overrides.
// NODE_ENV='testing' maps to config/testing.js (not 'test' which would load config/test.js if it existed).
// See packages/api/config/testing.js for unit-test overrides (fast poll settings, etc.).
process.env.NODE_CONFIG_DIR = require('path').resolve(__dirname, 'config');
process.env.NODE_ENV = 'testing';

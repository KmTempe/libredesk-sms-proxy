const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    globals: true,
    testTimeout: 10000,
    include: ['tests/**/*.test.js'],
    exclude: ['node_modules', 'client'],
  }
});

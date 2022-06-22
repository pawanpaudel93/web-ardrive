'use strict';

module.exports = {
  extension: ['ts'],
  spec: ['src/**/*.test.ts'],
  require: ['ts-node/register/transpile-only', 'source-map-support/register'],
  parallel: true,
  recursive: true,
};

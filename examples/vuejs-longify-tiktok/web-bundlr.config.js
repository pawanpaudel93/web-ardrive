const dotenv = require('dotenv');
dotenv.config();

/** @type {import('web-ardrive').WebArDriveConfig} */

const WebArDriveConfig = {
  url: 'https://devnet.bundlr.network',
  currency: 'ethereum',
  wallet: process.env.WALLET,
  folderPath: 'dist',
  config: {
    providerUrl:
      'https://rinkeby.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
  },
};

module.exports = WebArDriveConfig;

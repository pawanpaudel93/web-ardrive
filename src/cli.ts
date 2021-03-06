#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

import { AR, readJWKFile, WalletDAO } from 'ardrive-core-js';
import Arweave from 'arweave';
import { glob } from 'glob';

import { fundArLocalWallet, log, WebArDriveConfig } from './utils';
import { arDriveFactory, DEFAULT_APP_NAME, DEFAULT_APP_VERSION } from './web-ardrive';

const checkConfig = (config: WebArDriveConfig) => {
  if (!config.folderPath && typeof config.folderPath !== 'string') {
    throw new Error('folderPath must be a string in web-ardrive config file');
  }
  if (config.production && !config.parentFolderID) {
    throw new Error('parentFolderID must be set in web-ardrive config file');
  }
  if (!config.walletPath) {
    throw new Error('walletPath not specified in web-ardrive config file');
  }
  if (!config.destFolderName) {
    throw new Error('destFolderName not specified in web-ardrive config file');
  }
};

const uploadFolder = async ({
  folderPath,
  walletPath,
  parentFolderID,
  destFolderName,
  production = true,
  dryRun = false,
}: WebArDriveConfig) => {
  const config: WebArDriveConfig = { folderPath, walletPath, production, parentFolderID, destFolderName, dryRun };
  checkConfig(config);
  if (fs.existsSync(config.folderPath)) {
    try {
      const arweaveConfig = config.production
        ? {
            host: 'arweave.net',
            port: 443,
            protocol: 'https',
            timeout: 600000,
          }
        : {
            host: 'localhost',
            port: 1984,
            protocol: 'http',
            timeout: 600000,
          };
      const arweave = Arweave.init(arweaveConfig);
      const wallet = readJWKFile(config.walletPath);
      const walletDao = new WalletDAO(arweave, DEFAULT_APP_NAME, DEFAULT_APP_VERSION);
      const arDrive = arDriveFactory({
        wallet,
        arweave,
        dryRun: config.dryRun ? true : false,
        shouldBundle: config.production ? true : false,
        config,
        walletDao,
      });
      if (!config.production) await fundArLocalWallet(arweave, wallet);
      const address = await wallet.getAddress();
      const walletBalanceInWinston = await walletDao.getAddressWinstonBalance(address);
      const walletBalanceInAR = new AR(walletBalanceInWinston);
      log.info(
        `Loaded wallet with address: ${address} and Balance: ${walletBalanceInWinston.toString()} Winston (${walletBalanceInAR.toString()} AR)`
      );
      try {
        const result = await arDrive.uploadFolder(arweave, address);
        const baseUrl = `${arweaveConfig.protocol}://${arweaveConfig.host}${
          config.production ? '' : ':' + arweaveConfig.port
        }`;
        log.info(`Web app uploaded to ${baseUrl}/${result}`);
      } catch (e) {
        if (e.message === 'canceled') {
          log.info('Exiting');
          return;
        }
        log.error(e?.message ?? e);
      }
    } catch (e) {
      log.error(e?.message ?? e);
    }
  } else {
    log.error(`Folder path ${config.folderPath} does not exist`);
  }
};

const main = async () => {
  const configFiles = glob.sync(path.join(process.cwd(), 'web-ardrive.config.{cjs,js}'));
  if (configFiles.length === 0) {
    log.error('Config file web-ardrive.config.js or web-ardrive.config.cjs not found');
    return;
  }
  const configPath = configFiles[0];
  try {
    const config: WebArDriveConfig = await require(configPath);
    await uploadFolder(config);
  } catch (e) {
    log.error(e?.message ?? e);
  }
};

if (require.main === module) {
  process.env['ARDRIVE_PROGRESS_LOG'] = '1';
  main();
}

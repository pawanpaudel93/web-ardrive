import fs from 'fs/promises';
import path from 'path';

import { readJWKFile, WalletDAO } from 'ardrive-core-js';
import Arlocal from 'arlocal';
import Arweave from 'arweave';
import { expect } from 'chai';
import glob from 'glob';

import { fundArLocalWallet, WebArDriveConfig } from './utils';
import { arDriveFactory, DEFAULT_APP_NAME, DEFAULT_APP_VERSION } from './web-ardrive';

describe('CLI', () => {
  let arlocal: Arlocal;

  before(async () => {
    arlocal = new Arlocal();
    await arlocal.start();
  });

  it('Deploy app to local testnet', async () => {
    const folderPath = path.resolve('examples/simple-js-app/uHost').toString();
    const walletPath = path.resolve('test_wallet.json').toString();
    const destFolderName = 'uHost';
    const production = false;

    const config: WebArDriveConfig = {
      folderPath,
      walletPath,
      production,
      destFolderName,
    };

    const arweave = Arweave.init({
      host: 'localhost',
      port: 1984,
      protocol: 'http',
      timeout: 600000,
    });

    const wallet = readJWKFile(walletPath);
    const walletDao = new WalletDAO(arweave, DEFAULT_APP_NAME, DEFAULT_APP_VERSION);

    const arDrive = arDriveFactory({
      wallet,
      arweave,
      dryRun: false,
      shouldBundle: false,
      config,
      walletDao,
    });

    await fundArLocalWallet(arweave, wallet);
    const address = await wallet.getAddress();
    const result: string = await arDrive.uploadFolder(arweave, address, '');
    expect(result).to.be.a('string');
  });

  after(async () => {
    await arlocal.stop();
    const temporaryFiles = glob.sync('*.test.json');
    temporaryFiles.forEach(async (file) => {
      await fs.unlink(file);
    });
  });
});

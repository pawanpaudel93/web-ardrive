#!/usr/bin/env node

import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';

import { listFrameworks } from '@netlify/framework-info';
import { AR, readJWKFile, WalletDAO } from 'ardrive-core-js';
import Arweave from 'arweave';
import chalk from 'chalk';
import { Command } from 'commander';
import { glob } from 'glob';
import createJITI from 'jiti';
import { exec } from 'promisify-child-process';
const jiti = createJITI(__filename);

import { fundArLocalWallet, log, WebArDriveConfig } from './utils';
import { arDriveFactory, DEFAULT_APP_NAME, DEFAULT_APP_VERSION } from './web-ardrive';

let defaultConfig = `/** @type {import('web-ardrive').WebArdriveConfig} */

const WebArdriveConfig = {
  walletPath: "wallet.json",
  folderPath: "FOLDER_PATH",
  appType: "APP_TYPE",
  parentFolderID: "",
  destFolderName: "DEST_FOLDER_NAME",
  production: true,
};

export default WebArdriveConfig;
`;

const buildCommands = {
  react: 'npx react-scripts build',
  next: 'npx next build && npx next export',
  vue: 'npx vue-cli-service build',
  nuxt: 'npx nuxt generate',
  vite: 'npx vite build --base "./"',
};

const checkConfig = (config: WebArDriveConfig) => {
  const errors: string[] = [];
  if (!config.folderPath && typeof config.folderPath !== 'string') {
    errors.push('folderPath must be a string in web-ardrive config file');
  }
  if (config.production && !config.parentFolderID) {
    errors.push('parentFolderID must be set in web-ardrive config file');
  }
  if (!config.walletPath) {
    errors.push('walletPath not specified in web-ardrive config file');
  }
  if (!config.destFolderName) {
    errors.push('destFolderName not specified in web-ardrive config file');
  }
  if (errors.length > 0) {
    throw new Error(chalk.red('-> ') + errors.join('\n' + chalk.red('-> ')));
  }
};

const getConfig = (pattern: string, folderPath?: string) => {
  if (!folderPath) {
    const configFiles = glob.sync(path.join(process.cwd(), pattern));
    if (configFiles.length > 0) {
      const appConfig = jiti(configFiles[0]);
      return appConfig.default ? appConfig.default : appConfig;
    }
  }
  return {};
};

const runCommand = async (command: string) => {
  log.info('Running command: ' + chalk.gray(command));
  const child = exec(command);
  child.stdout.pipe(process.stdout);
  child.stderr.on('data', (data) => console.log(data));
  await child;
};

const detectFramework = async () => {
  const frameworks = await listFrameworks('.');
  if (frameworks.length > 0) {
    return frameworks[0].id;
  }
  return '';
};

const buildConfig = async (config: WebArDriveConfig) => {
  const appType = config.appType && config.folderPath ? config.appType : await detectFramework();
  config.appType = appType === 'create-react-app' ? 'react' : appType;
  if (config.appType === 'react') {
    config.folderPath = 'build';
  } else if (config.appType === 'next') {
    const appConfig = getConfig('next.config.{js,ts}', config.folderPath);
    config.folderPath = appConfig.outDir ? appConfig.outDir : 'out';
  } else if (config.appType === 'vue') {
    const appConfig = getConfig('vue.config.{js,ts}', config.folderPath);
    config.folderPath = appConfig.outputDir ? appConfig.outputDir : 'dist';
  } else if (config.appType === 'nuxt') {
    const appConfig = getConfig('nuxt.config.{js,ts}', config.folderPath);
    config.folderPath = appConfig?.generate?.dir ? appConfig?.generate?.dir : 'dist';
  } else if (config.appType === 'vite') {
    const appConfig = getConfig('vite.config.{js,ts}', config.folderPath);
    config.folderPath = appConfig?.build?.outDir ? appConfig?.build?.outDir : 'dist';
  }
};

const buildApp = async (config: WebArDriveConfig) => {
  if (config.appType) {
    await runCommand(buildCommands[config.appType]);
  }
};

const uploadFolder = async ({
  folderPath,
  appType,
  walletPath,
  parentFolderID,
  destFolderName,
  production = true,
  dryRun = false,
}: WebArDriveConfig) => {
  const config: WebArDriveConfig = {
    folderPath,
    appType,
    walletPath,
    production,
    parentFolderID,
    destFolderName,
    dryRun,
  };
  checkConfig(config);
  await buildApp(config);
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

const init = async () => {
  const configFiles = glob.sync(path.join(process.cwd(), 'web-ardrive.config.{js,ts}'));
  if (configFiles.length > 0) {
    log.error('Config file already exists.');
    return;
  }
  const appType = await detectFramework();
  let folderPath = '';
  let configFileName = '';
  if (appType === 'create-react-app') {
    folderPath = 'build';
  } else if (appType === 'next') {
    folderPath = 'out';
  } else if (appType === 'vue') {
    const appConfig = getConfig('vue.config.{js,ts}');
    folderPath = appConfig.outputDir ? appConfig.outputDir : 'dist';
  } else if (appType === 'nuxt') {
    const appConfig = getConfig('nuxt.config.{js,ts}');
    folderPath = appConfig?.generate?.dir ? appConfig?.generate?.dir : 'dist';
  } else if (appType === 'vite') {
    const appConfig = getConfig('vite.config.{js,ts}');
    folderPath = appConfig?.build?.outDir ? appConfig?.build?.outDir : 'dist';
  }
  defaultConfig = defaultConfig
    .replace('FOLDER_PATH', folderPath)
    .replace('APP_TYPE', appType === 'create-react-app' ? 'react' : appType)
    .replace('DEST_FOLDER_NAME', path.basename(path.resolve(process.cwd())));
  configFileName = 'web-ardrive.config.js';
  await fsPromises.writeFile(configFileName, defaultConfig);
  log.info(`Config file ${configFileName} successfully created.`);
};

const deploy = async () => {
  const configFiles = glob.sync(path.join(process.cwd(), 'web-ardrive.config.{js,ts}'));
  if (configFiles.length === 0) {
    log.error('Config file web-ardrive.config.js or web-ardrive.config.ts not found');
    return;
  }
  const configPath = configFiles[0];
  try {
    const config = jiti(configPath);
    const cliConfig: WebArDriveConfig = config.default ? config.default : config;
    await buildConfig(cliConfig);
    await uploadFolder(cliConfig);
  } catch (e) {
    log.error(e?.message ?? e);
  }
};

process.env['ARDRIVE_PROGRESS_LOG'] = '1';
const program = new Command();
program.name('web-ardrive').description('A CLI tool to deploy web apps to Arweave using ArDrive').version('2.0.0');

program.command('init').description('Initialize web-ardrive configuration.').action(init);
program.command('deploy').description('Deploy web app to Arweave.').action(deploy);
program.parse(process.argv);

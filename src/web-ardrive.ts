import * as fs from 'fs';
import path from 'path';

import {
  AR,
  ARDataPriceEstimator,
  ArDrive,
  ArDriveCommunityOracle,
  ArDriveUploadStats,
  ArFSDAO,
  ArFSPublicFolder,
  ArFSPublicFolderBuilder,
  ArweaveAddress,
  CommunityOracle,
  EID,
  FeeMultiple,
  FolderID,
  GatewayAPI,
  GatewayOracle,
  gatewayUrlForArweave,
  Wallet,
  WalletDAO,
  Winston,
  wrapFileOrFolder,
} from 'ardrive-core-js';
import { ArFSCostCalculator, CostCalculator } from 'ardrive-core-js/lib/arfs/arfs_cost_calculator';
import { ArFSTagSettings } from 'ardrive-core-js/lib/arfs/arfs_tag_settings';
import { ArFSUploadPlanner, UploadPlanner } from 'ardrive-core-js/lib/arfs/arfs_upload_planner';
import { ARDataPriceNetworkEstimator } from 'ardrive-core-js/lib/pricing/ar_data_price_network_estimator';
import Arweave from 'arweave';
import glob from 'glob';
import ora from 'ora';

import {
  ArDriveSettings,
  fileAndFolderUploadConflictPrompts,
  fileUploadConflictPrompts,
  log,
  mineArLocalBlock,
  WebArDriveConfig,
} from './utils';

export const DEFAULT_APP_NAME = 'Web ArDrive';
export const DEFAULT_APP_VERSION = '1.0.3';
export const MANIFEST_NAME = 'ArDriveManifest.json';

export function arDriveFactory({
  wallet,
  arweave,
  priceEstimator = new ARDataPriceNetworkEstimator(new GatewayOracle(gatewayUrlForArweave(arweave))),
  communityOracle = new ArDriveCommunityOracle(arweave),
  dryRun = false,
  feeMultiple = new FeeMultiple(1.0),
  walletDao = new WalletDAO(arweave, DEFAULT_APP_NAME, DEFAULT_APP_VERSION),
  shouldBundle = true,
  arFSTagSettings = new ArFSTagSettings({ appName: DEFAULT_APP_NAME, appVersion: DEFAULT_APP_VERSION }),
  uploadPlanner = new ArFSUploadPlanner({
    shouldBundle,
    arFSTagSettings,
  }),
  costCalculator = new ArFSCostCalculator({ priceEstimator, communityOracle, feeMultiple }),
  arfsDao = new ArFSDAO(wallet, arweave, dryRun, DEFAULT_APP_NAME, DEFAULT_APP_VERSION, arFSTagSettings),
  config,
}: ArDriveSettings): WebArDrive {
  return new WebArDrive(
    wallet,
    walletDao,
    arfsDao,
    communityOracle,
    priceEstimator,
    feeMultiple,
    dryRun,
    arFSTagSettings,
    uploadPlanner,
    costCalculator,
    config
  );
}

export class WebArDrive extends ArDrive {
  public buildFileName: string;
  constructor(
    wallet: Wallet,
    walletDao: WalletDAO,
    protected readonly arFsDao: ArFSDAO,
    communityOracle: CommunityOracle,
    priceEstimator: ARDataPriceEstimator = new ARDataPriceNetworkEstimator(),
    feeMultiple: FeeMultiple = new FeeMultiple(1.0),
    dryRun = false,
    arFSTagSettings: ArFSTagSettings = new ArFSTagSettings({
      appName: DEFAULT_APP_NAME,
      appVersion: DEFAULT_APP_VERSION,
    }),
    uploadPlanner: UploadPlanner = new ArFSUploadPlanner({
      priceEstimator,
      arFSTagSettings: arFSTagSettings,
      feeMultiple,
      communityOracle,
    }),
    costCalculator: CostCalculator = new ArFSCostCalculator({
      communityOracle,
      feeMultiple,
      priceEstimator,
    }),
    public readonly config: WebArDriveConfig
  ) {
    super(
      wallet,
      walletDao,
      arFsDao,
      communityOracle,
      DEFAULT_APP_NAME,
      DEFAULT_APP_VERSION,
      priceEstimator,
      feeMultiple,
      dryRun,
      arFSTagSettings,
      uploadPlanner,
      costCalculator
    );
    this.buildFileName = config.production ? 'web-ardrive.build.json' : 'web-ardrive.build.test.json';
  }

  private modifyHtmls(folderPath: string) {
    const files = glob.sync(path.join(folderPath, '/**/*.html'));
    for (let i = 0; i < files.length; i++) {
      this.modifyHtml(files[i]);
    }
  }

  private modifyHtml(path: string) {
    const html = fs.readFileSync(path, 'utf8');
    if (
      /src="\/(.*?)"/g.test(html) ||
      /src='\/(.*?)'/g.test(html) ||
      /href="\/(.*?(css|js))"/g.test(html) ||
      /href='\/(.*?(css|js))'/g.test(html)
    ) {
      const modifiedHtml = html
        .replace(/src="\/(.*?)"/g, 'src="$1"')
        .replace(/src='\/(.*?)'/g, "src='$1'")
        .replace(/href="\/(.*?(css|js))"/g, 'href="$1"')
        .replace(/href='\/(.*?(css|js))'/g, "href='$1'");
      fs.writeFileSync(path, modifiedHtml);
    }
  }

  private async upload(parentFolderId: FolderID) {
    const entitiesToUpload = ((): ArDriveUploadStats[] => {
      const wrappedEntity = wrapFileOrFolder(this.config.folderPath);
      const singleParameter = {
        destFolderId: parentFolderId,
        wrappedEntity,
        destName: this.config.destFolderName,
      };
      return [singleParameter];
    })();

    const conflictResolution = 'upsert';
    const results = await this.uploadAllEntities({
      entitiesToUpload,
      conflictResolution,
      prompts: fileAndFolderUploadConflictPrompts,
    });
    console.log(JSON.stringify(results, null, 4));
    return results;
  }

  private getBuildJSON() {
    try {
      const buildJSON = fs.readFileSync(this.buildFileName, 'utf8');
      return JSON.parse(buildJSON);
    } catch (e) {
      return {};
    }
  }

  private saveBuildJSON(buildJSON: { folderId: string; buildId: string }) {
    fs.writeFileSync(this.buildFileName, JSON.stringify(buildJSON, null, 4));
  }

  private async sleep(seconds: number) {
    return await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }

  private async waitForFolderCreation(arweave: Arweave, txId: string, folderId: FolderID, owner: ArweaveAddress) {
    console.log(`Waiting for folder creation tx ${txId} to be confirmed`);
    let folder: ArFSPublicFolder;
    const startTime = new Date().getTime();
    const spinner = ora(`Waiting for ${this.config.destFolderName} transaction to be mined...`).start();
    const gatewayApi = new GatewayAPI({ gatewayUrl: gatewayUrlForArweave(arweave) });
    while (!folder) {
      try {
        folder = await new ArFSPublicFolderBuilder({
          entityId: folderId,
          gatewayApi,
          owner,
        }).build();
        spinner.stop();
      } catch (e) {
        const timeInSeconds = Math.floor((new Date().getTime() - startTime) / 1000);
        const timeInMinutes = Math.floor(timeInSeconds / 60);
        const timeInSecondsRemainder = timeInSeconds % 60;
        spinner.text = `Waiting for ${this.config.destFolderName} transaction to be mined... Duration elapsed: ${timeInMinutes}m ${timeInSecondsRemainder}s`;
        spinner.color = 'yellow';
        await this.sleep(10);
      }
    }
  }

  public async uploadFolder(arweave: Arweave, address: ArweaveAddress) {
    let parentFolderID;
    this.modifyHtmls(this.config.folderPath);

    if (this.config.production) {
      parentFolderID = EID(this.config.parentFolderID) as FolderID;
    } else {
      const drives = await this.getAllDrivesForAddress({ address, privateKeyData: undefined });
      if (drives.length > 0) {
        parentFolderID = drives[0].rootFolderId;
      } else {
        const { created: drive } = await this.createPublicDrive({ driveName: 'webapps' });
        parentFolderID = drive[1].entityId;
      }
    }

    // mining block in development mode
    if (!this.config.production) await mineArLocalBlock(arweave);

    log.info('Uploading app files...');
    let totalFeesInWinston = new Winston(0);
    const { created: files, fees, tips } = await this.upload(parentFolderID);
    const buildJSON = this.getBuildJSON();
    // mining block in development mode
    if (!this.config.production) await mineArLocalBlock(arweave);
    if (files.length > 0) {
      totalFeesInWinston = totalFeesInWinston.plus(tips.reduce((acc, tip) => tip.winston.plus(acc), new Winston(0)));
      totalFeesInWinston = totalFeesInWinston.plus(
        Object.values(fees).reduce((acc, fee) => fee.plus(acc), new Winston(0))
      );
    } else {
      if (glob.sync(path.join(this.config.folderPath, '/**/*')).length === 0) {
        log.info('No files to upload! Skipping upload.');
      } else {
        log.info('None of the app files are updated since last deployment. Skipping upload.');
      }
    }

    if (this.config.dryRun && files.length > 0) {
      log.info(
        `Uploading ${files.length} files takes total fees of ${totalFeesInWinston.toString()} Winston (${new AR(
          totalFeesInWinston
        ).toString()} AR)`
      );
    }
    let folderId: FolderID;
    let manifestDataTxId: string;
    if (buildJSON?.folderId && buildJSON?.buildId) {
      folderId = EID(buildJSON.folderId) as FolderID;
      manifestDataTxId = buildJSON.buildId;
    }
    if (files.length > 0) {
      const file = files[0];
      if (
        file.type === 'folder' &&
        (this.config.folderPath.includes(file.entityName) ||
          file.entityName.includes(this.config.folderPath) ||
          (this.config.destFolderName && this.config.destFolderName.includes(file.entityName)))
      ) {
        folderId = file.entityId;
      }
    }
    if (!folderId) {
      const children = await this.listPublicFolder({
        folderId: parentFolderID,
        maxDepth: 2,
        owner: address,
      });
      const manifestFile = children.find(
        (child) => child.name === MANIFEST_NAME && child.path.includes(this.config.destFolderName)
      );
      const folder = children.find((child) => child.name === this.config.destFolderName);
      if (manifestFile) {
        manifestDataTxId = manifestFile.dataTxId.toString();
      }
      if (folder) {
        folderId = folder.entityId;
      } else {
        throw new Error(`Folder ${this.config.destFolderName} not found`);
      }
    }

    if ((files.length > 0 || typeof manifestDataTxId === 'undefined') && !this.config.dryRun) {
      if (this.config.production) {
        await this.waitForFolderCreation(arweave, files[0].bundledIn.toString(), folderId, address);
      }
      log.info('App files uploaded successfully!');
      log.info('Creating manifest...');
      const manifest = await this.uploadPublicManifest({
        folderId,
        destManifestName: MANIFEST_NAME,
        maxDepth: Number.MAX_SAFE_INTEGER,
        conflictResolution: 'upsert',
        prompts: fileUploadConflictPrompts,
      });
      console.log(JSON.stringify(manifest, null, 4));
      totalFeesInWinston = totalFeesInWinston.plus(
        manifest.tips.reduce((acc, tip) => tip.winston.plus(acc), new Winston(0))
      );
      totalFeesInWinston = totalFeesInWinston.plus(
        Object.values(manifest.fees).reduce((acc, fee) => fee.plus(acc), new Winston(0))
      );
      log.info('Manifest created successfully!');
      log.info(
        `Uploaded ${files.length + 1} files with total fees of ${totalFeesInWinston.toString()} Winston (${new AR(
          totalFeesInWinston
        ).toString()} AR)`
      );
      if (this.config.production) {
        log.info('Wait for atleast 2-3 minutes for the application to be accessible.');
      }

      this.saveBuildJSON({
        folderId: folderId.toString(),
        buildId: manifest.created[0].dataTxId.toString(),
      });

      return manifest.created[0].dataTxId.toString();
    } else if (manifestDataTxId) {
      this.saveBuildJSON({
        folderId: folderId.toString(),
        buildId: manifestDataTxId,
      });
      return manifestDataTxId;
    } else {
      return buildJSON?.buildId;
    }
  }
}

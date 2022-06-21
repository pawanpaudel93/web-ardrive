import * as fs from 'fs';
import path from 'path';

import {
  ARDataPriceEstimator,
  ArDrive,
  ArDriveCommunityOracle,
  ArDriveUploadStats,
  ArFSDAO,
  ArweaveAddress,
  CommunityOracle,
  EID,
  FeeMultiple,
  FolderID,
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

import { ArDriveSettings, fileAndFolderUploadConflictPrompts, log, mineArLocalBlock, WebArDriveConfig } from './utils';

export const DEFAULT_APP_NAME = 'Web ArDrive';
export const DEFAULT_APP_VERSION = '1.0.0';

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

  private saveBuildJSON(buildJSON: { folderID: string; buildID: string }) {
    fs.writeFileSync(this.buildFileName, JSON.stringify(buildJSON, null, 4));
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
    let totalFees = new Winston(0);
    const { created: files, fees, tips } = await this.upload(parentFolderID);
    const buildJSON = this.getBuildJSON();
    // mining block in development mode
    if (!this.config.production) await mineArLocalBlock(arweave);
    if (files.length > 0) {
      totalFees = totalFees.plus(tips.reduce((acc, tip) => tip.winston.plus(acc), new Winston(0)));
      totalFees = totalFees.plus(Object.values(fees).reduce((acc, fee) => fee.plus(acc), new Winston(0)));

      log.info('App files uploaded successfully!');
    } else {
      if (glob.sync(path.join(this.config.folderPath, '/**/*')).length === 0) {
        log.info('No files to upload! Skipping upload.');
      } else {
        log.info('None of the app files are updated since last deployment. Skipping upload.');
      }
    }

    if (files.length > 0) {
      const folderID = (() => {
        const file = files[0];
        if (
          file.type === 'folder' &&
          (this.config.folderPath.includes(file.entityName) ||
            file.entityName.includes(this.config.folderPath) ||
            (this.config.destFolderName && this.config.destFolderName.includes(file.entityName)))
        ) {
          return file.entityId;
        }
        return buildJSON?.folderID;
      })();
      log.info('Creating manifest...');
      const manifest = await this.uploadPublicManifest({
        folderId: folderID,
        destManifestName: 'manifest.json',
        maxDepth: Number.MAX_SAFE_INTEGER,
        conflictResolution: 'upsert',
      });
      console.log(JSON.stringify(manifest, null, 4));
      totalFees = totalFees.plus(manifest.tips.reduce((acc, tip) => tip.winston.plus(acc), new Winston(0)));
      totalFees = totalFees.plus(Object.values(manifest.fees).reduce((acc, fee) => fee.plus(acc), new Winston(0)));
      log.info('Manifest created successfully!');
      log.info(
        `Uploaded ${files.length} files with total fees of ${totalFees.toString()} Winston (${totalFees
          .dividedBy(10 ** 12)
          .toString()} AR)`
      );

      this.saveBuildJSON({
        folderID: folderID,
        buildID: manifest.created[0].dataTxId.toString(),
      });

      return manifest.created[0].dataTxId;
    } else {
      return buildJSON?.folderID;
    }
  }
}

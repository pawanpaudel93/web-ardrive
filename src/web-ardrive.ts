import * as fs from 'fs';
import path from 'path';

import {
  alphabeticalOrder,
  AR,
  ARDataPriceEstimator,
  ArDrive,
  ArDriveCommunityOracle,
  ArDriveUploadStats,
  ArFSDAO,
  ArFSDataToUpload,
  ArFSManifestResult,
  ArFSPublicFileWithPaths,
  ArFSPublicFolder,
  ArFSPublicFolderBuilder,
  ArFSPublicFolderWithPaths,
  ArweaveAddress,
  ByteCount,
  CommunityOracle,
  DataContentType,
  EID,
  emptyManifestResult,
  FeeMultiple,
  FileInfo,
  FolderConflictPrompts,
  FolderID,
  GatewayAPI,
  GatewayOracle,
  gatewayUrlForArweave,
  Manifest,
  MANIFEST_CONTENT_TYPE,
  ManifestPathMap,
  TransactionID,
  UnixTime,
  UploadPublicManifestParams,
  upsertOnConflicts,
  Wallet,
  WalletDAO,
  Winston,
  wrapFileOrFolder,
} from 'ardrive-core-js';
import { ArFSCostCalculator, CostCalculator } from 'ardrive-core-js/lib/arfs/arfs_cost_calculator';
import { ArFSTagSettings } from 'ardrive-core-js/lib/arfs/arfs_tag_settings';
import { ArFSUploadPlanner, UploadPlanner } from 'ardrive-core-js/lib/arfs/arfs_upload_planner';
import { ARDataPriceNetworkEstimator } from 'ardrive-core-js/lib/pricing/ar_data_price_network_estimator';
import { defaultArweaveGatewayPath } from 'ardrive-core-js/lib/utils/constants';
import Arweave from 'arweave';
import glob from 'glob';
import ora from 'ora';

import {
  ArDriveSettings,
  CustomMetaData,
  fileAndFolderUploadConflictPrompts,
  fileUploadConflictPrompts,
  log,
  mineArLocalBlock,
  WebArDriveConfig,
} from './utils';

export const DEFAULT_APP_NAME = 'Web ArDrive';
export const DEFAULT_APP_VERSION = '2.0.0';
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

export class ArFSManifestToUpload extends ArFSDataToUpload {
  manifest: Manifest;
  lastModifiedDateMS: UnixTime;

  constructor(
    public readonly folderToGenManifest: (ArFSPublicFolderWithPaths | ArFSPublicFileWithPaths)[],
    public readonly destManifestName: string,
    public readonly appType: string,
    public readonly customMetaData?: CustomMetaData
  ) {
    super();

    const sortedChildren = folderToGenManifest.sort((a, b) => alphabeticalOrder(a.path, b.path));
    const baseFolderPath = sortedChildren[0].path;

    // TODO: Fix base types so deleting un-used values is not necessary; Tickets: PE-525 + PE-556
    const castedChildren = sortedChildren as Partial<ArFSPublicFolderWithPaths | ArFSPublicFileWithPaths>[];
    castedChildren.map((fileOrFolderMetaData) => {
      if (fileOrFolderMetaData.entityType === 'folder') {
        delete fileOrFolderMetaData.lastModifiedDate;
        delete fileOrFolderMetaData.size;
        delete fileOrFolderMetaData.dataTxId;
        delete fileOrFolderMetaData.dataContentType;
      }
    });

    // TURN SORTED CHILDREN INTO MANIFEST
    const pathMap: ManifestPathMap = {};
    castedChildren.forEach((child) => {
      if (child.dataTxId && child.path && child.dataContentType !== MANIFEST_CONTENT_TYPE) {
        const path = child.path
          // Slice off base folder path and the leading "/" so manifest URLs path correctly
          .slice(baseFolderPath.length + 1)
          // Replace spaces with underscores for sharing links
          .replace(/ /g, '_');

        pathMap[path.endsWith('.html') && appType === 'next' ? path.replace('.html', '') : path] = {
          id: `${child.dataTxId}`,
        };
      }
    });

    if (Object.keys(pathMap).length === 0) {
      throw new Error('Cannot construct a manifest of a folder that has no file entities!');
    }

    // Use index.html in the specified folder if it exists, otherwise show first file found
    let indexPath = '';
    if (appType === 'next') {
      indexPath = Object.keys(pathMap).includes(`index`) ? `index` : Object.keys(pathMap)[0];
    } else {
      indexPath = Object.keys(pathMap).includes(`index.html`) ? `index.html` : Object.keys(pathMap)[0];
    }
    this.manifest = {
      manifest: 'arweave/paths',
      version: '0.1.0',
      index: {
        path: indexPath,
      },
      paths: pathMap,
    };

    // Create new current unix, as we just created this manifest
    this.lastModifiedDateMS = new UnixTime(Math.round(Date.now() / 1000));
  }

  public getLinksOutput(dataTxId: TransactionID, gateway = new URL(defaultArweaveGatewayPath)): string[] {
    const allPaths = Object.keys(this.manifest.paths);

    const encodedPaths = allPaths.map((path) =>
      path
        // Split each path by `/` to avoid encoding the separation between folders and files
        .split('/')
        // Encode file/folder names for URL safe links
        .map((path) => encodeURIComponent(path))
        // Rejoin the paths
        .join('/')
    );

    const pathsToFiles = encodedPaths.map((encodedPath) => `${gateway.href}${dataTxId}/${encodedPath}`);
    const pathToManifestTx = `${gateway.href}${dataTxId}`;

    return [pathToManifestTx, ...pathsToFiles];
  }

  public gatherFileInfo(): FileInfo {
    return { dataContentType: this.contentType, lastModifiedDateMS: this.lastModifiedDateMS, fileSize: this.size };
  }

  public get contentType(): DataContentType {
    return this.customContentType ?? MANIFEST_CONTENT_TYPE;
  }

  public getBaseName(): string {
    return this.destName ?? this.destManifestName;
  }

  public getFileDataBuffer(): Buffer {
    return Buffer.from(JSON.stringify(this.manifest));
  }

  public get size(): ByteCount {
    return new ByteCount(Buffer.byteLength(JSON.stringify(this.manifest)));
  }

  public get lastModifiedDate(): UnixTime {
    return this.lastModifiedDateMS;
  }
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
    if (/src=["']\/(.*?\..*?)["']/g.test(html) || /href=["']\/(.*?\..*?)["']/g.test(html)) {
      const modifiedHtml = html
        .replace(/src=["']\/(.*?\..*?)["']/g, 'src="$1"')
        .replace(/href=["']\/(.*?\..*?)["']/g, 'href="$1"');
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

  public async uploadPublicManifestNext(
    {
      folderId,
      destManifestName = 'DriveManifest.json',
      maxDepth = Number.MAX_SAFE_INTEGER,
      conflictResolution = upsertOnConflicts,
      prompts,
    }: UploadPublicManifestParams,
    appType: string
  ): Promise<ArFSManifestResult> {
    const driveId = await this.arFsDao.getDriveIdForFolderId(folderId);

    // Assert that the owner of this drive is consistent with the provided wallet
    const owner = await this.getOwnerForDriveId(driveId);
    await this.assertOwnerAddress(owner);

    const children = await this.listPublicFolder({
      folderId,
      maxDepth,
      includeRoot: true,
      owner,
    });
    const arweaveManifest = new ArFSManifestToUpload(children, destManifestName, appType);
    const uploadManifestResults = await this.uploadAllEntities({
      entitiesToUpload: [
        {
          wrappedEntity: arweaveManifest,
          destFolderId: folderId,
          destName: arweaveManifest.destinationBaseName,
        },
      ],
      conflictResolution,
      prompts: prompts as FolderConflictPrompts,
    });

    const manifestTxId = uploadManifestResults.created[0]?.dataTxId;

    if (manifestTxId) {
      const links = this.arFsDao.getManifestLinks(manifestTxId, arweaveManifest);

      return {
        ...uploadManifestResults,
        manifest: arweaveManifest.manifest,
        links,
      };
    }

    // ArFSResult was empty, return expected empty manifest result
    return emptyManifestResult;
  }

  public async uploadFolder(arweave: Arweave, address: ArweaveAddress) {
    let parentFolderID;
    if (this.config.appType !== 'next') {
      this.modifyHtmls(this.config.folderPath);
    }

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
      const manifest = await this.uploadPublicManifestNext(
        {
          folderId,
          destManifestName: MANIFEST_NAME,
          maxDepth: Number.MAX_SAFE_INTEGER,
          conflictResolution: 'upsert',
          prompts: fileUploadConflictPrompts,
        },
        this.config.appType
      );
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

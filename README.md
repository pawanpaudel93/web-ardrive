# web-ardrive

## Table of Contents

- [About](#about)
- [Installing](#installing)
- [Usage](#usage)
- [Contributing](#contributing)

> NOTE: WIP

## About <a name = "about"></a>

Web Bundlr is a cli tool to deploy web apps to Arweave using Bundlr. Arweave is a protocol that allows you to store data permanently, sustainably, with a single upfront fee and Bundlr Network is a reliable multichain solution for Arweave which is building the future of data storage by bringing the speed and ease of web2 to web3 technology.
Learn more about [Bundlr](https://bundlr.network/) and [Arweave](https://www.arweave.org/).

> :warning: **Deploy using Devnet bundlr first to check everything is working and then deploy using production bundlr.**


## Installing <a name = "installing"></a>

Install the package using npm or yarn as desired to get started.
```
npm install -g web-ardrive

OR

yarn add global web-ardrive
```

## Usage <a name = "usage"></a>

Lets go through steps on how to use web-ardrive in your projects to deploy apps.

### ReactJS & NextJS
> ReactJS 
>> <span style='color: green;'>RECOMMENDED</span>: Use HashRouter from react-router-dom in react apps. Check project [examples](https://github.com/pawanpaudel93/web-ardrive/tree/main/examples)

Bundlr creates a arweave manifest file when uploading a folder. So the manifest contains the paths of the files and the transaction ID to resolve to for the given path. You can see more about it here [Arweave Manifest](https://github.com/ArweaveTeam/arweave/blob/master/doc/path-manifest-schema.md).

So make the react build compatible on the areweave, we must use relative urls on the href instead of absolute ones so that the manifest can resolve the file path. For example href="/dist/index.js" must be replaced with either href="dist/index.js" or href="./dist/index.js". So to do so, we must add the following to package.json so the paths can resolve correctly.

```
homepage: "."
```
Now you can create the production build. Run the following command:
```
npm run build

OR

yarn build
```

> Nextjs Static Export:

Learn about it [here](https://nextjs.org/docs/advanced-features/static-html-export) for the supported and unsupported features in static html export.

Add the configuration to the next.config.js or next.config.ts file.

```
assetPrefix: "./",
```

Add the following to package.json scripts.
```
"export": "next build && next export"
```
And run: 
```
npm run export

OR

yarn export
```
If you are having problems regarding images in nextjs html export, see [here](https://stackoverflow.com/questions/65487914/error-image-optimization-using-next-js-default-loader-is-not-compatible-with-n).

### VueJS & NuxtJS
> VueJS

>><span style='color: green;'>RECOMMENDED</span>: Use router in hash mode in vue apps.

Modify vue.config.js or vue.config.ts to include the following config:
```
publicPath: "./" // default is /
```
Now, run the following command to create the production build.
```
npm run build

OR

yarn build
```

> NuxtJS

Modify nuxt.config.js or nuxt.config.ts to include the following config:

```
target: 'static', // default is 'server'
router: {
  mode: 'hash',
  base: './',
  }
```

Now, run the following command tp generate the static production build.

```
npm run generate

OR

yarn generate
```
Read more about going full static mode in nuxtjs [Going Full Static (https://nuxtjs.org/announcements/going-full-static/)

> And now you have to add config file for web-ardrive to upload the production build to arweave.

Create a file named web-ardrive.config.js on the root folder of your project and add the config as:

|  Name | Type   | Description   |
| ------------ | ------------ | ------------ |
|  url | string  |  URL to the bundler Eg: Production => https://node1.bundlr.network, https://node2.bundlr.network Testnet => https://devnet.bundlr.network |
|   currency	| string  |  Supported Currencies: arweave, ethereum, matic, bnb, fantom, solana, avalanche, boba, boba-eth, arbitrum, chainlink, kyve, near and algorand |
|  wallet |  any |  private key (in whatever form required)|
| config?  |  Object |   |
| config.contractAddress?	  |  string |  contract address if its not a native currency |
|  config.providerUrl?	 | string  |  Provide a RPC url or default public rpc url is used |
|config.timeout?	| number	| Default is used if not provided	|
|folderPath	|	string	|	relative build folder path from project root folder Eg: 'build' ,'./build', 'out'	|

Example of web-ardrive.config.js for different currency can be:

For Polygon (MATIC) on testnet.

```
/** @type {import('web-ardrive').WebArDriveConfig} */

const WebArDriveConfig = {
  url: "https://devnet.bundlr.network",
  currency: "matic"
  wallet: "<private-key>",
  folderPath: "build",
  config: {
    providerUrl: "https://rpc.ankr.com/polygon_mumbai",
  },
};

module.exports = WebArDriveConfig;
```

For Solana:

```
/** @type {import('web-ardrive').WebArDriveConfig} */

const WebArDriveConfig = {
  url: "https://devnet.bundlr.network",
  currency: "solana"
  wallet: "<private-key>",
  folderPath: "build",
  config: {
    providerUrl: "https://api.devnet.solana.com",
  },
};

module.exports = WebArDriveConfig;
```

For ERC20 Tokens: 

For example chainlink on Rinkeby testnet
```
/** @type {import('web-ardrive').WebArDriveConfig} */

const WebArDriveConfig = {
  url: "https://devnet.bundlr.network",
  currency: "chainlink"
  wallet: "<private-key>",
  folderPath: "build",
  config: {
    providerUrl: "https://rpc.ankr.com/eth_rinkeby",
    contractAddress: "0x01BE23585060835E02B77ef475b0Cc51aA1e0709"
  },
};

module.exports = WebArDriveConfig;
```

After the configuration, run web-ardrive command from the root folder of the project.

```
web-ardrive
```
You have to fund the bundlr with the currency you have configured. The cli will show how much bytes is going to be uploaded and how much amount in configured currency is required to perform the upload and it will ask for funding if the loaded balance is not sufficient.

## Author

👤 **Pawan Paudel**

- Github: [@pawanpaudel93](https://github.com/pawanpaudel93)

## 🤝 Contributing <a name = "contributing"></a>

Contributions, issues and feature requests are welcome!<br />Feel free to check [issues page](https://github.com/pawanpaudel93/web-ardrive/issues).

## Show your support

Give a ⭐️ if this project helped you!

Copyright © 2022 [Pawan Paudel](https://github.com/pawanpaudel93).<br />
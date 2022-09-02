# web-ardrive

## Table of Contents

- [About](#about)
- [Installing](#installing)
- [Usage](#usage)
- [Contributing](#contributing)

> NOTE: WIP


## About <a name = "about"></a>

Web Ardrive is a CLI tool to deploy web apps to Arweave using ArDrive. ArDrive isn't just another cloud storage service. ArDrive is built on the Arweave network whose permanent data storage lets to upload any files which will outlive you!
Learn more about [ArDrive](https://ardrive.io/) and [Arweave](https://www.arweave.org/).

> :warning: **Deploy using ArLocal first to check everything is working.**


## Installing <a name = "installing"></a>

Install the package using npm or yarn as desired to get started.
```
npm install -g web-ardrive
```
OR
```
yarn add global web-ardrive
```

## Usage <a name = "usage"></a>

Let's deploy applications created with popular libraries and frameworks using ArDrive.

<span style='color: green;'>RECOMMENDED</span>: Use hash router in react, vue, and nuxt based apps. For next apps there is no hash based routing so manifest is adjusted for routes to work on reload but dynamic routes may not work on reload.

### ReactJS & NextJS

------------


#### **ReactJS** 

<span style='color: green;'>RECOMMENDED</span>: Use HashRouter from react-router-dom in react apps. Check project [examples](https://github.com/pawanpaudel93/web-ardrive/tree/main/examples)

#### **Nextjs Static Export**:

Learn about it [here](https://nextjs.org/docs/advanced-features/static-html-export) for the supported and unsupported features in static html export.

If you are having problems regarding images in nextjs html export, see [here](https://stackoverflow.com/questions/65487914/error-image-optimization-using-next-js-default-loader-is-not-compatible-with-n).

### VueJS & NuxtJS

------------

#### **VueJS**

<span style='color: green;'>RECOMMENDED</span>: Use router in hash mode in vue apps.

Modify vue.config.js or vue.config.ts to include the following config:
```
publicPath: "./" // default is /
```

#### **NuxtJS**

Modify nuxt.config.js or nuxt.config.ts to include the following config:

```
target: 'static', // default is 'server'
router: {
  mode: 'hash',
  base:  './'
}
```

Read more about going full static mode in nuxtjs [Going Full Static (https://nuxtjs.org/announcements/going-full-static/)

### ViteJS
------------

Examples of react, vue and svelte using vite is included in the examples folder.

> And now you have to add config file for web-ardrive to upload the production build to arweave.

Run this command to add configuration file for web-ardrive.

```
web-ardrive init
```

Now modify the configuration file (web-ardrive.config.js) as per your need from the following:

|  Name | Type   | Description   |
| ------------ | ------------ | ------------ |
|  walletPath |  string | wallet json file path |
| folderPath?	|	string	|	folderPath of the build folder to be deployed. Auto discovered for app using vue, nuxt, react, next and vite if not provided. It may be needed for simple JS/TS app. |
| appType?	|	string	|	Possible values: 'react', 'next', 'vue', 'nuxt', 'vite' and ''	|
|  destFolderName	 | string  | Folder name for the folder where all the app files are stored. A folder with destFolderName is created on parent folder with parentFolderID  |
| parentFolderID?	  |  string |  ArDrive folder ID where app is to be deployed. It is required when production is true |
| production?	| boolean	| ArLocal can be used when production is false. Default is true.	|
| dryRun? | boolean | dryRun if true runs all the steps but will skip sending the actual transactions. This can be very useful for gathering price estimations or to confirm that you've copy-pasted your entity IDs correctly before committing to an upload. Default is false. |

Example of web-ardrive.config.js can be:

```
/** @type {import('web-ardrive').WebArDriveConfig} */

const WebArDriveConfig = {
  walletPath: 'wallet.json',
  folderPath: 'build',
  appType: 'react',
  parentFolderID: 'e6cb2f0d-91d7-4acc-9772-72c514263908',
  destFolderName: 'public-square',
  production: false,
};

export default WebArDriveConfig;
```
This configuration deploys `build` folder to the folder with name `public-square` where `public-square` folder is created on parent folder with ID parentFolderID. Production is false so the application is not deployed to Arweave but to local testnet `ArLocal`.

If you want to check if the application is working as expected or not, the application can be deployed to local testnet `ArLocal` using production as false and running the local testnet. Run arlocal with the following from the terminal.
```
npx arlocal
```

After the configuration, run web-ardrive command from the root folder of the project.

```
web-ardrive deploy
```

## Author

👤 **Pawan Paudel**

- Github: [@pawanpaudel93](https://github.com/pawanpaudel93)


## 🤝 Contributing <a name = "contributing"></a>

Contributions, issues and feature requests are welcome!<br />Feel free to check [issues page](https://github.com/pawanpaudel93/web-ardrive/issues).


## Show your support

Give a ⭐️ if this project helped you!

Copyright © 2022 [Pawan Paudel](https://github.com/pawanpaudel93).<br />
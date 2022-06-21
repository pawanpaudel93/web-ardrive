module.exports = {
  publicPath: ".",
  transpileDependencies: ["vuetify"],
  chainWebpack: (config) => {
    config.module.rules.delete("eslint");
  },
};

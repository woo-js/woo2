const path = require('path');
const process = require('process');
const webpack = require('webpack');
// const WebpackShellPluginNext = require('webpack-shell-plugin-next');
// const CopyPlugin = require('copy-webpack-plugin');
const fs = require('fs');

const PROJECT_PATH = path.join(__dirname, '..');

const OUTPUT_PATH = path.join(PROJECT_PATH, 'build');
const projectPkg = JSON.parse(fs.readFileSync(path.join(PROJECT_PATH, 'package.json'), 'utf8'));

module.exports = {
  context: path.resolve(__dirname, '..'),
  entry: path.join(PROJECT_PATH, './src/index.ts'),
  mode: 'development',
  output: {
    filename: 'index.js',
    clean: true,
    path: OUTPUT_PATH,
    globalObject: 'this', // 兼容 Node 和 Web 必要配置
    library: {
      type: 'umd',
    },
  },
  externals: [], // in order to ignore all modules in node_modules folder
  target: 'web',
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: 'ts-loader',
        include: [path.resolve(PROJECT_PATH, 'src')],
        exclude: [path.resolve(PROJECT_PATH, 'build'), path.resolve(PROJECT_PATH, 'dist')],
        options: {
          context: PROJECT_PATH,
          compilerOptions: {
            sourceMap: true,
          },
        },
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.ts', '.json'],
    symlinks: true,
  },
  devServer: {
    static: [
      {
        directory: path.join(PROJECT_PATH, 'dev'),
        publicPath: '/dev',
      },
    ],
    headers: { 'Access-Control-Allow-Origin': '*',"Cross-Origin-Resource-Policy":"cross-origin" },
    allowedHosts: 'all',
    hot: true,
    // host:"192.168.32.14",
    port: 9999,
  },
  devtool: 'inline-source-map',
  // 消除"循环依赖"警告
  plugins: [],
};

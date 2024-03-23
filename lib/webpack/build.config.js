const path = require('path');
const webpack = require('webpack');
// const WebpackShellPluginNext = require('webpack-shell-plugin-next');
const CopyPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const fs = require('fs');

const PROJECT_PATH = path.join(__dirname, '..');
const OUTPUT_PATH = path.join(PROJECT_PATH, 'dist');

(function _upgradeVerson() {
  // 升级版本号
  const pkgFile = path.join(PROJECT_PATH, 'package.json');
  const json = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
  json.version = json.version
    .split('.')
    .map((v, i) => (i == 2 ? (parseInt(v) + 1).toString() : v))
    .join('.');
  fs.writeFileSync(pkgFile, JSON.stringify(json, null, 2));
  console.log('using new version:', json.version);
})();

function removePrivateTypesDefine(content) {
  return content
    .toString().replace(/\r\n/g,'\n')
    .split('\n')
    .filter((v) => !v.match(/^\s+private /))
    .filter((v) => !v.match(/^\s+_\w+[ \(\)]/))
    .join('\n');
}

function miniPackageJson(content) {
  let pkg = JSON.parse(content.toString());
  return JSON.stringify(
    ['name', 'version', 'description', 'main', 'types', 'license', 'author'].reduce((p, c) => {
      p[c] = pkg[c];
      return p;
    }, {}),
    null,
    2
  );
}

module.exports = {
  context: path.resolve(__dirname, '..'),
   entry: {
    index:    path.join(PROJECT_PATH, './src/index.ts'),
    worker:   path.join(PROJECT_PATH, './src/worker.ts'),
  },

  mode: 'production',
  output: {
    filename: '[name].js',
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
        exclude: [path.resolve(PROJECT_PATH, 'build'), path.resolve(PROJECT_PATH, 'dist'),path.resolve(PROJECT_PATH, 'bak'),path.resolve(PROJECT_PATH, 'test')],
        options: {
          context: PROJECT_PATH,
        },
      },
    ],
  },

  optimization: {
    minimize: true,

    minimizer: [
      new TerserPlugin({
        parallel: true,
        terserOptions: {
          mangle: {
            properties: {
              keep_quoted: true,
              regex: /^_[^_]/,
            },
          },
          // https://github.com/webpack-contrib/terser-webpack-plugin#terseroptions
        },
      }),
    ],
    moduleIds: 'natural',
  },
  resolve: {
    extensions: ['.js', '.ts', '.json'],
    symlinks: true,
  },

  // devtool: 'source-map',
  // 消除"循环依赖"警告
  plugins: [
    // new WebpackBundleAnalyzer(),
    // 相对路径重命名ID
    // new webpack.ids.NamedModuleIdsPlugin({ context: PROJECT_PATH }),
    new CopyPlugin({
      // 拷贝 package.json
      patterns: [
        {
          from: './package.json',
          to: path.join(OUTPUT_PATH, 'package.json'),
          transform(content) {
            const { name, version, main, description, bin, license, repository, keywords, types } = JSON.parse(content);
            return JSON.stringify({ name, version, main, description, bin, license, repository, keywords, types }, 2);
          },
        },
        // { from: path.join(PROJECT_PATH, 'bin/wc.js'), to: OUTPUT_PATH + '/bin/[name][ext]' },
        // 生成定义文件
        ...[
          'index',
          // 'Logger',
          // 'Scope',
          // 'ComDesc',
          // 'Router',
          // "ExportedType",
          // "TplElem",
          // 'plugins/IPlugins',
          // 'plugins/$color',
        ].map((f) => ({
          from: path.join(PROJECT_PATH, `build/src/${f}.d.ts`),
          to: OUTPUT_PATH + `/types/${f}.d.ts`,
          transform: removePrivateTypesDefine,
        })),
        // {
        //   from: '../github-wcex/wcex/README.md',
        //   to: path.join(OUTPUT_PATH, 'README.md'),
        // },
        // {
        //   from: '../github-wcex/wcex/LICENSE',
        //   to: path.join(OUTPUT_PATH, 'LICENSE'),
        // },
      ],
    }),
    // 完成后命令
    // new WebpackShellPluginNext({
    //   // onBeforeBuild,onBuildError,onBuildStart,onBuildEnd,onBuildExit,onWatchRun,onDoneWatch,onBeforeNormalRun,onAfterDone
    //   onAfterDone: {
    //     scripts: [
    //       () => {
    //         console.log(`${projectPkg.name} DONE`);
    //       },
    //     ],
    //   },
    // }),
  ],
};

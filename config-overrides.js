const { ProvidePlugin } = require('webpack');

module.exports = {
  webpack: function (config, env) {
    config.resolve.fallback = {
      crypto: require.resolve('crypto-browserify'),
      stream: require.resolve('stream-browserify'),
      buffer: require.resolve('buffer'),
      path: require.resolve('path-browserify'),
      fs: false,
      os: false,
      net: false,
      http: require.resolve('http-browserify'),
      https: require.resolve('https-browserify'),
      zlib: require.resolve('browserify-zlib'),
      assert: false,
      url: false,
      util: require.resolve('util'),
    };

    config.plugins.push(
      new ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
        process: 'process/browser',
      }),
    );
    config.module.rules = config.module.rules.map((rule) => {
      if (rule.oneOf instanceof Array) {
        return {
          ...rule,
          // create-react-app let every file which doesn't match to any filename test falls back to file-loader,
          // so we need to add purs-loader before that fallback.
          // see: https://github.com/facebookincubator/create-react-app/blob/master/packages/react-scripts/config/webpack.config.dev.js#L220-L236
          oneOf: [
            {
              test: /\.m?js/, // fix:issue: https://github.com/webpack/webpack/issues/11467
              resolve: {
                fullySpecified: false,
              },
            },
            ...rule.oneOf,
          ],
        };
      }

      return rule;
    });
    return config;
  },
};

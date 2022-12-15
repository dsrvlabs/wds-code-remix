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

    return config;
  },
};

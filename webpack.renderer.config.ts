import type { Configuration } from 'webpack';

import { rules } from './webpack.rules';
import { plugins } from './webpack.plugins';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import path from 'path';

const assets = ['assets'];
const copyPlugins = new CopyWebpackPlugin(
  {
    patterns: assets.map((asset) => ({
      from: path.resolve(__dirname, 'src', asset),
      to: path.resolve(__dirname, '.webpack/renderer', asset)
    }))
  }
);

// Update CSS rule to properly handle Tailwind CSS
rules.push({
  test: /\.css$/,
  use: [
    { loader: 'style-loader' },
    { loader: 'css-loader' },
    { loader: 'postcss-loader' }
  ],
});

// Add rule for image files
rules.push({
  test: /\.(png|jpg|jpeg|gif|svg)$/,
  type: 'asset/resource',
});

export const rendererConfig: Configuration = {
  module: {
    rules,
  },
  plugins: [...plugins, copyPlugins],
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
};

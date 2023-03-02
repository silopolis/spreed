/*
 * @copyright Copyright (c) 2022 Grigorii Shartsev <grigorii.shartsev@nextcloud.com>
 *
 * @author Grigorii Shartsev <grigorii.shartsev@nextcloud.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

const webpackRules = require('@nextcloud/webpack-vue-config/rules')
const BabelLoaderExcludeNodeModulesExcept = require('babel-loader-exclude-node-modules-except')

// Edit JS rule
webpackRules.RULE_JS.exclude = BabelLoaderExcludeNodeModulesExcept([
	'@nextcloud/vue-richtext',
	'@nextcloud/event-bus',
	'ansi-regex',
	'color.js',
	'fast-xml-parser',
	'hot-patcher',
	'nextcloud-vue-collections',
	'semver',
	'strip-ansi',
	'tributejs',
	'vue-resize',
	'webdav',
])

module.exports = {
	module: {
		rules: [
			// Reuse @nextcloud/webpack-vue-config/rules
			...Object.values(webpackRules),

			{
				/**
				 * webrtc-adapter main module does no longer provide
				 * "module.exports", which is expected by some elements using it
				 * (like "attachmediastream"), so it needs to be added back with
				 * a plugin.
				 */
				test: /node_modules[\\/]webrtc-adapter[\\/].*\.js$/,
				loader: 'babel-loader',
				options: {
					plugins: ['add-module-exports'],
					presets: [
						/**
						 * From "add-module-exports" documentation:
						 * "webpack doesn't perform commonjs transformation for
						 * codesplitting. Need to set commonjs conversion."
						 */
						['@babel/env', { modules: 'commonjs' }],
					],
				},
			},
			{
				test: /\.wasm$/i,
				type: 'asset/resource',
			},
			{
				test: /\.tflite$/i,
				type: 'asset/resource',
			},
			{
				test: /\.worker\.js$/,
				use: { loader: 'worker-loader' },
			},
		]
	},
}

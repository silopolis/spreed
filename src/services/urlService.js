/*
 * @copyright Copyright (c) 2023 Grigorii Shartsev <grigorii.shartsev@nextcloud.com>
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

import { generateUrl } from '@nextcloud/router'

/**
 * Generate a full absolute link with @nextcloud/router.generateUrl
 * @see @nextcloud/router.generateUrl
 * @param {string} url
 * @param {object} [params] parameters to be replaced into the address
 * @param {import('@nextcloud/router').UrlOptions} [options] options for the parameter replacement
 * @param {boolean} options.noRewrite True if you want to force index.php being added
 * @param {boolean} options.escape Set to false if parameters should not be URL encoded (default true)
 * @return {string} Full absolute URL
 */
export function generateAbsoluteUrl(url, params, options) {
	const fullPath = generateUrl(url, params, options)
	if (!IS_TALK_DESKTOP) {
		return `${OC.getProtocol()}://${OC.getHost()}${fullPath}`
	} else {
		// FIXME: Not clean solution...
		// generateUrl returns full URL on Desktop
		// Better to add functions method to @nextcloud/router to have ability to get server url and generate full URLs
		return fullPath;
	}
}

/**
 * Generate full link to conversation
 * @param {string} token - Conversation token
 * @param {string} [messageId] - messageId for message in conversation link
 * @return {string} - Absolute URL to conversation
 */
export function generateFullConversationLink(token, messageId) {
	return messageId !== undefined
		? generateAbsoluteUrl('/call/{token}#messageId_{messageId}', {
			token,
			messageId,
		})
		: generateAbsoluteUrl('/call/{token}', { token })
}

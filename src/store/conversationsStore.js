/**
 * @copyright Copyright (c) 2019 Marco Ambrosini <marcoambrosini@icloud.com>
 *
 * @author Marco Ambrosini <marcoambrosini@icloud.com>
 *
 * @license AGPL-3.0-or-later
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
 *
 */
import Vue from 'vue'

import { getCurrentUser } from '@nextcloud/auth'
import { showInfo, showSuccess, TOAST_PERMANENT_TIMEOUT } from '@nextcloud/dialogs'

import {
	CALL,
	CONVERSATION,
	PARTICIPANT,
	WEBINAR,
} from '../constants.js'
import {
	makePublic,
	makePrivate,
	setSIPEnabled,
	changeLobbyState,
	changeReadOnlyState,
	changeListable,
	createOneToOneConversation,
	addToFavorites,
	removeFromFavorites,
	fetchConversations,
	fetchConversation,
	setConversationName,
	setConversationDescription,
	deleteConversation,
	clearConversationHistory,
	setNotificationLevel,
	setNotificationCalls,
	setConversationPermissions,
	setCallPermissions,
	setMessageExpiration,
	setConversationPassword,
} from '../services/conversationsService.js'
import {
	startCallRecording,
	stopCallRecording,
} from '../services/recordingService.js'

const DUMMY_CONVERSATION = {
	token: '',
	displayName: '',
	isFavorite: false,
	hasPassword: false,
	breakoutRoomMode: CONVERSATION.BREAKOUT_ROOM_MODE.NOT_CONFIGURED,
	breakoutRoomStatus: CONVERSATION.BREAKOUT_ROOM_STATUS.STOPPED,
	canEnableSIP: false,
	type: CONVERSATION.TYPE.PUBLIC,
	participantFlags: PARTICIPANT.CALL_FLAG.DISCONNECTED,
	participantType: PARTICIPANT.TYPE.USER,
	readOnly: CONVERSATION.STATE.READ_ONLY,
	listable: CONVERSATION.LISTABLE.NONE,
	hasCall: false,
	canStartCall: false,
	lobbyState: WEBINAR.LOBBY.NONE,
	lobbyTimer: 0,
	attendeePin: '',
	isDummyConversation: true,
}

const getDefaultState = () => {
	return {
		conversations: {
		},
	}
}

const state = {
	conversations: {
	},
}

const getters = {
	conversations: state => state.conversations,
	conversationsList: state => Object.values(state.conversations).filter(conversation => {
		// Filter out breakout rooms from left sidebar
		return conversation.objectType !== 'room'
	}),
	/**
	 * Get a conversation providing its token
	 *
	 * @param {object} state state object
	 * @return {Function} The callback function returning the conversation object
	 */
	conversation: state => token => state.conversations[token],
	dummyConversation: state => Object.assign({}, DUMMY_CONVERSATION),
}

const mutations = {
	/**
	 * Adds a conversation to the store.
	 *
	 * @param {object} state current store state;
	 * @param {object} conversation the conversation;
	 */
	addConversation(state, conversation) {
		Vue.set(state.conversations, conversation.token, conversation)
	},
	/**
	 * Deletes a conversation from the store.
	 *
	 * @param {object} state current store state;
	 * @param {object} token the token of the conversation to delete;
	 */
	deleteConversation(state, token) {
		Vue.delete(state.conversations, token)
	},
	/**
	 * Resets the store to it's original state
	 *
	 * @param {object} state current store state;
	 */
	purgeConversationsStore(state) {
		Object.assign(state, getDefaultState())
	},

	setConversationDescription(state, { token, description }) {
		Vue.set(state.conversations[token], 'description', description)
	},

	updateConversationLastReadMessage(state, { token, lastReadMessage }) {
		Vue.set(state.conversations[token], 'lastReadMessage', lastReadMessage)
	},

	updateConversationLastMessage(state, { token, lastMessage }) {
		Vue.set(state.conversations[token], 'lastMessage', lastMessage)
	},

	updateUnreadMessages(state, { token, unreadMessages, unreadMention, unreadMentionDirect }) {
		if (unreadMessages !== undefined) {
			Vue.set(state.conversations[token], 'unreadMessages', unreadMessages)
		}
		if (unreadMention !== undefined) {
			Vue.set(state.conversations[token], 'unreadMention', unreadMention)
		}
		if (unreadMentionDirect !== undefined) {
			Vue.set(state.conversations[token], 'unreadMentionDirect', unreadMentionDirect)
		}
	},

	overwriteHasCallByChat(state, { token, hasCall }) {
		if (hasCall) {
			Vue.set(state.conversations[token], 'hasCallOverwrittenByChat', hasCall)
		} else {
			Vue.delete(state.conversations[token], 'hasCallOverwrittenByChat')
		}
	},

	setNotificationLevel(state, { token, notificationLevel }) {
		Vue.set(state.conversations[token], 'notificationLevel', notificationLevel)
	},

	setNotificationCalls(state, { token, notificationCalls }) {
		Vue.set(state.conversations[token], 'notificationCalls', notificationCalls)
	},

	setConversationPermissions(state, { token, permissions }) {
		Vue.set(state.conversations[token], 'defaultPermissions', permissions)
	},

	setCallPermissions(state, { token, permissions }) {
		Vue.set(state.conversations[token], 'callPermissions', permissions)
	},

	setCallRecording(state, { token, callRecording }) {
		Vue.set(state.conversations[token], 'callRecording', callRecording)
	},

	setMessageExpiration(state, { token, seconds }) {
		Vue.set(state.conversations[token], 'messageExpiration', seconds)
	},

	setConversationHasPassword(state, { token, hasPassword }) {
		Vue.set(state.conversations[token], 'hasPassword', hasPassword)
	},
}

const actions = {
	/**
	 * Add a conversation to the store and index the displayname.
	 *
	 * @param {object} context default store context;
	 * @param {object} conversation the conversation;
	 */
	addConversation(context, conversation) {
		context.commit('addConversation', conversation)

		let currentUser = {
			uid: context.getters.getUserId(),
			displayName: context.getters.getDisplayName(),
		}

		// Fallback to getCurrentUser() only if if has not been set yet (as
		// getCurrentUser() needs to be overriden in public share pages as it
		// always returns an anonymous user).
		if (!currentUser.uid) {
			currentUser = getCurrentUser()
		}
		context.dispatch('addParticipantOnce', {
			token: conversation.token,
			participant: {
				inCall: conversation.participantFlags,
				lastPing: conversation.lastPing,
				sessionIds: [conversation.sessionId],
				participantType: conversation.participantType,
				attendeeId: conversation.attendeeId,
				actorType: conversation.actorType,
				actorId: conversation.actorId, // FIXME check public share page handling
				userId: currentUser ? currentUser.uid : '',
				displayName: currentUser && currentUser.displayName ? currentUser.displayName : '', // TODO guest name from localstore?
			},
		})
	},

	/**
	 * Delete a conversation from the store.
	 *
	 * @param {object} context default store context;
	 * @param {object} token the token of the conversation to be deleted;
	 */
	deleteConversation(context, token) {
		// FIXME: rename to deleteConversationsFromStore or a better name
		context.dispatch('deleteMessages', token)
		context.commit('deleteConversation', token)
	},

	/**
	 * Delete a conversation from the server.
	 *
	 * @param {object} context default store context;
	 * @param {object} data the wrapping object;
	 * @param {object} data.token the token of the conversation to be deleted;
	 */
	async deleteConversationFromServer(context, { token }) {
		await deleteConversation(token)
		// upon success, also delete from store
		await context.dispatch('deleteConversation', token)
	},

	/**
	 * Delete all the messages from a conversation.
	 *
	 * @param {object} context default store context;
	 * @param {object} data the wrapping object;
	 * @param {object} data.token the token of the conversation whose history is
	 * to be cleared;
	 */
	async clearConversationHistory(context, { token }) {
		try {
			const response = await clearConversationHistory(token)
			context.dispatch('deleteMessages', token)
			return response
		} catch (error) {
			console.debug(
				t('spreed', 'Error while clearing conversation history'),
				error)
		}
	},

	/**
	 * Resets the store to it's original state.
	 *
	 * @param {object} context default store context;
	 */
	purgeConversationsStore(context) {
		// TODO: also purge messages ??
		context.commit('purgeConversationsStore')
	},

	async toggleGuests({ commit, getters }, { token, allowGuests }) {
		const conversation = Object.assign({}, getters.conversations[token])
		if (!conversation) {
			return
		}

		if (allowGuests) {
			await makePublic(token)
			conversation.type = CONVERSATION.TYPE.PUBLIC
		} else {
			await makePrivate(token)
			conversation.type = CONVERSATION.TYPE.GROUP
		}

		commit('addConversation', conversation)
	},

	async toggleFavorite({ commit, getters }, { token, isFavorite }) {
		const conversation = Object.assign({}, getters.conversations[token])
		if (!conversation) {
			return
		}

		// FIXME: logic is reversed
		if (isFavorite) {
			await removeFromFavorites(token)
		} else {
			await addToFavorites(token)
		}
		conversation.isFavorite = !isFavorite

		commit('addConversation', conversation)
	},

	async toggleLobby({ commit, getters }, { token, enableLobby }) {
		const conversation = Object.assign({}, getters.conversations[token])
		if (!conversation) {
			return
		}

		if (enableLobby) {
			await changeLobbyState(token, WEBINAR.LOBBY.NON_MODERATORS)
			conversation.lobbyState = WEBINAR.LOBBY.NON_MODERATORS
		} else {
			await changeLobbyState(token, WEBINAR.LOBBY.NONE)
			conversation.lobbyState = WEBINAR.LOBBY.NONE
		}

		commit('addConversation', conversation)
	},

	async setConversationName({ commit, getters }, { token, name }) {
		const conversation = Object.assign({}, getters.conversations[token])
		if (!conversation) {
			return
		}

		await setConversationName(token, name)
		conversation.displayName = name

		commit('addConversation', conversation)
	},

	async setConversationDescription({ commit }, { token, description }) {
		await setConversationDescription(token, description)
		commit('setConversationDescription', { token, description })
	},

	async setConversationPassword({ commit }, { token, newPassword }) {
		await setConversationPassword(token, newPassword)

		commit('setConversationHasPassword', {
			token,
			hasPassword: !!newPassword,
		})
	},

	async setReadOnlyState({ commit, getters }, { token, readOnly }) {
		const conversation = Object.assign({}, getters.conversations[token])
		if (!conversation) {
			return
		}

		await changeReadOnlyState(token, readOnly)
		conversation.readOnly = readOnly

		commit('addConversation', conversation)
	},

	async setListable({ commit, getters }, { token, listable }) {
		const conversation = Object.assign({}, getters.conversations[token])
		if (!conversation) {
			return
		}

		await changeListable(token, listable)
		conversation.listable = listable

		commit('addConversation', conversation)
	},

	async setLobbyTimer({ commit, getters }, { token, timestamp }) {
		const conversation = Object.assign({}, getters.conversations[token])
		if (!conversation) {
			return
		}

		// The backend requires the state and timestamp to be set together.
		await changeLobbyState(token, conversation.lobbyState, timestamp)
		conversation.lobbyTimer = timestamp

		commit('addConversation', conversation)
	},

	async setSIPEnabled({ commit, getters }, { token, state }) {
		const conversation = Object.assign({}, getters.conversations[token])
		if (!conversation) {
			return
		}

		await setSIPEnabled(token, state)
		conversation.sipEnabled = state

		commit('addConversation', conversation)
	},

	async setConversationProperties({ commit, getters }, { token, properties }) {
		let conversation = Object.assign({}, getters.conversations[token])
		if (!conversation) {
			return
		}

		conversation = Object.assign(conversation, properties)

		commit('addConversation', conversation)
	},

	async markConversationRead({ commit, getters }, token) {
		const conversation = Object.assign({}, getters.conversations[token])
		if (!conversation) {
			return
		}

		conversation.unreadMessages = 0
		conversation.unreadMention = false

		commit('addConversation', conversation)
	},

	async updateLastCommonReadMessage({ commit, getters }, { token, lastCommonReadMessage }) {
		const conversation = Object.assign({}, getters.conversations[token])
		if (!conversation) {
			return
		}

		conversation.lastCommonReadMessage = lastCommonReadMessage

		commit('addConversation', conversation)
	},

	async updateConversationLastActive({ commit, getters }, token) {
		const conversation = Object.assign({}, getters.conversations[token])
		if (!conversation) {
			return
		}

		conversation.lastActivity = (new Date().getTime()) / 1000

		commit('addConversation', conversation)
	},

	async updateConversationLastMessage({ commit }, { token, lastMessage }) {
		/**
		 * Only use the last message as lastmessage when:
		 * 1. It's not a command reply
		 * 2. It's not a temporary message starting with "/" which is a user posting a command
		 * 3. It's not a reaction or deletion of a reaction
		 * 3. It's not a deletion of a message
		 */
		if ((lastMessage.actorType !== 'bots'
				|| lastMessage.actorId === 'changelog')
			&& lastMessage.systemMessage !== 'reaction'
			&& lastMessage.systemMessage !== 'poll_voted'
			&& lastMessage.systemMessage !== 'reaction_deleted'
			&& lastMessage.systemMessage !== 'reaction_revoked'
			&& lastMessage.systemMessage !== 'message_deleted'
			&& !(typeof lastMessage.id.startsWith === 'function'
				&& lastMessage.id.startsWith('temp-')
				&& lastMessage.message.startsWith('/'))) {
			commit('updateConversationLastMessage', { token, lastMessage })
		}
	},

	async updateConversationLastMessageFromNotification({ getters, commit }, { notification }) {
		const [token, messageId] = notification.objectId.split('/')
		const conversation = { ...getters.conversation(token) }

		if (!conversation) {
			// Conversation not loaded yet, skipping
			return
		}

		const actor = notification.subjectRichParameters.user || notification.subjectRichParameters.guest || {
			type: 'guest',
			id: 'unknown',
			name: t('spreed', 'Guest'),
		}

		const lastMessage = {
			token,
			id: parseInt(messageId, 10),
			actorType: actor.type + 's',
			actorId: actor.id,
			actorDisplayName: actor.name,
			message: notification.messageRich,
			messageParameters: notification.messageRichParameters,
			timestamp: (new Date(notification.datetime)).getTime() / 1000,

			// Inaccurate but best effort from here on:
			expirationTimestamp: 0,
			isReplyable: true,
			messageType: 'comment',
			reactions: {},
			referenceId: '',
			systemMessage: '',
		}

		const unreadCounterUpdate = {
			token,
			unreadMessages: conversation.unreadMessages,
			unreadMention: conversation.unreadMention,
			unreadMentionDirect: conversation.unreadMentionDirect,
		}

		if (conversation.type === CONVERSATION.TYPE.ONE_TO_ONE) {
			unreadCounterUpdate.unreadMessages++
			unreadCounterUpdate.unreadMention++
			unreadCounterUpdate.unreadMentionDirect = true
		} else {
			unreadCounterUpdate.unreadMessages++
			Object.keys(notification.messageRichParameters).forEach(function(p) {
				const parameter = notification.messageRichParameters[p]
				if (parameter.type === 'user' && parameter.id === notification.user) {
					unreadCounterUpdate.unreadMention++
					unreadCounterUpdate.unreadMentionDirect = true
				} else if (parameter.type === 'call' && parameter.id === token) {
					unreadCounterUpdate.unreadMention++
				}
			})
		}
		conversation.lastActivity = lastMessage.timestamp

		commit('addConversation', conversation)
		commit('updateConversationLastMessage', { token, lastMessage })
		commit('updateUnreadMessages', unreadCounterUpdate)
	},

	async updateCallStateFromNotification({ getters, commit }, { notification }) {
		const token = notification.objectId
		const conversation = { ...getters.conversation(token) }

		if (!conversation) {
			// Conversation not loaded yet, skipping
			return
		}

		conversation.hasCall = true
		conversation.callFlag = PARTICIPANT.CALL_FLAG.WITH_VIDEO
		conversation.activeSince = (new Date(notification.datetime)).getTime() / 1000
		conversation.lastActivity = conversation.activeSince
		conversation.callStartTime = conversation.activeSince

		// Inaccurate but best effort from here on:
		const lastMessage = {
			token,
			id: 'temp' + conversation.activeSince,
			actorType: 'guests',
			actorId: 'unknown',
			actorDisplayName: t('spreed', 'Guest'),
			message: notification.subjectRich,
			messageParameters: notification.subjectRichParameters,
			timestamp: conversation.activeSince,
			messageType: 'system',
			systemMessage: 'call_started',
			expirationTimestamp: 0,
			isReplyable: false,
			reactions: {},
			referenceId: '',
		}

		commit('updateConversationLastMessage', { token, lastMessage })
		commit('addConversation', conversation)
	},

	async updateConversationLastReadMessage({ commit, getters }, { token, lastReadMessage }) {
		commit('updateConversationLastReadMessage', { token, lastReadMessage })

		const unreadMessages = getters.conversation(token).lastMessage.id - lastReadMessage
		commit('updateUnreadMessages', { token, unreadMessages })
	},

	async overwriteHasCallByChat({ commit }, { token, hasCall }) {
		commit('overwriteHasCallByChat', { token, hasCall })
	},

	async fetchConversation({ dispatch }, { token }) {
		try {
			dispatch('clearMaintenanceMode')
			const response = await fetchConversation(token)
			dispatch('updateTalkVersionHash', response)
			dispatch('addConversation', response.data.ocs.data)
			return response
		} catch (error) {
			if (error?.response) {
				dispatch('checkMaintenanceMode', error.response)
			}
			throw error
		}
	},

	async fetchConversations({ dispatch }, { modifiedSince }) {
		try {
			dispatch('clearMaintenanceMode')
			modifiedSince = modifiedSince || 0

			let options = {}
			if (modifiedSince !== 0) {
				options = {
					params: {
						modifiedSince,
					},
				}
			}

			const response = await fetchConversations(options)
			dispatch('updateTalkVersionHash', response)
			if (modifiedSince === 0) {
				dispatch('purgeConversationsStore')
			}
			response.data.ocs.data.forEach(conversation => {
				dispatch('addConversation', conversation)
			})
			return response
		} catch (error) {
			if (error?.response) {
				dispatch('checkMaintenanceMode', error.response)
			}
			throw error
		}
	},

	async setNotificationLevel({ commit }, { token, notificationLevel }) {
		await setNotificationLevel(token, notificationLevel)

		commit('setNotificationLevel', { token, notificationLevel })
	},

	async setNotificationCalls({ commit }, { token, notificationCalls }) {
		await setNotificationCalls(token, notificationCalls)

		commit('setNotificationCalls', { token, notificationCalls })
	},

	/**
	 * Creates a new one to one conversation in the backend
	 * with the given actor then adds it to the store.
	 *
	 * @param {object} context default store context;
	 * @param {string} actorId actor id;
	 */
	async createOneToOneConversation(context, actorId) {
		const response = await createOneToOneConversation(actorId)
		const conversation = response.data.ocs.data
		context.dispatch('addConversation', conversation)

		return conversation
	},

	async setConversationPermissions(context, { token, permissions }) {
		await setConversationPermissions(token, permissions)
		context.commit('setConversationPermissions', { token, permissions })
	},

	async setMessageExpiration({ commit }, { token, seconds }) {
		await setMessageExpiration(token, seconds)
		commit('setMessageExpiration', { token, seconds })
	},

	async setCallPermissions(context, { token, permissions }) {
		await setCallPermissions(token, permissions)
		context.commit('setCallPermissions', { token, permissions })
	},

	async startCallRecording(context, { token, callRecording }) {
		try {
			await startCallRecording(token, callRecording)
		} catch (e) {
			console.error(e)
		}

		const startingCallRecording = callRecording === CALL.RECORDING.VIDEO ? CALL.RECORDING.VIDEO_STARTING : CALL.RECORDING.AUDIO_STARTING

		showSuccess(t('spreed', 'Call recording is starting.'))
		context.commit('setCallRecording', { token, callRecording: startingCallRecording })
	},

	async stopCallRecording(context, { token }) {
		const previousCallRecordingStatus = context.getters.conversation(token).callRecording

		try {
			await stopCallRecording(token)
		} catch (e) {
			console.error(e)
		}

		if (previousCallRecordingStatus === CALL.RECORDING.AUDIO_STARTING
			|| previousCallRecordingStatus === CALL.RECORDING.VIDEO_STARTING) {
			showInfo(t('spreed', 'Call recording stopped while starting.'))
		} else {
			showInfo(t('spreed', 'Call recording stopped. You will be notified once the recording is available.'), {
				timeout: TOAST_PERMANENT_TIMEOUT,
			})
		}
		context.commit('setCallRecording', { token, callRecording: CALL.RECORDING.OFF })
	},
}

export default { state, mutations, getters, actions }

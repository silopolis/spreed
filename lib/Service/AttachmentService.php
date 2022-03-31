<?php

namespace OCA\Talk\Service;

use OCA\Talk\Model\Attachment;
use OCA\Talk\Model\AttachmentMapper;
use OCA\Talk\Room;
use OCP\Comments\IComment;

class AttachmentService {
	public AttachmentMapper $attachmentMapper;

	public function __construct(AttachmentMapper $attachmentMapper) {
		$this->attachmentMapper = $attachmentMapper;
	}

	public function createAttachmentEntry(Room $room, IComment $comment, string $messageType, array $parameters): void {
		$attachment = new Attachment();
		$attachment->setRoomId($room->getId());
		$attachment->setActorType($comment->getActorType());
		$attachment->setActorId($comment->getActorId());
		$attachment->setMessageId((int) $comment->getId());
		$attachment->setMessageTime($comment->getCreationDateTime()->getTimestamp());

		if ($messageType === 'object_shared') {
			$objectType = $parameters['objectType'] ?? '';
			if ($objectType === 'geo-location') {
				$attachment->setObjectType(Attachment::TYPE_LOCATION);
			} elseif ($objectType === 'deck-card') {
				$attachment->setObjectType(Attachment::TYPE_DECK_CARD);
			} else {
				$attachment->setObjectType(Attachment::TYPE_OTHER);
			}
		} else {
			$messageType = $parameters['metaData']['messageType'] ?? '';
			$mimetype = $parameters['metaData']['mimeType'] ?? '';

			if ($messageType === 'voice-message') {
				$attachment->setObjectType(Attachment::TYPE_VOICE);
			} elseif (str_starts_with($mimetype, 'audio/')) {
				$attachment->setObjectType(Attachment::TYPE_AUDIO);
			} elseif (str_starts_with($mimetype, 'image/') || str_starts_with($mimetype, 'video/')) {
				$attachment->setObjectType(Attachment::TYPE_MEDIA);
			} else {
				$attachment->setObjectType(Attachment::TYPE_FILE);
			}
		}

		$this->attachmentMapper->insert($attachment);
	}

	/**
	 * @param Room $room
	 * @param string $objectType
	 * @param int $offset
	 * @param int $limit
	 * @return Attachment[]
	 */
	public function getAttachmentsByType(Room $room, string $objectType, int $offset, int $limit): array {
		return $this->attachmentMapper->getAttachmentsByType($room->getId(), $objectType, $offset, $limit);
	}
}

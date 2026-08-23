import { Server, Socket } from 'socket.io';
import { setUserSocket, removeSocketById, getSocketIdForUser } from './socketStore';
import { messages, conversations, conversationMembers, users, saveDb, callLogs } from '../store/db';
import { getAdminAuth } from '../config/firebaseAdmin';
import { sendPushToUser } from '../services/pushService';
import type {
  SendMessagePayload,
  TypingPayload,
  ReadReceiptPayload,
  CallInitiatePayload,
  CallRespondPayload,
  SDPPayload,
  ICECandidatePayload,
  EditMessagePayload,
  DeleteMessagePayload,
  UserStatusPayload,
  KeyRotatePayload,
} from '../types';

/** Extend socket.data with our authenticated userId (set once, never overwritten by client events) */
interface AuthenticatedSocketData {
  userId: string;      // internal DB id
  firebaseUid: string; // Firebase UID from verified token
}

type AuthSocket = Socket & { data: AuthenticatedSocketData };

/**
 * Verifies the Firebase ID token passed in socket auth and resolves to the DB user.
 * Returns null if the token is invalid or the user is not found.
 */
async function verifySocketToken(
  token: unknown
): Promise<{ userId: string; firebaseUid: string } | null> {
  if (typeof token !== 'string' || !token) return null;

  const adminAuth = getAdminAuth();
  if (!adminAuth) {
    console.warn('[Socket] Firebase Admin not initialised — cannot verify socket token');
    return null;
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const firebaseUid = decoded.uid;

    let dbUser = users.find(
      (u: any) => u.id === firebaseUid || (u as any).firebaseUid === firebaseUid
    );
    if (!dbUser) {
      const generatedUid = `SEC_${firebaseUid}`;
      const newUser = {
        id: firebaseUid,
        uid: generatedUid,
        email: decoded.email || `${firebaseUid}@slienx.app`,
        displayName: (decoded as any).name || decoded.email?.split('@')[0] || 'SilenX User',
        avatarUrl: (decoded as any).picture || undefined,
        status: 'online' as const,
        lastSeen: new Date(),
        showOnlineStatus: true,
        bio: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };
      users.push(newUser as any);
      dbUser = newUser as any;
      saveDb();
      console.log(`[Socket] Auto-registered missing DB user record for Firebase UID ${firebaseUid}`);
    }

    const activeUser = dbUser!;
    return { userId: activeUser.id, firebaseUid };
  } catch (err: any) {
    console.warn('[Socket] Token verification failed:', err?.errorInfo?.code || err?.message);
    return null;
  }
}

/** Checks that the authenticated socket user is a member of the given conversation (with auto-healing for valid chats). */
function isMemberOf(userId: string, conversationId: string): boolean {
  if (!conversationId) return false;

  const isExplicitMember = conversationMembers.some(
    m => m.conversationId === conversationId && m.userId === userId
  );
  if (isExplicitMember) return true;

  // Auto-heal: If conversation exists in DB or is a direct conversation, add membership
  const convoExists = conversations.some((c: any) => c.id === conversationId);
  const isDirectConvo = conversationId.startsWith('conv_') || conversationId.startsWith('direct_');

  if (convoExists || isDirectConvo) {
    conversationMembers.push({
      id: `m_${conversationId}_${userId}`,
      conversationId,
      userId,
      joinedAt: new Date(),
      leftAt: null,
      muted: false,
    });
    saveDb();
    return true;
  }

  return false;
}

export function registerSocketHandlers(io: any): void {
  // ── Token verification on connection ──────────────────────────────────────
  io.use(async (socket: Socket, next: (err?: Error) => void) => {
    const token =
      (socket.handshake.auth as any)?.token ||
      (socket.handshake.headers as any)?.authorization?.replace('Bearer ', '');

    const identity = await verifySocketToken(token);
    if (!identity) {
      // Reject unauthenticated connections entirely
      return next(new Error('UNAUTHORIZED'));
    }

    // Stamp identity on socket.data — will never be overridden by client events
    (socket as AuthSocket).data = {
      userId: identity.userId,
      firebaseUid: identity.firebaseUid,
    };
    return next();
  });

  io.on('connection', (socket: Socket) => {
    const authSocket = socket as AuthSocket;
    const userId = authSocket.data.userId;

    // Register the mapping from userId → socketId (derived from verified token)
    setUserSocket(userId, socket.id);
    console.log(`[Socket] Authenticated user ${userId} connected (${socket.id})`);

    // Mark user as online in DB
    const connectedUser = users.find(u => u.id === userId);
    if (connectedUser) {
      connectedUser.status = 'online';
      connectedUser.lastSeen = new Date();
      saveDb();
      // Broadcast status change
      socket.broadcast.emit('user-status-changed', {
        userId,
        status: 'online',
        lastSeen: connectedUser.lastSeen.toISOString(),
      });
    }

    // ── 'register' event is now a no-op; identity is set from the token ──────
    // Kept for backwards-compat but IGNORED — client cannot set their own userId
    socket.on('register', () => {
      // intentionally empty
    });

    // ─── Heartbeat ──────────────────────────────────────────────────────────
    // Client sends 'heartbeat' every ~20 seconds to signal activity
    socket.on('heartbeat', () => {
      const userObj = users.find(u => u.id === userId);
      if (userObj) {
        userObj.lastSeen = new Date();
        // If somehow marked offline but still has socket, restore online
        if (userObj.status !== 'online') {
          userObj.status = 'online';
          saveDb();
          socket.broadcast.emit('user-status-changed', {
            userId,
            status: 'online',
            lastSeen: userObj.lastSeen.toISOString(),
          });
        }
      }
    });

    // ─── Messaging ──────────────────────────────────────────────────────────

    socket.on('send-message', (data: SendMessagePayload) => {
      // conversationId membership check
      if (!isMemberOf(userId, data.conversationId)) {
        socket.emit('error', { code: 'FORBIDDEN', message: 'Not a member of this conversation' });
        return;
      }

      const newMsg = {
        id: data.tempId || crypto.randomUUID(),
        conversationId: data.conversationId,
        senderId: userId, // always from verified identity
        encryptedContent: data.encryptedContent,
        contentType: data.contentType || 'text',
        createdAt: new Date(),
        editedAt: null,
        deletedAt: null,
        replyTo: data.replyTo,
        mediaUrl: data.mediaUrl,
        fileName: data.fileName,
        fileSize: data.fileSize,
        fileType: data.fileType,
        duration: data.duration,
        locationData: data.locationData,
        contactData: data.contactData,
        pollData: data.pollData,
        eventData: data.eventData,
      };
      // Idempotent persist: offline clients re-emit the same tempId on
      // reconnect, so never store the same message id twice.
      if (!messages.some(m => m.id === newMsg.id)) {
        messages.push(newMsg);
        saveDb();
      }

      // Ack to the sender — the offline sync manager waits for this before
      // dequeuing, guaranteeing exactly-once sends.
      socket.emit('message-sent-ack', { tempId: data.tempId, id: newMsg.id });

      const outgoing = {
        ...data,
        senderId: userId,
        createdAt: newMsg.createdAt.toISOString(),
      };

      // Deliver only to the conversation members who are currently connected
      const convoMemberIds = conversationMembers
        .filter(m => m.conversationId === data.conversationId && m.userId !== userId)
        .map(m => m.userId);

      convoMemberIds.forEach(memberId => {
        const recipientSocketId = getSocketIdForUser(memberId);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('receive-message', outgoing);
        } else {
          // User is offline - send push notification
          sendPushToUser(memberId, {
            conversationId: data.conversationId,
            senderId: userId,
            senderDisplayName: users.find(u => u.id === userId)?.displayName || 'SilenX User',
            messageId: newMsg.id,
          });
        }
      });
    });

    socket.on('edit-message', (data: EditMessagePayload) => {
      const msg = messages.find(m => m.id === data.messageId);
      if (!msg || msg.senderId !== userId) {
        socket.emit('error', { code: 'FORBIDDEN', message: 'Cannot edit this message' });
        return;
      }
      msg.encryptedContent = data.newEncryptedContent;
      msg.editedAt = new Date();
      saveDb();

      const convoMemberIds = conversationMembers
        .filter(m => m.conversationId === data.conversationId && m.userId !== userId)
        .map(m => m.userId);

      convoMemberIds.forEach(memberId => {
        const recipientSocketId = getSocketIdForUser(memberId);
        if (recipientSocketId) {
          socket.to(recipientSocketId).emit('message-edited', {
            ...data,
            editedAt: msg.editedAt!.toISOString(),
          });
        }
      });
    });

    socket.on('delete-message', (data: DeleteMessagePayload) => {
      const msg = messages.find(m => m.id === data.messageId);
      if (!msg || msg.senderId !== userId) {
        socket.emit('error', { code: 'FORBIDDEN', message: 'Cannot delete this message' });
        return;
      }
      msg.deletedAt = new Date();
      saveDb();

      const convoMemberIds = conversationMembers
        .filter(m => m.conversationId === data.conversationId && m.userId !== userId)
        .map(m => m.userId);

      convoMemberIds.forEach(memberId => {
        const recipientSocketId = getSocketIdForUser(memberId);
        if (recipientSocketId) {
          socket.to(recipientSocketId).emit('message-deleted', {
            messageId: data.messageId,
            conversationId: data.conversationId,
          });
        }
      });
    });

    socket.on(
      'message-reaction',
      (data: { messageId: string; conversationId: string; emoji: string }) => {
        if (!isMemberOf(userId, data.conversationId)) {
          socket.emit('error', { code: 'FORBIDDEN' });
          return;
        }

        const msg = messages.find(m => m.id === data.messageId);
        if (msg) {
          if (!msg.reactions) msg.reactions = [];
          const existingIdx = msg.reactions.findIndex(r => r.userId === userId);
          if (existingIdx > -1) {
            if (msg.reactions[existingIdx].emoji === data.emoji || !data.emoji) {
              msg.reactions.splice(existingIdx, 1);
            } else {
              msg.reactions[existingIdx].emoji = data.emoji;
            }
          } else if (data.emoji) {
            msg.reactions.push({ userId, emoji: data.emoji });
          }
          saveDb();

          const convoMemberIds = conversationMembers
            .filter(m => m.conversationId === data.conversationId && m.userId !== userId)
            .map(m => m.userId);

          convoMemberIds.forEach(memberId => {
            const recipientSocketId = getSocketIdForUser(memberId);
            if (recipientSocketId) {
              socket.to(recipientSocketId).emit('receive-message-reaction', {
                messageId: data.messageId,
                conversationId: data.conversationId,
                userId,
                emoji: data.emoji,
              });
            }
          });
        }
      }
    );

    socket.on(
      'vote-poll',
      (data: { messageId: string; conversationId: string; optionId: string }) => {
        if (!isMemberOf(userId, data.conversationId)) {
          socket.emit('error', { code: 'FORBIDDEN' });
          return;
        }

        const msg = messages.find(m => m.id === data.messageId);
        if (msg && msg.pollData) {
          const option = msg.pollData.options.find(o => o.id === data.optionId);
          if (option) {
            const voteIdx = option.votes.indexOf(userId);
            if (voteIdx > -1) {
              option.votes.splice(voteIdx, 1);
            } else {
              option.votes.push(userId);
            }
            saveDb();

            const convoMemberIds = conversationMembers
              .filter(m => m.conversationId === data.conversationId && m.userId !== userId)
              .map(m => m.userId);

            convoMemberIds.forEach(memberId => {
              const recipientSocketId = getSocketIdForUser(memberId);
              if (recipientSocketId) {
                socket.to(recipientSocketId).emit('poll-voted', {
                  messageId: data.messageId,
                  conversationId: data.conversationId,
                  pollData: msg.pollData,
                });
              }
            });
          }
        }
      }
    );

    // ─── Read Receipts ──────────────────────────────────────────────────────

    socket.on('read-receipt', (data: ReadReceiptPayload) => {
      if (!data?.conversationId) return;

      // Mark messages sent by others in this conversation as read in DB
      let updatedCount = 0;
      messages.forEach(m => {
        if (m.conversationId === data.conversationId && m.senderId !== userId) {
          (m as any).isRead = true;
          (m as any).deliveryStatus = 'read';
          updatedCount++;
        }
      });

      if (updatedCount > 0) {
        saveDb();
      }

      const convoMemberIds = conversationMembers
        .filter(m => m.conversationId === data.conversationId && m.userId !== userId)
        .map(m => m.userId);

      convoMemberIds.forEach(memberId => {
        const recipientSocketId = getSocketIdForUser(memberId);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('messages-read', {
            conversationId: data.conversationId,
            readBy: userId,
            readAt: new Date().toISOString(),
          });
          io.to(recipientSocketId).emit('message-read', {
            ...data,
            userId,
            readAt: new Date().toISOString(),
          });
        }
      });
    });

    socket.on('mark-messages-read', (data: { conversationId: string }) => {
      if (!data?.conversationId) return;

      messages.forEach(m => {
        if (m.conversationId === data.conversationId && m.senderId !== userId) {
          (m as any).isRead = true;
          (m as any).deliveryStatus = 'read';
        }
      });
      saveDb();

      const convoMemberIds = conversationMembers
        .filter(m => m.conversationId === data.conversationId && m.userId !== userId)
        .map(m => m.userId);

      convoMemberIds.forEach(memberId => {
        const recipientSocketId = getSocketIdForUser(memberId);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('messages-read', {
            conversationId: data.conversationId,
            readBy: userId,
            readAt: new Date().toISOString(),
          });
        }
      });
    });

    // ─── Typing Indicators ──────────────────────────────────────────────────

    socket.on('typing', (data: TypingPayload) => {
      const convoMemberIds = conversationMembers
        .filter(m => m.conversationId === data.conversationId && m.userId !== userId)
        .map(m => m.userId);

      convoMemberIds.forEach(memberId => {
        const recipientSocketId = getSocketIdForUser(memberId);
        if (recipientSocketId) {
          socket.to(recipientSocketId).emit('user-typing', {
            conversationId: data.conversationId,
            userId, // always from verified identity
          });
        }
      });
    });

    socket.on('typing-stopped', (data: TypingPayload) => {
      const convoMemberIds = conversationMembers
        .filter(m => m.conversationId === data.conversationId && m.userId !== userId)
        .map(m => m.userId);

      convoMemberIds.forEach(memberId => {
        const recipientSocketId = getSocketIdForUser(memberId);
        if (recipientSocketId) {
          socket.to(recipientSocketId).emit('user-typing-stopped', {
            conversationId: data.conversationId,
            userId,
          });
        }
      });
    });

    // ─── User Status ────────────────────────────────────────────────────────

    socket.on('user-status', (data: UserStatusPayload) => {
      // Broadcast to ALL connected users (public status change)
      const userObj = users.find(u => u.id === userId);
      if (userObj) {
        userObj.status = data.status;
        if (data.status === 'offline') {
          userObj.lastSeen = new Date();
        }
        saveDb();
        socket.broadcast.emit('user-status-changed', {
          userId, // always from verified identity, not data.userId
          status: data.status,
          lastSeen: userObj.lastSeen.toISOString(),
        });
      }
    });

    // ─── WebRTC Call Signaling ───────────────────────────────────────────────

    socket.on('call-initiate', (data: CallInitiatePayload) => {
      console.debug('[Socket] call-initiate from', userId, 'to', data.targetUserId);
      const recipientSocketId = getSocketIdForUser(data.targetUserId);
      if (!recipientSocketId) {
        socket.emit('error', { code: 'USER_OFFLINE', message: 'Recipient is offline or unavailable' });
        return;
      }

      // Create a pending call log
      const logId = `call_${Date.now()}_${userId}`;
      callLogs.push({
        id: logId,
        conversationId: `direct_${userId}_${data.targetUserId}`,
        groupId: undefined,
        initiatorId: userId,
        receiverId: data.targetUserId,
        participants: [userId, data.targetUserId],
        callType: data.callType,
        status: 'pending',
        startedAt: new Date(),
        endedAt: null,
        durationSeconds: null,
      });
      saveDb();

      io.to(recipientSocketId).emit('call-incoming', {
        callerId: userId,
        callerName: data.callerName,
        callerAvatarUrl: data.callerAvatarUrl,
        callType: data.callType,
        callLogId: logId,
      });

      // Send back the logId to the caller so they can reference it on end
      socket.emit('call-log-id', { callLogId: logId });

      // Auto-expire unanswered call log after 60s
      setTimeout(() => {
        const pendingLog = callLogs.find((l) => l.id === logId);
        if (pendingLog && pendingLog.status === 'pending') {
          pendingLog.status = 'missed';
          pendingLog.endedAt = new Date();
          saveDb();
        }
      }, 60_000);
    });

    socket.on('call-ringing', (data: { targetUserId: string }) => {
      console.debug('[Socket] call-ringing from', userId, 'to', data.targetUserId);
      const recipientSocketId = getSocketIdForUser(data.targetUserId);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('call-ringing-received', {
          responderId: userId,
        });
      }
    });

    socket.on('call-accept', (data: CallRespondPayload & { callLogId?: string }) => {
      console.debug('[Socket] call-accept from', userId, 'to', data.targetUserId);
      const recipientSocketId = getSocketIdForUser(data.targetUserId);
      if (!recipientSocketId) return;

      const log = data.callLogId
        ? callLogs.find((l) => l.id === data.callLogId)
        : callLogs.find(
            (l) =>
              l.status === 'pending' &&
              l.participants.includes(userId) &&
              l.participants.includes(data.targetUserId)
          );

      if (log) {
        log.status = 'accepted';
        log.startedAt = new Date();
        saveDb();
      }

      io.to(recipientSocketId).emit('call-accepted', {
        responderId: userId,
        responderName: users.find(u => u.id === userId)?.displayName || 'Unknown',
        callLogId: log?.id || data.callLogId,
      });
    });

    socket.on('call-reject', (data: { targetUserId: string; callLogId?: string }) => {
      console.debug('[Socket] call-reject from', userId, 'to', data.targetUserId);
      const recipientSocketId = getSocketIdForUser(data.targetUserId);

      const log = data.callLogId
        ? callLogs.find((l) => l.id === data.callLogId)
        : callLogs.find(
            (l) =>
              l.status === 'pending' &&
              l.participants.includes(userId) &&
              l.participants.includes(data.targetUserId)
          );

      if (log) {
        // If the caller cancels their own call → 'missed'
        // If the receiver declines → 'rejected'
        log.status = log.initiatorId === userId ? 'missed' : 'rejected';
        log.endedAt = new Date();
        log.durationSeconds = 0;
        saveDb();
      }

      if (recipientSocketId) {
        io.to(recipientSocketId).emit('call-rejected', { by: userId });
      }
    });

    socket.on('call-end', (data: { targetUserId: string; callLogId?: string; durationSeconds?: number }) => {
      const recipientSocketId = getSocketIdForUser(data.targetUserId);

      const log = data.callLogId
        ? callLogs.find((l) => l.id === data.callLogId)
        : callLogs.find(
            (l) =>
              (l.status === 'pending' || l.status === 'accepted') &&
              l.participants.includes(userId) &&
              l.participants.includes(data.targetUserId)
          );

      if (log) {
        log.status = 'ended';
        log.endedAt = new Date();
        if (data.durationSeconds !== undefined) {
          log.durationSeconds = data.durationSeconds;
        } else if (log.startedAt) {
          log.durationSeconds = Math.floor((Date.now() - new Date(log.startedAt).getTime()) / 1000);
        }
        saveDb();
      }

      if (recipientSocketId) {
        io.to(recipientSocketId).emit('call-ended', { by: userId });
      }
    });

    socket.on('sdp-offer', (data: SDPPayload) => {
      const recipientSocketId = getSocketIdForUser(data.targetUserId);
      if (!recipientSocketId) {
        return;
      }

      io.to(recipientSocketId).emit('sdp-offer-received', {
        sdp: data.sdp,
        senderId: userId,
      });
    });

    socket.on('sdp-answer', (data: SDPPayload) => {
      const recipientSocketId = getSocketIdForUser(data.targetUserId);
      if (!recipientSocketId) {
        return;
      }

      io.to(recipientSocketId).emit('sdp-answer-received', {
        sdp: data.sdp,
        senderId: userId,
      });
    });

    socket.on('ice-candidate', (data: ICECandidatePayload) => {
      const recipientSocketId = getSocketIdForUser(data.targetUserId);
      if (!recipientSocketId) {
        return;
      }

      io.to(recipientSocketId).emit('ice-candidate-received', {
        candidate: data.candidate,
        senderId: userId,
      });
    });

    // ─── E2EE Public Key Recovery Relay ─────────────────────────────────────
    // When a peer's public key is missing server-side (e.g. wiped by a Render
    // restart before MongoDB sync), the requester asks the PEER to re-upload.
    // Pure relay: the server never sees private material, only this signal.
    socket.on('request-public-key', (data: { targetUserId?: string }) => {
      const targetUserId = data?.targetUserId;
      if (!targetUserId || targetUserId === userId) return;

      // Verify the requester actually shares a conversation with the target —
      // prevents using this as a presence oracle for arbitrary users.
      const myConvoIds = new Set(
        conversationMembers.filter((m) => m.userId === userId).map((m) => m.conversationId)
      );
      const sharesConversation = conversationMembers.some(
        (m) => m.userId === targetUserId && myConvoIds.has(m.conversationId)
      );
      if (!sharesConversation) return;

      const recipientSocketId = getSocketIdForUser(targetUserId);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('upload-your-public-key', {
          requestedBy: userId,
        });
      }
    });

    // ─── E2EE Key Rotation Handshake ────────────────────────────────────────
    // Pure relay: only PUBLIC ephemeral keys transit the server. Shared
    // secrets are derived independently on each device and never transmitted,
    // so old (or new) session keys are never exposed to the backend.

    socket.on('key:rotate-request', (data: KeyRotatePayload) => {
      const recipientSocketId = getSocketIdForUser(data.targetUserId);
      if (!recipientSocketId || data.targetUserId === userId) {
        return;
      }
      io.to(recipientSocketId).emit('key:rotate-request-received', {
        conversationId: data.conversationId,
        epoch: data.epoch,
        ephemeralPublicKey: data.ephemeralPublicKey,
        senderId: userId,
      });
    });

    socket.on('key:rotate-ack', (data: KeyRotatePayload) => {
      const recipientSocketId = getSocketIdForUser(data.targetUserId);
      if (!recipientSocketId || data.targetUserId === userId) {
        return;
      }
      io.to(recipientSocketId).emit('key:rotate-ack-received', {
        conversationId: data.conversationId,
        epoch: data.epoch,
        ephemeralPublicKey: data.ephemeralPublicKey,
        senderId: userId,
      });
    });

    // ─── Disconnect ─────────────────────────────────────────────────────────

    socket.on('disconnect', (reason: string) => {
      console.log(`[Socket] User ${userId} disconnected: ${socket.id}, reason: ${reason}`);
      removeSocketById(socket.id);
      
      // Only set offline if no other sockets are connected for this user
      const stillConnected = getSocketIdForUser(userId) !== null;
      if (!stillConnected) {
        const userObj = users.find(u => u.id === userId);
        if (userObj) {
          userObj.status = 'offline';
          userObj.lastSeen = new Date();
          saveDb();
          // Notify others that this user is offline
          socket.broadcast.emit('user-status-changed', {
            userId,
            status: 'offline',
            lastSeen: userObj.lastSeen.toISOString(),
          });
        }
      }
    });
  });

  // ─── Inactivity Sweeper ─────────────────────────────────────────────────
  // Every 30 seconds, scan for users who haven't sent a heartbeat in 60+ seconds
  // and mark them offline. This handles cases where socket disconnect events
  // are delayed (e.g., network drops, browser crashes).
  const INACTIVITY_MS = 60_000;  // mark offline after 60 seconds of silence
  const SWEEP_INTERVAL_MS = 30_000;

  const inactivityTimer = setInterval(() => {
    const now = Date.now();
    let changed = false;

    users.forEach(user => {
      if (user.status === 'online') {
        const lastSeenMs = user.lastSeen ? new Date(user.lastSeen).getTime() : 0;
        if (now - lastSeenMs > INACTIVITY_MS) {
          user.status = 'offline';
          user.lastSeen = new Date(lastSeenMs); // keep original last active time
          changed = true;
          io.emit('user-status-changed', {
            userId: user.id,
            status: 'offline',
            lastSeen: user.lastSeen.toISOString(),
          });
          console.log(`[Presence] Marked ${user.id} offline due to inactivity`);
        }
      }
    });

    if (changed) {
      saveDb();
    }
  }, SWEEP_INTERVAL_MS);

  // Clean up the interval when the process exits
  process.on('exit', () => clearInterval(inactivityTimer));
}

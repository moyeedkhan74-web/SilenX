import { Server, Socket } from 'socket.io';
import { setUserSocket, removeSocketById, getSocketIdForUser } from './socketStore';
import { messages, conversationMembers, saveDb } from '../store/db';
import { getAdminAuth } from '../config/firebaseAdmin';
import { users } from '../store/db';
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

    const dbUser = users.find(
      (u: any) => u.id === firebaseUid || (u as any).firebaseUid === firebaseUid
    );
    if (!dbUser) {
      console.warn(`[Socket] No DB record for Firebase UID ${firebaseUid}`);
      return null;
    }

    return { userId: dbUser.id, firebaseUid };
  } catch (err: any) {
    console.warn('[Socket] Token verification failed:', err?.errorInfo?.code || err?.message);
    return null;
  }
}

/** Checks that the authenticated socket user is a member of the given conversation. */
function isMemberOf(userId: string, conversationId: string): boolean {
  return conversationMembers.some(
    m => m.conversationId === conversationId && m.userId === userId
  );
}

export function registerSocketHandlers(io: Server): void {
  // ── Token verification on connection ──────────────────────────────────────
  io.use(async (socket, next) => {
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
      messages.push(newMsg);
      saveDb();

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
      const convoMemberIds = conversationMembers
        .filter(m => m.conversationId === data.conversationId && m.userId !== userId)
        .map(m => m.userId);

      convoMemberIds.forEach(memberId => {
        const recipientSocketId = getSocketIdForUser(memberId);
        if (recipientSocketId) {
          socket.to(recipientSocketId).emit('message-read', {
            ...data,
            userId,
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
    // targetId below refers to a socket ID for WebRTC peer connection setup

    socket.on('call-initiate', (data: CallInitiatePayload) => {
      // data.targetId is the recipient socket ID
      socket.to(data.targetId).emit('call-incoming', {
        callerId: userId, // always from verified identity
        callType: data.callType,
        callerSocketId: socket.id,
      });
    });

    socket.on('call-accept', (data: CallRespondPayload) => {
      socket.to(data.targetId).emit('call-accepted', {
        responderId: userId,
        responderSocketId: socket.id,
      });
    });

    socket.on('call-reject', (data: { targetId: string }) => {
      socket.to(data.targetId).emit('call-rejected', { by: userId });
    });

    socket.on('call-end', (data: { targetId: string }) => {
      if (data.targetId) {
        socket.to(data.targetId).emit('call-ended', { by: userId });
      }
    });

    socket.on('sdp-offer', (data: SDPPayload) => {
      socket.to(data.targetId).emit('sdp-offer-received', {
        sdp: data.sdp,
        callerId: userId,
      });
    });

    socket.on('sdp-answer', (data: SDPPayload) => {
      socket.to(data.targetId).emit('sdp-answer-received', {
        sdp: data.sdp,
        responderId: userId,
      });
    });

    socket.on('ice-candidate', (data: ICECandidatePayload) => {
      socket.to(data.targetId).emit('ice-candidate-received', {
        candidate: data.candidate,
      });
    });

    // ─── Disconnect ─────────────────────────────────────────────────────────

    socket.on('disconnect', (reason) => {
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
}

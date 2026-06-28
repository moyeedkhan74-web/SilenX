import { Server, Socket } from 'socket.io';
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

export function registerSocketHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] User connected: ${socket.id}`);

    // ─── Messaging ─────────────────────────────────────────

    socket.on('send-message', (data: SendMessagePayload) => {
      console.log(`[Socket] Message from ${socket.id} in conversation ${data.conversationId}`);
      // In production, validate membership and persist to DB
      socket.broadcast.emit('receive-message', {
        ...data,
        senderId: socket.id,
        createdAt: new Date().toISOString(),
      });
    });

    socket.on('edit-message', (data: EditMessagePayload) => {
      console.log(`[Socket] Edit message ${data.messageId}`);
      socket.broadcast.emit('message-edited', {
        ...data,
        editedAt: new Date().toISOString(),
      });
    });

    socket.on('delete-message', (data: DeleteMessagePayload) => {
      console.log(`[Socket] Delete message ${data.messageId}`);
      socket.broadcast.emit('message-deleted', {
        messageId: data.messageId,
        conversationId: data.conversationId,
      });
    });

    // ─── Read Receipts ─────────────────────────────────────

    socket.on('read-receipt', (data: ReadReceiptPayload) => {
      socket.broadcast.emit('message-read', {
        ...data,
        userId: socket.id,
        readAt: new Date().toISOString(),
      });
    });

    // ─── Typing Indicators ─────────────────────────────────

    socket.on('typing', (data: TypingPayload) => {
      socket.broadcast.emit('user-typing', {
        conversationId: data.conversationId,
        userId: data.userId,
      });
    });

    socket.on('typing-stopped', (data: TypingPayload) => {
      socket.broadcast.emit('user-typing-stopped', {
        conversationId: data.conversationId,
        userId: data.userId,
      });
    });

    // ─── User Status ───────────────────────────────────────

    socket.on('user-status', (data: UserStatusPayload) => {
      socket.broadcast.emit('user-status-changed', {
        userId: data.userId,
        status: data.status,
      });
    });

    // ─── WebRTC Call Signaling ──────────────────────────────

    socket.on('call-initiate', (data: CallInitiatePayload) => {
      console.log(`[WebRTC] Call initiate from ${data.callerId} to ${data.targetId} (${data.callType})`);
      socket.to(data.targetId).emit('call-incoming', {
        callerId: data.callerId,
        callType: data.callType,
      });
    });

    socket.on('call-accept', (data: CallRespondPayload) => {
      console.log(`[WebRTC] Call accepted by ${data.responderId}`);
      socket.to(data.targetId).emit('call-accepted', {
        responderId: data.responderId,
      });
    });

    socket.on('call-reject', (data: { targetId: string }) => {
      socket.to(data.targetId).emit('call-rejected');
    });

    socket.on('call-end', (data: { targetId: string }) => {
      if (data.targetId) {
        socket.to(data.targetId).emit('call-ended');
      } else {
        socket.broadcast.emit('call-ended');
      }
    });

    socket.on('sdp-offer', (data: SDPPayload) => {
      socket.to(data.targetId).emit('sdp-offer-received', {
        sdp: data.sdp,
        callerId: data.senderId,
      });
    });

    socket.on('sdp-answer', (data: SDPPayload) => {
      socket.to(data.targetId).emit('sdp-answer-received', {
        sdp: data.sdp,
        responderId: data.senderId,
      });
    });

    socket.on('ice-candidate', (data: ICECandidatePayload) => {
      socket.to(data.targetId).emit('ice-candidate-received', {
        candidate: data.candidate,
      });
    });

    // ─── Disconnect ────────────────────────────────────────

    socket.on('disconnect', (reason) => {
      console.log(`[Socket] User disconnected: ${socket.id}, reason: ${reason}`);
      socket.broadcast.emit('user-disconnected', { userId: socket.id });
    });
  });
}

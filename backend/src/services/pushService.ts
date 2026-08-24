import { getAdminApp } from '../config/firebaseAdmin';
import { getMessaging as getAdminMessaging, Messaging, MulticastMessage, BatchResponse } from 'firebase-admin/messaging';
import { users } from '../store/db';

let messaging: Messaging | null = null;

/** Must match the channel created client-side in nativePush.ts */
const ANDROID_MESSAGE_CHANNEL_ID = 'silenx_messages_channel';

function getMessagingInstance(): Messaging | null {
  if (messaging) return messaging;
  
  const adminApp = getAdminApp();
  if (!adminApp) {
    console.warn('[PushService] Firebase Admin SDK not initialized. Push notifications disabled.');
    return null;
  }
  
  try {
    messaging = getAdminMessaging(adminApp);
    return messaging;
  } catch (error) {
    console.error('[PushService] Failed to get messaging instance:', error);
    return null;
  }
}

interface PushPayload {
  conversationId: string;
  senderId: string;
  messageId: string;
  senderDisplayName: string;
}

/**
 * Send push notification to user's FCM tokens
 * Called when a message is sent to an offline/background user
 */
export async function sendPushNotification(payload: PushPayload): Promise<boolean> {
  const messagingInstance = getMessagingInstance();
  
  if (!messagingInstance) {
    console.warn('[PushService] Messaging not available, skipping push notification');
    return false;
  }

  // Find the sender to get display name
  const sender = users.find(u => u.id === payload.senderId);
  const senderName = sender?.displayName || 'Someone';

  // For now, let's send to all users except sender who have tokens
  const targetUsers = users.filter(u => 
    u.id !== payload.senderId && 
    u.fcmTokens && 
    u.fcmTokens.length > 0
  );

  if (targetUsers.length === 0) {
    console.log('[PushService] No target users with FCM tokens found');
    return false;
  }

  let successCount = 0;
  
  for (const targetUser of targetUsers) {
    if (!targetUser.fcmTokens || targetUser.fcmTokens.length === 0) continue;
    
    const message: MulticastMessage = {
      notification: {
        title: senderName,
        body: '🔒 Encrypted Message',
      },
      data: {
        conversationId: payload.conversationId,
        senderId: payload.senderId,
        messageId: payload.messageId,
        senderDisplayName: senderName,
      },
      android: {
        priority: 'high',
        notification: {
          channelId: ANDROID_MESSAGE_CHANNEL_ID,
          sound: 'default',
          tag: payload.conversationId,
        },
      },
      tokens: targetUser.fcmTokens,
    };

    try {
      const response: BatchResponse = await messagingInstance.sendEachForMulticast(message);
      
      // Handle failed tokens (remove invalid ones)
      if (response.failureCount > 0) {
        const failedTokens: string[] = [];
        response.responses.forEach((resp: any, idx: number) => {
          if (!resp.success) {
            const error = resp.error;
            console.warn(`[PushService] Failed to send to token ${idx}:`, error?.message);
            
            // Remove invalid/expired tokens
            if (error?.code === 'messaging/registration-token-not-registered' ||
                error?.code === 'messaging/invalid-registration-token') {
              failedTokens.push(targetUser.fcmTokens![idx]);
            }
          }
        });
        
        // Remove failed tokens from user's token list
        if (failedTokens.length > 0) {
          targetUser.fcmTokens = targetUser.fcmTokens.filter(t => !failedTokens.includes(t));
        }
      }
      
      successCount += response.successCount;
    } catch (error) {
      console.error('[PushService] Error sending push notification:', error);
    }
  }

  return successCount > 0;
}

/**
 * Send push notification to specific user by their ID
 */
export async function sendPushToUser(userId: string, payload: Omit<PushPayload, 'senderId'> & { senderId: string }): Promise<boolean> {
  const messagingInstance = getMessagingInstance();
  
  if (!messagingInstance) {
    console.warn('[PushService] Messaging not available');
    return false;
  }

  const targetUser = users.find(u => u.id === userId);
  if (!targetUser || !targetUser.fcmTokens || targetUser.fcmTokens.length === 0) {
    console.log('[PushService] Target user not found or has no FCM tokens');
    return false;
  }

  const sender = users.find(u => u.id === payload.senderId);
  const senderName = sender?.displayName || 'Someone';

  const message: MulticastMessage = {
    notification: {
      title: senderName,
      body: '🔒 Encrypted Message',
    },
    data: {
      conversationId: payload.conversationId,
      senderId: payload.senderId,
      messageId: payload.messageId,
      senderDisplayName: senderName,
    },
    android: {
      priority: 'high',
      notification: {
        channelId: ANDROID_MESSAGE_CHANNEL_ID,
        sound: 'default',
        tag: payload.conversationId,
      },
    },
    tokens: targetUser.fcmTokens,
  };

  try {
    const response: BatchResponse = await messagingInstance.sendEachForMulticast(message);
    
    if (response.failureCount > 0) {
      const failedTokens: string[] = [];
      response.responses.forEach((resp: any, idx: number) => {
        if (!resp.success) {
          const error = resp.error;
          if (error?.code === 'messaging/registration-token-not-registered' ||
              error?.code === 'messaging/invalid-registration-token') {
            failedTokens.push(targetUser.fcmTokens![idx]);
          }
        }
      });
      
      if (failedTokens.length > 0) {
        targetUser.fcmTokens = targetUser.fcmTokens.filter(t => !failedTokens.includes(t));
      }
    }
    
    return response.successCount > 0;
  } catch (error) {
    console.error('[PushService] Error sending push to user:', error);
    return false;
  }
}

/**
 * Initialize push service (called at server startup)
 */
export function initializePushService(): void {
  const messagingInstance = getMessagingInstance();
  if (messagingInstance) {
    console.log('[PushService] Firebase Messaging initialized successfully');
  } else {
    console.warn('[PushService] Firebase Messaging not available - push notifications disabled');
  }
}
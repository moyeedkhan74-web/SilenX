package com.dev.silenx;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.RemoteInput;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import org.json.JSONObject;
import java.util.Map;
import java.util.UUID;

public class SilenXFirebaseMessagingService extends FirebaseMessagingService {

    static final String CHANNEL_ID = "silenx_messages"; // package-private: used by ReplyReceiver
    private static final String CHANNEL_NAME = "Messages";
    private static final String PREFS_NAME = "silenx_prefs";
    private static final String KEY_AUTH_JWT = "auth_jwt";
    private static final String KEY_FCM_TOKEN = "fcm_token";

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        // Store token in SharedPreferences
        SharedPreferences prefs = getApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        editor.putString(KEY_FCM_TOKEN, token);
        editor.apply();

        // Register token with backend in background thread
        new Thread(() -> {
            try {
                String jwt = prefs.getString(KEY_AUTH_JWT, null);
                registerTokenWithBackend(token, jwt);
            } catch (Exception e) {
                // Log and never crash
                e.printStackTrace();
            }
        }).start();
    }

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        try {
            Map<String, String> data = remoteMessage.getData();
            if (data == null || data.isEmpty()) {
                return;
            }

            String conversationId = data.get("conversationId");
            String senderId = data.get("senderId");
            String senderName = data.get("senderName");
            String messagePreview = data.get("messagePreview");
            String messageId = data.get("messageId");
            String avatarUrl = data.get("avatarUrl");

            if (conversationId == null || senderName == null || messagePreview == null) {
                return;
            }

            // Build notification intent to open chat
            Intent chatIntent = new Intent(this, MainActivity.class);
            chatIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            chatIntent.putExtra("conversationId", conversationId);
            chatIntent.putExtra("action", "open_chat");

            PendingIntent contentPendingIntent = PendingIntent.getActivity(
                    this,
                    0,
                    chatIntent,
                    PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
            );

            // Build reply RemoteInput
            RemoteInput remoteInput = new RemoteInput.Builder("reply_text")
                    .setLabel("Reply to " + senderName + "…")
                    .setResultHint("Type your reply…")
                    .build();

            // Reply PendingIntent
            Intent replyIntent = new Intent(this, ReplyReceiver.class);
            replyIntent.putExtra("conversationId", conversationId);
            replyIntent.putExtra("senderId", senderId);
            replyIntent.putExtra("messageId", messageId);
            replyIntent.putExtra("notificationId", String.valueOf(Math.abs(conversationId.hashCode())));
            PendingIntent replyPendingIntent = PendingIntent.getBroadcast(
                    this,
                    0,
                    replyIntent,
                    PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
            );

            // Seen PendingIntent
            Intent seenIntent = new Intent(this, SeenReceiver.class);
            seenIntent.putExtra("conversationId", conversationId);
            seenIntent.putExtra("messageId", messageId);
            seenIntent.putExtra("notificationId", String.valueOf(Math.abs(conversationId.hashCode())));
            PendingIntent seenPendingIntent = PendingIntent.getBroadcast(
                    this,
                    0,
                    seenIntent,
                    PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
            );

            // Build notification
            NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle(senderName)
                    .setContentText(messagePreview)
                    .setStyle(new NotificationCompat.BigTextStyle()
                            .bigText(messagePreview))
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                    .setAutoCancel(true)
                    .setGroup(CHANNEL_ID)
                    .setDefaults(NotificationCompat.DEFAULT_ALL)
                    .setTag(conversationId)
                    .addAction(new NotificationCompat.Action.Builder(
                            android.R.drawable.ic_menu_send,
                            "Reply",
                            replyPendingIntent)
                            .setRemoteInput(remoteInput)
                            .build())
                    .addAction(new NotificationCompat.Action.Builder(
                            android.R.drawable.checkbox_on_background,
                            "Mark as Seen",
                            seenPendingIntent)
                            .build());

            // Set content intent
            builder.setContentIntent(contentPendingIntent);

            // Get or create notification channel
            NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(
                        CHANNEL_ID,
                        CHANNEL_NAME,
                        NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("SilenX message notifications");
                channel.enableLights(true);
                channel.setLightColor(0xFFFF0000);
                channel.enableVibration(true);
                notificationManager.createNotificationChannel(channel);
            }

            // Post notification
            int notificationId = Math.abs(conversationId.hashCode());
            NotificationManagerCompat.from(this).notify(notificationId, builder.build());

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    /**
     * Register the FCM token with the backend.
     */
    private void registerTokenWithBackend(String token, String jwt) {
        try {
            String url = "https://silenx.onrender.com/api/notifications/register-token";
            java.net.URL obj = new java.net.URL(url);
            java.net.HttpURLConnection conn = (java.net.HttpURLConnection) obj.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Authorization", "Bearer " + jwt);
            conn.setDoOutput(true);

            JSONObject json = new JSONObject();
            json.put("token", token);

            try (java.io.OutputStream os = conn.getOutputStream()) {
                os.write(json.toString().getBytes("UTF-8"));
            }

            int responseCode = conn.getResponseCode();
            // Log but don't crash on non-2xx
            if (responseCode != 200 && responseCode != 201) {
                // Connection failed gracefully
            }
        } catch (Exception e) {
            // Never crash - log only
            e.printStackTrace();
        }
    }
}
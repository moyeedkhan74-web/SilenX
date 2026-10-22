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

public class SilenXFirebaseMessagingService extends FirebaseMessagingService {

    static final String CHANNEL_ID   = "silenx_messages";
    static final String CHANNEL_NAME = "Messages";
    private static final String PREFS_NAME    = "silenx_prefs";
    private static final String KEY_AUTH_JWT  = "auth_jwt";
    private static final String KEY_FCM_TOKEN = "fcm_token";

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        Context ctx = getApplicationContext();
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY_FCM_TOKEN, token).apply();

        new Thread(() -> {
            try {
                String jwt = prefs.getString(KEY_AUTH_JWT, null);
                registerTokenWithBackend(token, jwt);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }).start();
    }

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        try {
            Map<String, String> data = remoteMessage.getData();
            if (data == null || data.isEmpty()) return;

            String conversationId = data.get("conversationId");
            String senderId       = data.get("senderId");
            String senderName     = data.get("senderName");
            String messagePreview = data.get("messagePreview");
            String messageId      = data.get("messageId");

            if (conversationId == null || senderName == null || messagePreview == null) return;

            Context ctx = getApplicationContext();
            int notificationId = Math.abs(conversationId.hashCode());

            // ── Content intent: tap notification body → open chat ──────────
            Intent chatIntent = new Intent(ctx, MainActivity.class);
            chatIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            chatIntent.putExtra("conversationId", conversationId);
            chatIntent.putExtra("action", "open_chat");
            PendingIntent contentPi = PendingIntent.getActivity(
                ctx, notificationId, chatIntent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

            // ── RemoteInput (inline reply) ──────────────────────────────────
            RemoteInput remoteInput = new RemoteInput.Builder("reply_text")
                    .setLabel("Reply to " + senderName + "…")
                    .build();

            // ── Reply PendingIntent ─────────────────────────────────────────
            Intent replyIntent = new Intent(ctx, ReplyReceiver.class);
            replyIntent.putExtra("conversationId", conversationId);
            replyIntent.putExtra("senderId", senderId);
            replyIntent.putExtra("messageId", messageId);
            replyIntent.putExtra("notificationId", String.valueOf(notificationId));
            PendingIntent replyPi = PendingIntent.getBroadcast(
                ctx, notificationId, replyIntent,
                PendingIntent.FLAG_MUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

            // ── Seen PendingIntent ──────────────────────────────────────────
            Intent seenIntent = new Intent(ctx, SeenReceiver.class);
            seenIntent.putExtra("conversationId", conversationId);
            seenIntent.putExtra("messageId", messageId);
            seenIntent.putExtra("notificationId", String.valueOf(notificationId));
            PendingIntent seenPi = PendingIntent.getBroadcast(
                ctx, notificationId + 1, seenIntent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

            // ── Create notification channel (API 26+) ──────────────────────
            NotificationManager nm =
                (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm != null) {
                NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH);
                ch.enableLights(true);
                ch.enableVibration(true);
                nm.createNotificationChannel(ch);
            }

            // ── Build & post notification ───────────────────────────────────
            NotificationCompat.Builder builder =
                new NotificationCompat.Builder(ctx, CHANNEL_ID)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle(senderName)
                    .setContentText(messagePreview)
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(messagePreview))
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                    .setAutoCancel(true)
                    .setGroup(CHANNEL_ID)
                    .setDefaults(NotificationCompat.DEFAULT_ALL)
                    .setContentIntent(contentPi)
                    .addAction(new NotificationCompat.Action.Builder(
                        android.R.drawable.ic_menu_send, "Reply", replyPi)
                        .addRemoteInput(remoteInput).build())
                    .addAction(new NotificationCompat.Action.Builder(
                        android.R.drawable.checkbox_on_background, "Mark as Seen", seenPi)
                        .build());

            NotificationManagerCompat.from(ctx).notify(notificationId, builder.build());

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void registerTokenWithBackend(String token, String jwt) {
        try {
            java.net.URL url = new java.net.URL(
                "https://silenx.onrender.com/api/notifications/register-token");
            java.net.HttpURLConnection conn =
                (java.net.HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            if (jwt != null) conn.setRequestProperty("Authorization", "Bearer " + jwt);
            conn.setDoOutput(true);
            JSONObject json = new JSONObject();
            json.put("token", token);
            try (java.io.OutputStream os = conn.getOutputStream()) {
                os.write(json.toString().getBytes("UTF-8"));
            }
            conn.getResponseCode();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}

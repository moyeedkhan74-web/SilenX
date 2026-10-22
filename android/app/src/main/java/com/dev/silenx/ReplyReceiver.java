package com.dev.silenx;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.RemoteInput;
import org.json.JSONObject;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.UUID;

public class ReplyReceiver extends BroadcastReceiver {

    private static final String CHANNEL_ID = "silenx_messages"; // same as SilenXFirebaseMessagingService
    private static final String KEY_CONVERSATION_ID = "conversationId";
    private static final String KEY_SENDER_ID = "senderId";
    private static final String KEY_MESSAGE_ID = "messageId";
    private static final String KEY_NOTIFICATION_ID = "notificationId";

    @Override
    public void onReceive(Context context, Intent intent) {
        try {
            // Extract reply text from RemoteInput
 CharSequence replyText = RemoteInput.getResultsFromIntent(intent).getCharSequence(KEY_REPLY_TEXT);
            if (replyText == null || replyText.toString().trim().isEmpty()) {
                // Silent return if no text
                return;
            }

            String text = replyText.toString();

            // Get extras
            String conversationId = intent.getStringExtra(KEY_CONVERSATION_ID);
            String senderId = intent.getStringExtra(KEY_SENDER_ID);
            String messageId = intent.getStringExtra(KEY_MESSAGE_ID);
            String notificationId = intent.getStringExtra(KEY_NOTIFICATION_ID);

            if (conversationId == null || conversationId.trim().isEmpty()) {
                return;
            }

            // Retrieve JWT from SharedPreferences
            SharedPreferences prefs = context.getSharedPreferences("silenx_prefs", Context.MODE_PRIVATE);
            String jwt = prefs.getString("auth_jwt", null);

            if (jwt == null || jwt.trim().isEmpty()) {
                // Cannot send without auth - silently return
                return;
            }

            // Post message to backend in background thread
            new Thread(() -> {
                try {
                    String url = "https://silenx.onrender.com/api/conversations/" + conversationId + "/messages";
                    java.net.URL obj = new java.net.URL(url);
                    HttpURLConnection conn = (HttpURLConnection) obj.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/json");
                    conn.setRequestProperty("Authorization", "Bearer " + jwt);
                    conn.setDoOutput(true);

                    JSONObject json = new JSONObject();
                    json.put("encryptedContent", text);
                    json.put("contentType", "text");
                    json.put("tempId", UUID.randomUUID().toString());

                    try (OutputStream os = conn.getOutputStream()) {
                        os.write(json.toString().getBytes("UTF-8"));
                    }

                    int responseCode = conn.getResponseCode();

                    if (responseCode == 200 || responseCode == 201) {
                        // Update notification to show "✓ Sent"
                        updateNotificationSent(context, Integer.parseInt(notificationId));
                        // Dismiss after 2 seconds
                        dismissNotificationAfterDelay(context, Integer.parseInt(notificationId));
                    } else {
                        // Update notification to show failure
                        updateNotificationFailed(context, Integer.parseInt(notificationId));
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                    // Update notification to show failure
                    try {
                        updateNotificationFailed(context, Integer.parseInt(notificationId));
                    } catch (NumberFormatException ne) {
                        // Ignore if notificationId is not a number
                    }
                }
            }).start();
        } catch (Exception e) {
            // Never crash
            e.printStackTrace();
        }
    }

    /**
     * Update notification to show sent status.
     */
    private void updateNotificationSent(Context context, int notificationId) {
        try {
            NotificationManagerCompat notificationManager = NotificationManagerCompat.from(context);
            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle("SilenX")
                    .setContentText("✓ Sent")
                    .setAutoCancel(true);
            notificationManager.notify(notificationId, builder.build());
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    /**
     * Dismiss notification after a delay.
     */
    private void dismissNotificationAfterDelay(Context context, int notificationId) {
        try {
            new Handler(Looper.getMainLooper()).postDelayed(
                    () -> NotificationManagerCompat.from(context).cancel(notificationId),
                    2000
            );
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    /**
     * Update notification to show failed status.
     */
    private void updateNotificationFailed(Context context, int notificationId) {
        try {
            NotificationManagerCompat notificationManager = NotificationManagerCompat.from(context);
            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle("SilenX")
                    .setContentText("⚠ Failed to send. Tap to retry.")
                    .setAutoCancel(true);
            notificationManager.notify(notificationId, builder.build());
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
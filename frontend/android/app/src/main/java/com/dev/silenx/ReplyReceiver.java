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

    private static final String CHANNEL_ID        = "silenx_messages";
    private static final String KEY_REPLY_TEXT     = "reply_text";
    private static final String KEY_CONVERSATION_ID = "conversationId";
    private static final String KEY_SENDER_ID      = "senderId";
    private static final String KEY_MESSAGE_ID     = "messageId";
    private static final String KEY_NOTIFICATION_ID = "notificationId";

    @Override
    public void onReceive(Context context, Intent intent) {
        try {
            // Extract inline reply text from notification RemoteInput
            android.os.Bundle results = RemoteInput.getResultsFromIntent(intent);
            if (results == null) return;
            CharSequence replyText = results.getCharSequence(KEY_REPLY_TEXT);
            if (replyText == null || replyText.toString().trim().isEmpty()) return;

            String text           = replyText.toString().trim();
            String conversationId = intent.getStringExtra(KEY_CONVERSATION_ID);
            String notificationId = intent.getStringExtra(KEY_NOTIFICATION_ID);

            if (conversationId == null || conversationId.isEmpty()) return;

            // Retrieve JWT from SharedPreferences
            SharedPreferences prefs = context.getSharedPreferences("silenx_prefs", Context.MODE_PRIVATE);
            String jwt = prefs.getString("auth_jwt", null);
            if (jwt == null || jwt.trim().isEmpty()) return;

            final int nId = parseNotificationId(notificationId);

            // Send reply to backend on a background thread
            new Thread(() -> {
                try {
                    URL url = new URL("https://silenx.onrender.com/api/conversations/" + conversationId + "/messages");
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
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

                    int code = conn.getResponseCode();
                    if (code == 200 || code == 201) {
                        showStatusNotification(context, nId, "✓ Sent");
                        dismissAfterDelay(context, nId, 2000);
                    } else {
                        showStatusNotification(context, nId, "⚠ Failed to send. Tap to retry.");
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                    showStatusNotification(context, nId, "⚠ Failed to send. Tap to retry.");
                }
            }).start();

        } catch (Exception e) {
            e.printStackTrace(); // never crash
        }
    }

    private void showStatusNotification(Context context, int notificationId, String text) {
        try {
            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle("SilenX")
                    .setContentText(text)
                    .setAutoCancel(true);
            NotificationManagerCompat.from(context).notify(notificationId, builder.build());
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void dismissAfterDelay(Context context, int notificationId, long delayMs) {
        try {
            new Handler(Looper.getMainLooper()).postDelayed(
                    () -> NotificationManagerCompat.from(context).cancel(notificationId),
                    delayMs
            );
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private int parseNotificationId(String raw) {
        try { return Integer.parseInt(raw); } catch (Exception e) { return 0; }
    }
}

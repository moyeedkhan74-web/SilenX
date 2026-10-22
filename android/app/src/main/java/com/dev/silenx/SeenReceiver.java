package com.dev.silenx;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import androidx.core.app.NotificationManagerCompat;
import org.json.JSONObject;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class SeenReceiver extends BroadcastReceiver {

    private static final String KEY_CONVERSATION_ID = "conversationId";
    private static final String KEY_MESSAGE_ID = "messageId";
    private static final String KEY_NOTIFICATION_ID = "notificationId";

    @Override
    public void onReceive(Context context, Intent intent) {
        try {
            String conversationId = intent.getStringExtra(KEY_CONVERSATION_ID);
            String messageId = intent.getStringExtra(KEY_MESSAGE_ID);
            String notificationId = intent.getStringExtra(KEY_NOTIFICATION_ID);

            if (conversationId == null || conversationId.trim().isEmpty()) {
                return;
            }

            // Retrieve JWT from SharedPreferences
            SharedPreferences prefs = context.getSharedPreferences("silenx_prefs", Context.MODE_PRIVATE);
            String jwt = prefs.getString("auth_jwt", null);

            if (jwt == null || jwt.trim().isEmpty()) {
                return;
            }

            // Post mark-read request to backend in background thread
            new Thread(() -> {
                try {
                    String url = "https://silenx.onrender.com/api/notifications/mark-read";
                    java.net.URL obj = new java.net.URL(url);
                    HttpURLConnection conn = (HttpURLConnection) obj.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/json");
                    conn.setRequestProperty("Authorization", "Bearer " + jwt);
                    conn.setDoOutput(true);

                    JSONObject json = new JSONObject();
                    json.put("conversationId", conversationId);
                    json.put("messageId", messageId);

                    try (OutputStream os = conn.getOutputStream()) {
                        os.write(json.toString().getBytes("UTF-8"));
                    }

                    int responseCode = conn.getResponseCode();
                    // Dismiss notification regardless of success/failure
                    dismissNotification(context, Integer.parseInt(notificationId));
                } catch (Exception e) {
                    e.printStackTrace();
                    try {
                        dismissNotification(context, Integer.parseInt(notificationId));
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
     * Dismiss the notification immediately.
     */
    private void dismissNotification(Context context, int notificationId) {
        try {
            NotificationManagerCompat.from(context).cancel(notificationId);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
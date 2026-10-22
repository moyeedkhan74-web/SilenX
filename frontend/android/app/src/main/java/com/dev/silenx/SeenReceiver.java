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

    private static final String KEY_CONVERSATION_ID  = "conversationId";
    private static final String KEY_MESSAGE_ID       = "messageId";
    private static final String KEY_NOTIFICATION_ID  = "notificationId";

    @Override
    public void onReceive(Context context, Intent intent) {
        try {
            String conversationId = intent.getStringExtra(KEY_CONVERSATION_ID);
            String messageId      = intent.getStringExtra(KEY_MESSAGE_ID);
            String notificationId = intent.getStringExtra(KEY_NOTIFICATION_ID);

            if (conversationId == null || conversationId.isEmpty()) return;

            // Retrieve JWT from SharedPreferences
            SharedPreferences prefs = context.getSharedPreferences("silenx_prefs", Context.MODE_PRIVATE);
            String jwt = prefs.getString("auth_jwt", null);
            if (jwt == null || jwt.trim().isEmpty()) return;

            final int nId = parseNotificationId(notificationId);

            // Dismiss notification immediately — don't wait for the network call
            NotificationManagerCompat.from(context).cancel(nId);

            // Fire mark-read request in background
            new Thread(() -> {
                try {
                    URL url = new URL("https://silenx.onrender.com/api/notifications/mark-read");
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
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
                    conn.getResponseCode(); // consume response
                } catch (Exception e) {
                    e.printStackTrace(); // never crash
                }
            }).start();

        } catch (Exception e) {
            e.printStackTrace(); // never crash
        }
    }

    private int parseNotificationId(String raw) {
        try { return Integer.parseInt(raw); } catch (Exception e) { return 0; }
    }
}

package com.dev.silenx;

import android.Manifest;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;
import java.util.List;

/**
 * Runtime permissions bridge for WebRTC/LiveKit calls.
 *
 * Capacitor's WebView silently denies getUserMedia unless the matching Android
 * runtime permissions have already been granted. This plugin prompts for them
 * BEFORE the WebView asks, so call accept works on the first try.
 */
@CapacitorPlugin(name = "MediaPermissions")
public class MediaPermissionsPlugin extends Plugin {

    private static final String AUDIO_ALIAS = "callAudio";
    private static final String CAMERA_ALIAS = "callCamera";

    @Permission(strings = { Manifest.permission.RECORD_AUDIO, Manifest.permission.MODIFY_AUDIO_SETTINGS }, alias = AUDIO_ALIAS)
    private final String audioAlias = "";

    @Permission(strings = { Manifest.permission.CAMERA }, alias = CAMERA_ALIAS)
    private final String cameraAlias = "";

    /** Current grant status without prompting. */
    @PluginMethod
    public void check(PluginCall call) {
        JSObject result = new JSObject();
        result.put("microphone", hasPermission(Manifest.permission.RECORD_AUDIO));
        result.put("camera", hasPermission(Manifest.permission.CAMERA));
        call.resolve(result);
    }

    /**
     * Prompts for the permissions needed for the requested call type.
     * body: { media: 'audio' | 'video' }
     * resolves: { granted, microphone, camera } — granted means microphone OK,
     * which is the minimum required for ANY call.
     */
    @PluginMethod
    public void request(PluginCall call) {
        String media = call.getString("media", "audio");

        List<String> aliases = new ArrayList<>();
        if (!hasPermission(Manifest.permission.RECORD_AUDIO)) {
            aliases.add(AUDIO_ALIAS);
        }
        if (("video".equals(media) || "both".equals(media)) && !hasPermission(Manifest.permission.CAMERA)) {
            aliases.add(CAMERA_ALIAS);
        }

        if (aliases.isEmpty()) {
            resolveResult(call);
            return;
        }

        requestPermissionForAliases(aliases.toArray(new String[0]), call, "onMediaPermissionsResult");
    }

    @PermissionCallback
    private void onMediaPermissionsResult(PluginCall call) {
        resolveResult(call);
    }

    private void resolveResult(PluginCall call) {
        boolean mic = hasPermission(Manifest.permission.RECORD_AUDIO);
        JSObject result = new JSObject();
        result.put("microphone", mic);
        result.put("camera", hasPermission(Manifest.permission.CAMERA));
        result.put("granted", mic);
        call.resolve(result);
    }
}

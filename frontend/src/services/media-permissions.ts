import { Capacitor, registerPlugin } from '@capacitor/core';

export interface MediaPermissionState {
  microphone: boolean;
  camera: boolean;
}

export interface MediaPermissionResult extends MediaPermissionState {
  granted: boolean;
}

interface MediaPermissionsPluginInterface {
  check(): Promise<MediaPermissionState>;
  request(options: { media: 'audio' | 'video' }): Promise<MediaPermissionResult>;
}

const MediaPermissions = registerPlugin<MediaPermissionsPluginInterface>('MediaPermissions', {
  web: {
    check: async () => ({ microphone: true, camera: true }),
    request: async () => ({ granted: true, microphone: true, camera: true }),
  },
});

/**
 * Check (without prompting) whether mic/camera runtime permissions are granted.
 * Always returns granted=true on web — browser permissions are requested by
 * getUserMedia itself.
 */
export async function checkMediaPermissions(): Promise<MediaPermissionResult> {
  if (!Capacitor.isNativePlatform()) {
    return { granted: true, microphone: true, camera: true };
  }
  try {
    const state = await MediaPermissions.check();
    return { ...state, granted: state.microphone };
  } catch (error) {
    console.warn('[MediaPermissions] check failed:', error);
    // Optimistic default — getUserMedia will surface the real denial if any.
    return { granted: true, microphone: true, camera: true };
  }
}

/**
 * Request Android runtime permissions BEFORE calling getUserMedia.
 * Returns granted=true when at least the microphone is allowed (the minimum
 * for any call); `camera` tells the caller whether a video attempt is viable.
 */
export async function ensureMediaPermissions(media: 'audio' | 'video'): Promise<MediaPermissionResult> {
  if (!Capacitor.isNativePlatform()) {
    return { granted: true, microphone: true, camera: true };
  }
  try {
    const result = await MediaPermissions.request({ media });
    console.log('[MediaPermissions] request result:', result);
    return result;
  } catch (error) {
    console.warn('[MediaPermissions] request failed:', error);
    return { granted: true, microphone: true, camera: true };
  }
}

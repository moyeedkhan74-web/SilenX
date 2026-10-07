// src/services/pickerService.ts
// Media picker service using Capacitor Camera plugin
// Handles photo picking from gallery (Android Photo Picker) and taking photos

import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { validateFile } from '../utils/validateFile';

// Error types for handling user cancellation and permission denial
export type PickerError =
  | { type: 'cancelled'; message: 'User cancelled selection' }
  | { type: 'permission'; message: 'Permission denied' }
  | { type: 'validation'; message: string }
  | { type: 'system'; message: string };

export type PickerResult = File | PickerError;

/**
 * Take a photo using the device's camera.
 * Saves to a temporary file and returns a File object.
 */
export async function takePhoto(): Promise<PickerResult> {
  try {
    const photo: Photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      correctOrientation: true, // Fix EXIF rotation
    });

    return await convertPhotoToFile(photo);
  } catch (error) {
    return handleCameraError(error);
  }
}

/**
 * Pick images from gallery using the Android Photo Picker or iOS Photo Library.
 * Supports multi-select (max 10).
 */
export async function pickFromGallery(): Promise<PickerResult[]> {
  const results: PickerResult[] = [];

  try {
    const photos: Photo[] = await Camera.pickImages({
      quality: 80,
      resultType: CameraResultType.Uri,
      source: CameraSource.Photos,
      correctOrientation: true,
      // On iOS, allows selecting multiple images
      // On Android, this uses the Photo Picker (no SCOPED_STORAGE permission)
      presentationButtonStyle: 'plain',
    });

    // Map each photo to a File, with a max of 10
    const limitedPhotos = photos.slice(0, 10);
    for (const photo of limitedPhotos) {
      results.push(await convertPhotoToFile(photo));
    }

    // Fill the rest up to maxFilesPerPick with placeholder? No, just return.
    return results;
  } catch (error) {
    return [handleCameraError(error)];
  }
}

/**
 * Convert a Capacitor Photo object to a File object.
 * Uses fetch to retrieve the blob from the webPath.
 */
async function convertPhotoToFile(photo: Photo): Promise<PickerResult> {
  if (!photo.webPath) {
    return { type: 'system', message: 'No image path returned from camera' };
  }

  try {
    // Fetch the image blob using the web path
    const response = await fetch(photo.webPath);
    if (!response.ok) {
      return { type: 'system', message: `Failed to read image: HTTP ${response.status}` };
    }

    const blob = await response.blob();
    const fileName = `photo_${Date.now()}.${photo.format || 'jpg'}`;
    const mimeType = `image/${photo.format || 'jpeg'}`;

    // Create File object
    const file = new File([blob], fileName, { type: mimeType });

    // Validate file before returning
    const validation = validateFile(file);
    if (!validation.ok && validation.reason) {
      return { type: 'validation', message: validation.reason };
    }

    return file;
  } catch (err) {
    return { type: 'system', message: (err as Error).message };
  }
}

/**
 * Handle errors from Capacitor Camera plugin.
 * Maps to specific error types for clean UI handling.
 */
function handleCameraError(error: unknown): PickerError {
  // Check for known Capacitor error codes/messages
  const errorMessage = (error as Error)?.message ?? 'Unknown error';

  // Permission denied
  if (
    errorMessage.includes('Permission') ||
    errorMessage.includes('permission') ||
    errorMessage.includes('denied')
  ) {
    return {
      type: 'permission',
      message: 'Please grant camera/gallery permission in your device settings to continue.',
    };
  }

  // User cancelled
  if (
    errorMessage.includes('cancelled') ||
    errorMessage.includes('CANCELLED') ||
    errorMessage === 'null' ||
    errorMessage === ''
  ) {
    return {
      type: 'cancelled',
      message: 'Selection cancelled',
    };
  }

  // Generic system error
  return {
    type: 'system',
    message: errorMessage || 'An unexpected error occurred',
  };
}

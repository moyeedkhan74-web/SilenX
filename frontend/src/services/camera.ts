import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

export interface CameraPhotoResult {
  dataUrl?: string;
  format: string;
  webPath?: string;
}

export async function capturePhoto(): Promise<CameraPhotoResult | null> {
  try {
    if (Capacitor.isNativePlatform()) {
      const image = await Camera.getPhoto({
        quality: 85,
        allowEditing: true,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        correctOrientation: true,
      });

      return {
        dataUrl: image.dataUrl,
        format: image.format,
        webPath: image.webPath,
      };
    } else {
      // Fallback for Web/Browser
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        input.onchange = (e: any) => {
          const file = e.target?.files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = () => {
              resolve({
                dataUrl: reader.result as string,
                format: file.type.split('/')[1] || 'jpeg',
              });
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
          } else {
            resolve(null);
          }
        };
        input.click();
      });
    }
  } catch (error) {
    console.warn('[CameraService] Camera capture cancelled or error:', error);
    return null;
  }
}

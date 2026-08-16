import imageCompression from 'browser-image-compression';

export interface CompressedImageResult {
  file: File;
  dataUrl: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

export async function compressImage(file: File, options?: { maxWidthOrHeight?: number; maxSizeMB?: number; quality?: number }): Promise<CompressedImageResult> {
  const defaultOptions = {
    maxSizeMB: 0.5, // 500KB target
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    initialQuality: options?.quality || 0.82,
    ...options,
  };

  try {
    const compressedFile = await imageCompression(file, defaultOptions);
    const dataUrl = await imageCompression.getDataUrlFromFile(compressedFile);

    const originalSize = file.size;
    const compressedSize = compressedFile.size;
    const compressionRatio = Math.round((1 - compressedSize / originalSize) * 100);

    return {
      file: compressedFile,
      dataUrl,
      originalSize,
      compressedSize,
      compressionRatio: Math.max(0, compressionRatio),
    };
  } catch (error) {
    console.warn('[ImageCompressor] Fallback to raw file due to error:', error);
    const dataUrl = await imageCompression.getDataUrlFromFile(file);
    return {
      file,
      dataUrl,
      originalSize: file.size,
      compressedSize: file.size,
      compressionRatio: 0,
    };
  }
}

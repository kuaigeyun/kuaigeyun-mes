/**
 * 上传前图片压缩（browser-image-compression）。
 * 与后端 image_compress、移动端 compressImageForUpload 参数对齐。
 */

import imageCompression from 'browser-image-compression';

export const UPLOAD_IMAGE_MAX_DIMENSION = 1920;
export const UPLOAD_IMAGE_INITIAL_QUALITY = 0.85;
export const UPLOAD_IMAGE_MAX_SIZE_MB = 2;
export const UPLOAD_IMAGE_MIN_COMPRESS_BYTES = 80 * 1024;

function isCompressibleImageType(mimeType: string): boolean {
  const type = mimeType.toLowerCase();
  if (!type.startsWith('image/')) return false;
  if (type === 'image/svg+xml' || type === 'image/gif') return false;
  return true;
}

function toFile(blob: File | Blob, fallbackName: string): File {
  if (blob instanceof File) return blob;
  const type = blob.type || 'image/jpeg';
  return new File([blob], fallbackName, { type });
}

/** 上传前压缩图片；非图片或压缩失败时返回原文件 */
export async function compressImageForUpload(file: File | Blob): Promise<File | Blob> {
  const candidate = toFile(file, `upload-${Date.now()}.jpg`);
  if (!isCompressibleImageType(candidate.type)) return file;
  if (candidate.size < UPLOAD_IMAGE_MIN_COMPRESS_BYTES) return file;

  try {
    const preferPng = candidate.type === 'image/png';
    const compressed = await imageCompression(candidate, {
      maxSizeMB: UPLOAD_IMAGE_MAX_SIZE_MB,
      maxWidthOrHeight: UPLOAD_IMAGE_MAX_DIMENSION,
      useWebWorker: true,
      initialQuality: UPLOAD_IMAGE_INITIAL_QUALITY,
      preserveExif: false,
      fileType: preferPng ? 'image/png' : 'image/jpeg',
    });
    return compressed;
  } catch {
    return file;
  }
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico']);
const STEP_EXTENSIONS = new Set(['stp', 'step']);

export type FilePreviewSource = {
  fileName?: string;
  fileType?: string;
  fileExtension?: string;
};

export function getFileExt(source: FilePreviewSource): string {
  const extRaw = source.fileExtension ?? (source as { file_extension?: string }).file_extension;
  if (extRaw) return String(extRaw).replace(/^\./, '').toLowerCase();
  const name = source.fileName ?? (source as { original_name?: string }).original_name;
  if (name?.includes('.')) return name.split('.').pop()!.toLowerCase();
  const mime = source.fileType ?? (source as { file_type?: string }).file_type;
  if (mime?.includes('/')) return mime.split('/').pop()!.toLowerCase();
  return '';
}

export function isImageFile(source: FilePreviewSource): boolean {
  const ext = getFileExt(source);
  const mime = (source.fileType ?? (source as { file_type?: string }).file_type ?? '').toLowerCase();
  return IMAGE_EXTENSIONS.has(ext) || mime.startsWith('image/');
}

export function isPdfFile(source: FilePreviewSource): boolean {
  const ext = getFileExt(source);
  const mime = (source.fileType ?? (source as { file_type?: string }).file_type ?? '').toLowerCase();
  return ext === 'pdf' || mime === 'application/pdf';
}

export function isStepFile(source: FilePreviewSource): boolean {
  const ext = getFileExt(source);
  const mime = (source.fileType ?? (source as { file_type?: string }).file_type ?? '').toLowerCase();
  const name = (source.fileName ?? (source as { original_name?: string }).original_name ?? '').toLowerCase();
  return (
    STEP_EXTENSIONS.has(ext) ||
    /\.(stp|step)$/i.test(name) ||
    mime.includes('step') ||
    mime.includes('model/step')
  );
}

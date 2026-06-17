const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico']);
const STEP_EXTENSIONS = new Set(['stp', 'step']);
const CAD2D_EXTENSIONS = new Set(['dwg', 'dxf']);
const TEXT_EXTENSIONS = new Set([
  'txt', 'log', 'md', 'markdown', 'xml', 'yaml', 'yml', 'ini', 'cfg', 'conf',
  'sql', 'json', 'properties', 'bat', 'sh', 'py', 'js', 'ts', 'jsx', 'tsx',
  'css', 'scss', 'less', 'html', 'htm',
]);
const SPREADSHEET_EXTENSIONS = new Set(['xls', 'xlsx', 'csv', 'ods']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'ogg', 'mov', 'm4v', 'avi', 'mkv']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'webm']);

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

export function isDwgFile(source: FilePreviewSource): boolean {
  const ext = getFileExt(source);
  const mime = (source.fileType ?? (source as { file_type?: string }).file_type ?? '').toLowerCase();
  const name = (source.fileName ?? (source as { original_name?: string }).original_name ?? '').toLowerCase();
  return ext === 'dwg' || /\.dwg$/i.test(name) || mime.includes('acad') || mime === 'application/dwg';
}

export function isDxfFile(source: FilePreviewSource): boolean {
  const ext = getFileExt(source);
  const mime = (source.fileType ?? (source as { file_type?: string }).file_type ?? '').toLowerCase();
  const name = (source.fileName ?? (source as { original_name?: string }).original_name ?? '').toLowerCase();
  return ext === 'dxf' || /\.dxf$/i.test(name) || mime.includes('dxf') || mime === 'image/vnd.dxf';
}

export function isCad2dFile(source: FilePreviewSource): boolean {
  const ext = getFileExt(source);
  const name = (source.fileName ?? (source as { original_name?: string }).original_name ?? '').toLowerCase();
  return (
    CAD2D_EXTENSIONS.has(ext) ||
    /\.(dwg|dxf)$/i.test(name) ||
    isDwgFile(source) ||
    isDxfFile(source)
  );
}

function getMime(source: FilePreviewSource): string {
  return (source.fileType ?? (source as { file_type?: string }).file_type ?? '').toLowerCase();
}

export function isTextFile(source: FilePreviewSource): boolean {
  const ext = getFileExt(source);
  const mime = getMime(source);
  return TEXT_EXTENSIONS.has(ext) || mime.startsWith('text/') || mime === 'application/json';
}

export function isSpreadsheetFile(source: FilePreviewSource): boolean {
  const ext = getFileExt(source);
  const mime = getMime(source);
  return (
    SPREADSHEET_EXTENSIONS.has(ext)
    || mime.includes('spreadsheet')
    || mime.includes('ms-excel')
    || mime === 'text/csv'
    || mime === 'application/csv'
  );
}

export function isVideoFile(source: FilePreviewSource): boolean {
  const ext = getFileExt(source);
  const mime = getMime(source);
  return VIDEO_EXTENSIONS.has(ext) || mime.startsWith('video/');
}

export function isAudioFile(source: FilePreviewSource): boolean {
  const ext = getFileExt(source);
  const mime = getMime(source);
  return AUDIO_EXTENSIONS.has(ext) || mime.startsWith('audio/');
}

/** 由前端解析渲染的文档类预览（文本、表格、音视频），不走 iframe */
export function isInlineDocumentPreview(source: FilePreviewSource): boolean {
  return isTextFile(source) || isSpreadsheetFile(source) || isVideoFile(source) || isAudioFile(source);
}

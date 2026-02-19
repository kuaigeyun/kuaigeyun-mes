/**
 * 文件下载工具
 *
 * 支持 Blob 或字符串内容下载，供各 APP 共享使用。
 */

/**
 * 从 Blob 下载文件
 */
export function downloadFile(blob: Blob, filename: string): void;

/**
 * 从字符串内容下载文件（如 CSV）
 * @param content 文本内容
 * @param filename 文件名
 * @param mimeType 可选，MIME 类型，默认 text/plain
 */
export function downloadFile(
  content: string,
  filename: string,
  mimeType?: string
): void;

export function downloadFile(
  blobOrContent: Blob | string,
  filename: string,
  mimeType?: string
): void {
  const blob =
    typeof blobOrContent === 'string'
      ? new Blob([blobOrContent], { type: mimeType || 'text/plain' })
      : blobOrContent;

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * 单据打印 API（DocumentPrintService.print_document）JSON 响应辅助
 */

import { downloadFile } from './fileDownload';

export type DocumentPrintApiResult = {
  success?: boolean;
  content?: string;
  message?: string;
  template_uuid?: string | null;
  template_code?: string | null;
  output_format?: string;
  content_encoding?: string;
  mime_type?: string;
};

export function escapeHtml(s: string | number | undefined | null): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 预览 iframe 内留边距（仅 screen，不影响实际打印 HTML） */
export function withPrintPreviewScreenPadding(html: string): string {
  const style =
    '<style>@media screen{html,body{margin:0;padding:16px 20px;box-sizing:border-box;}}</style>';
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${style}</head>`);
  }
  return `${style}${html}`;
}

/** 将 HTML 写入新窗口并触发打印（模板未配置时的兜底；可传入整页 HTML 或仅 body 片段） */
export function openPrintHtmlWindow(html: string, title = '打印'): Window | null {
  const w = window.open('', '_blank');
  if (!w) return null;
  const trimmed = html.trimStart().toLowerCase();
  if (trimmed.startsWith('<!doctype') || trimmed.startsWith('<html')) {
    w.document.write(html);
  } else {
    w.document.write(
      `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title></head><body>${html}</body></html>`,
    );
  }
  w.document.close();
  w.onload = () => {
    try {
      w.focus();
      w.print();
    } catch {
      /* ignore */
    }
  };
  return w;
}

/** 将 print API 返回的 base64 PDF 解码为 Blob */
export function decodePrintPdfBlob(result: DocumentPrintApiResult): Blob | null {
  const content = result.content;
  if (!content) return null;
  if (result.content_encoding === 'base64') {
    const binary = atob(content);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: result.mime_type || 'application/pdf' });
  }
  return new Blob([content], { type: result.mime_type || 'application/pdf' });
}

/** 下载 print API 返回的 PDF（output_format=pdf, response_format=json） */
export function downloadPrintPdfFromApiResult(result: DocumentPrintApiResult, filename: string): void {
  const blob = decodePrintPdfBlob(result);
  if (!blob) {
    throw new Error('PDF content is empty');
  }
  downloadFile(blob, filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

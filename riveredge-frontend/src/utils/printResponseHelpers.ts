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

/** 从编译后 HTML 的 @page 规则解析页边距与纸张尺寸（与模板 designer_schema 一致） */
export function parsePrintPageLayout(html: string): {
  width: string;
  minHeight: string;
  margin: string;
} {
  const pageBlock = html.match(/@page\s*\{([^}]+)\}/i)?.[1] ?? '';
  const margin = pageBlock.match(/\bmargin\s*:\s*([^;]+)/i)?.[1]?.trim() || '10mm 10mm 10mm 10mm';
  const sizeRaw = pageBlock.match(/\bsize\s*:\s*([^;]+)/i)?.[1]?.trim() || '210mm 297mm';
  const dimParts = sizeRaw.split(/\s+/).filter((part) => /\d/.test(part));
  return {
    width: dimParts[0] || '210mm',
    minHeight: dimParts[1] || '297mm',
    margin,
  };
}

/** @deprecated 使用 parsePrintPageLayout */
export function parsePrintPageMarginCss(html: string): string {
  return parsePrintPageLayout(html).margin;
}

export type PrintPreviewScreenOptions = {
  /** 纸张圆角，与 token.borderRadiusLG 一致 */
  borderRadius?: number;
};

/**
 * 预览 iframe 内模拟「纸张 + 页边距」（仅 screen）。
 * 样式注入在文档末尾，覆盖模板 body{padding:0!important}，不影响实际打印/PDF 的 @page margin。
 */
export function withPrintPreviewScreenPadding(
  html: string,
  options?: PrintPreviewScreenOptions,
): string {
  const { width, minHeight, margin } = parsePrintPageLayout(html);
  const borderRadius = options?.borderRadius ?? 8;
  const style = `<style id="uni-print-preview-screen">
@media screen{
  html{margin:0;padding:16px;background:#e2e8f0;box-sizing:border-box;}
  body{
    width:${width}!important;
    min-height:${minHeight}!important;
    max-width:100%;
    margin:0 auto!important;
    padding:${margin}!important;
    box-sizing:border-box!important;
    background:#fff!important;
    border-radius:${borderRadius}px!important;
    box-shadow:0 1px 4px rgba(15,23,42,.08);
  }
}
@media print{
  html{padding:0!important;background:#fff!important;}
  body{
    width:auto!important;
    min-height:auto!important;
    max-width:none!important;
    margin:0!important;
    padding:0!important;
    border-radius:0!important;
    box-shadow:none!important;
    background:#fff!important;
  }
}
</style>`;
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${style}</body>`);
  }
  return `${html}${style}`;
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

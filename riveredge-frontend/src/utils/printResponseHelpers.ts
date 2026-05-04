/**
 * 单据打印 API（DocumentPrintService.print_document）JSON 响应辅助
 */

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

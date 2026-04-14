/**
 * 单据打印 API（DocumentPrintService.print_document）JSON 响应辅助
 */

export type DocumentPrintApiResult = {
  success?: boolean;
  content?: string;
  message?: string;
  render_mode?: string;
  requires_client_render?: boolean;
  template_uuid?: string | null;
  template_code?: string | null;
  output_format?: string;
  content_encoding?: string;
  mime_type?: string;
};

export function isClientPdfmePrint(result: DocumentPrintApiResult | null | undefined): boolean {
  return result?.render_mode === 'client_pdfme' || result?.requires_client_render === true;
}

/** 列表页等仅服务端 HTML 打印入口：提示用户改用业务页或 HTML 模板 */
export function clientPdfmeListPrintMessage(serverMessage?: string): string {
  return (
    serverMessage ||
    '当前默认打印模板为 pdfme 版式，服务端无法直接生成。请在业务详情使用打印功能，或在系统打印模板中将默认改为 HTML 模板。'
  );
}

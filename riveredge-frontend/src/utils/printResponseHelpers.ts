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

/**
 * 浏览器内 pdfme 成稿（与 @pdfme/generator、PDFME_PLUGINS、中文字体一致）
 */
import { generate } from '@pdfme/generator';
import type { Template } from '@pdfme/common';
import { PDFME_PLUGINS } from '../components/pdfme-doc/plugins';
import { getPdfmeChineseFont } from '../components/pdfme-doc/fonts';
import { isPdfmeTemplate, sanitizeTemplate, variablesToPdfmeInputs } from './pdfmeTemplateUtils';

export type PdfmeFont = Awaited<ReturnType<typeof getPdfmeChineseFont>>;

let fontSingleton: Promise<PdfmeFont> | null = null;

/** Modal 打开时调用可减少首次生成等待 */
export function preloadPdfmeChineseFont(): Promise<PdfmeFont> {
  fontSingleton = fontSingleton ?? getPdfmeChineseFont();
  return fontSingleton;
}

/**
 * 将模板 schema 中 foot/head 数组里的 {variable} 占位符替换为实际变量值。
 * pdfme generate() 不会自动处理 schema 内的占位符（只处理 inputs 中的值）。
 */
function substituteTemplateSchemaPlaceholders(
  template: Template,
  variables: Record<string, unknown>,
): void {
  const replace = (text: string): string =>
    text.replace(/\{(\w+)\}/g, (_, key) => {
      const val = variables[key];
      return val != null ? String(val) : '';
    });

  for (const page of template.schemas) {
    for (const schema of page) {
      const s = schema as Record<string, unknown>;
      if (Array.isArray(s.foot)) {
        s.foot = (s.foot as string[]).map((cell) =>
          typeof cell === 'string' ? replace(cell) : cell,
        );
      }
      if (Array.isArray(s.head)) {
        s.head = (s.head as string[]).map((cell) =>
          typeof cell === 'string' ? replace(cell) : cell,
        );
      }
    }
  }
}

export async function generatePdfmePdfBlob(args: {
  templateJson: string;
  variables: Record<string, unknown>;
  font?: PdfmeFont;
}): Promise<Blob> {
  if (!isPdfmeTemplate(args.templateJson)) {
    throw new Error('模板内容不是 pdfme JSON');
  }
  const raw = JSON.parse(args.templateJson) as Template;
  const template = sanitizeTemplate(raw);
  substituteTemplateSchemaPlaceholders(template, args.variables);
  const font = args.font ?? (await preloadPdfmeChineseFont());
  const inputs = variablesToPdfmeInputs(template, args.variables);
  const pdf = await generate({
    template,
    inputs,
    plugins: PDFME_PLUGINS as any,
    options: { font },
  });
  return new Blob([pdf.buffer], { type: 'application/pdf' });
}

/**
 * 打开 blob PDF 并触发打印；返回 revoke 清理函数（若未打开窗口会立即 revoke url）
 */
export function openPdfBlobInPrintWindow(blob: Blob): { revoked: boolean } {
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, '_blank');
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print();
      printWindow.onafterprint = () => {
        URL.revokeObjectURL(url);
        printWindow.close();
      };
    };
    return { revoked: false };
  }
  URL.revokeObjectURL(url);
  return { revoked: true };
}

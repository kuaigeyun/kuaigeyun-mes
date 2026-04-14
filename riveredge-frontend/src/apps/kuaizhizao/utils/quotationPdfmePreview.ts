/**
 * 报价单 pdfme 预览：模板选择与变量拉取与列表页「打印」一致
 */
import { getPrintTemplateList, getPrintTemplateByUuid } from '../../../services/printTemplate';
import { DOCUMENT_TYPE_TO_CODE } from '../../../config/printTemplateSchemas';
import { getQuotationPrintVariables } from '../services/quotation';
import { isPdfmeTemplate } from '../../../utils/pdfmeTemplateUtils';
import { generatePdfmePdfBlob } from '../../../utils/pdfmeClientPrint';

/** 若当前默认/首选模板为 pdfme，返回 PDF Blob；否则 null（走服务端 HTML/PDF） */
export async function tryQuotationPdfmePreviewBlob(quotationId: number): Promise<Blob | null> {
  const templates = await getPrintTemplateList({
    is_active: true,
    document_type: 'quotation',
  });
  const tplMeta =
    templates.find((t) => t.is_default) ??
    templates.find((t) => t.code === DOCUMENT_TYPE_TO_CODE.quotation) ??
    templates[0];
  if (!tplMeta?.uuid) return null;
  const templateDetail = await getPrintTemplateByUuid(tplMeta.uuid);
  const rawContent = templateDetail?.content ?? '';
  if (!rawContent || !isPdfmeTemplate(rawContent)) return null;
  const variables = await getQuotationPrintVariables(quotationId);
  return generatePdfmePdfBlob({ templateJson: rawContent, variables });
}

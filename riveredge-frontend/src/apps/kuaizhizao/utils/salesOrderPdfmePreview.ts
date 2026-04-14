import { getPrintTemplateList, getPrintTemplateByUuid } from '../../../services/printTemplate';
import { DOCUMENT_TYPE_TO_CODE } from '../../../config/printTemplateSchemas';
import { getSalesOrderPrintVariables } from '../services/sales-order';
import { isPdfmeTemplate } from '../../../utils/pdfmeTemplateUtils';
import { generatePdfmePdfBlob } from '../../../utils/pdfmeClientPrint';

/** 若默认销售订单模板为 pdfme，返回 PDF Blob */
export async function trySalesOrderPdfmePreviewBlob(salesOrderId: number): Promise<Blob | null> {
  const templates = await getPrintTemplateList({
    is_active: true,
    document_type: 'sales_order',
  });
  const tplMeta =
    templates.find((t) => t.is_default) ??
    templates.find((t) => t.code === DOCUMENT_TYPE_TO_CODE.sales_order) ??
    templates[0];
  if (!tplMeta?.uuid) return null;
  const templateDetail = await getPrintTemplateByUuid(tplMeta.uuid);
  const rawContent = templateDetail?.content ?? '';
  if (!rawContent || !isPdfmeTemplate(rawContent)) return null;
  const variables = await getSalesOrderPrintVariables(salesOrderId);
  console.debug('[salesOrder PDF] variables.items:', Array.isArray(variables.items) ? `array(${(variables.items as unknown[]).length})` : variables.items, variables.items);
  return generatePdfmePdfBlob({ templateJson: rawContent, variables });
}

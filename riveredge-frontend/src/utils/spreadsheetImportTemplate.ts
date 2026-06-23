import type { TFunction } from 'i18next';

/** @deprecated 使用 string 字段名；保留联合类型供工厂层级页引用 */
export type FactoryImportFieldKey =
  | 'code'
  | 'name'
  | 'address'
  | 'description'
  | 'plantCode'
  | 'workshopCode'
  | 'productionLineCode'
  | 'warehouseType'
  | 'workCenterCode'
  | 'storageAreaCode'
  | 'warehouseCode'
  | 'category'
  | 'version'
  | 'isActive'
  | 'defectTypes'
  | 'parentCode'
  | 'componentCode'
  | 'quantity'
  | 'unit'
  | 'wasteRate'
  | 'isRequired'
  | 'remark';

export interface FactoryImportFieldDef {
  field: string;
  required?: boolean;
  /** i18n key for column title (shown in spreadsheet header) */
  labelKey: string;
  /** 额外表头别名（兼容旧中文模板等） */
  aliases?: string[];
}

const LEGACY_ENGLISH_HEADERS: Record<string, string[]> = {
  code: ['code', '*code'],
  name: ['name', '*name'],
  address: ['address'],
  description: ['description'],
  plantCode: ['plantCode', '*plantCode'],
  workshopCode: ['workshopCode', '*workshopCode', 'workshop_code'],
  productionLineCode: ['productionLineCode', '*productionLineCode'],
  warehouseType: ['warehouseType'],
  workCenterCode: ['workCenterCode'],
  storageAreaCode: ['storageAreaCode', '*storageAreaCode'],
  warehouseCode: ['warehouseCode', '*warehouseCode'],
  category: ['category'],
  version: ['version'],
  isActive: ['isActive', 'is_active'],
  defectTypes: ['defectTypes'],
  parentCode: ['parentCode'],
  componentCode: ['componentCode'],
  quantity: ['quantity', 'qty', 'quote_quantity'],
  unit: ['unit'],
  unitPrice: ['unitPrice', 'unit_price'],
  wasteRate: ['wasteRate'],
  isRequired: ['isRequired'],
  remark: ['remark', 'notes'],
  customer: ['customer', 'customer_name', 'customerName'],
  supplier: ['supplier', 'supplier_name', 'supplierName'],
  material: ['material', 'material_code', 'materialCode'],
  date: ['date', 'quotation_date', 'order_date'],
  delivery: ['delivery_date', 'deliveryDate'],
  product: ['product_code', 'productCode'],
  amount: ['amount', 'total_amount', 'totalAmount'],
  dueDate: ['due_date', 'dueDate'],
  businessDate: ['business_date', 'businessDate'],
  workOrderCode: ['work_order_code', 'workOrderCode'],
  operationCode: ['operation_code', 'operationCode'],
  purchaseReceiptCode: ['purchase_receipt_code', 'purchaseReceiptCode'],
  inspectionQty: ['inspection_qty', 'inspectionQty'],
  qualifiedQty: ['qualified_qty', 'qualifiedQty'],
  unqualifiedQty: ['unqualified_qty', 'unqualifiedQty'],
  planCode: ['plan_code', 'planCode'],
  planName: ['plan_name', 'planName'],
  planType: ['plan_type', 'planType'],
  startDate: ['start_date', 'startDate'],
  endDate: ['end_date', 'endDate'],
  specification: ['specification', 'spec'],
  materialName: ['materialName', 'material_name', 'material name'],
  baseUnit: ['baseUnit', 'base_unit', 'base unit'],
  processRouteCode: ['processRouteCode', 'process_route_code', 'process route code'],
  processRouteName: ['processRouteName', 'process_route_name', 'process route name'],
  operationName: ['operationName', 'operation_name', 'operation name'],
  employeeId: ['employeeId', 'employee_id', 'employee id'],
  employeeName: ['employeeName', 'employee_name', 'employee name'],
  calcMode: ['calcMode', 'calc_mode', 'calc mode'],
  hourlyRate: ['hourlyRate', 'hourly_rate', 'hourly rate'],
  defaultPieceRate: ['defaultPieceRate', 'default_piece_rate', 'default piece rate'],
  baseSalary: ['baseSalary', 'base_salary', 'base salary'],
  type: ['type'],
  brand: ['brand'],
  model: ['model'],
  invoiceNo: ['invoice_no', 'invoiceNo'],
  partner: ['partner', 'partner_name'],
  taxRate: ['tax_rate', 'taxRate'],
  invoiceDate: ['invoice_date', 'invoiceDate'],
};

/**
 * 构建导入表头、示例行与表头→字段映射（含当前语言与英文/别名旧模板兼容）。
 */
export function buildFactoryImportTemplate(
  t: TFunction,
  fields: FactoryImportFieldDef[],
  exampleValues: string[],
): {
  importHeaders: string[];
  importExampleRow: string[];
  importHeaderMap: Record<string, string>;
} {
  const importHeaders: string[] = [];
  const importHeaderMap: Record<string, string> = {};

  const addMapping = (header: string, field: string) => {
    if (!header) return;
    importHeaderMap[header] = field;
    const withoutStar = header.replace(/^\*+/, '').trim();
    if (withoutStar && withoutStar !== header) {
      importHeaderMap[withoutStar] = field;
    }
  };

  fields.forEach((f) => {
    const label = t(f.labelKey);
    const header = f.required ? `*${label}` : label;
    importHeaders.push(header);
    addMapping(header, f.field);
    addMapping(label, f.field);
    for (const legacy of LEGACY_ENGLISH_HEADERS[f.field] ?? []) {
      addMapping(legacy, f.field);
    }
    for (const alias of f.aliases ?? []) {
      addMapping(alias, f.field);
    }
  });

  return {
    importHeaders,
    importExampleRow: exampleValues,
    importHeaderMap,
  };
}

/** 根据表头行解析列索引（支持中/英文表头及带 * 的必填列）。 */
export function resolveFactoryImportHeaderIndexMap(
  headers: string[],
  importHeaderMap: Record<string, string>,
): Record<string, number> {
  const headerIndexMap: Record<string, number> = {};
  headers.forEach((header, index) => {
    const normalizedHeader = String(header || '').trim();
    let field = importHeaderMap[normalizedHeader];
    if (!field) {
      const withoutStar = normalizedHeader.replace(/^\*+/, '').trim();
      field = importHeaderMap[withoutStar] ?? importHeaderMap[`*${withoutStar}`];
    }
    if (field) {
      headerIndexMap[field] = index;
    }
  });
  return headerIndexMap;
}

import dayjs from 'dayjs';
import { formatDateTime } from '../../../utils/format';
import type { Material } from '../types/material';
import { materialApi } from '../services/material';
import { customerPriceBookApi, supplierPriceBookApi } from '../services/partner-price-book';
import type { PartnerPriceResolveResult } from '../types/partner-price-book';
import { parseVariantAttributesValue } from '../components/VariantAttributeFields';
import { normalizeFormListItems } from '../../../utils/formListItems';

type FormWithLineItems = {
  getFieldValue: (name: string | string[]) => unknown;
  setFieldsValue: (values: Record<string, unknown>) => void;
};

function pickNumberField(
  obj: Record<string, unknown> | null | undefined,
  ...keys: string[]
): number | undefined {
  if (!obj) return undefined;
  for (const key of keys) {
    const val = obj[key];
    if (val != null && val !== '') {
      const n = Number(val);
      if (!Number.isNaN(n)) return n;
    }
  }
  return undefined;
}

export function getMaterialDefaultSalePrice(material: Material | Record<string, unknown>): number {
  const defaults = (material as any).defaults ?? {};
  const sales = defaults.sales ?? defaults.Sales;
  const fromSales =
    sales && typeof sales === 'object'
      ? Number(
          (sales as Record<string, unknown>).defaultSalePrice ??
            (sales as Record<string, unknown>).default_sale_price ??
            (sales as Record<string, unknown>).standard_price,
        ) || 0
      : 0;
  const raw =
    fromSales ||
    Number(
      defaults.defaultSalePrice ??
        defaults.default_sale_price ??
        (material as any).defaultSalePrice ??
        (material as any).default_sale_price,
    ) ||
    0;
  if (raw <= 0) return 0;

  const priceTypeRaw =
    (sales && typeof sales === 'object'
      ? (sales as Record<string, unknown>).defaultSalePriceType ??
        (sales as Record<string, unknown>).default_sale_price_type
      : undefined) ??
    defaults.defaultSalePriceType ??
    defaults.default_sale_price_type ??
    'tax_inclusive';
  const priceType = priceTypeRaw === 'tax_exclusive' ? 'tax_exclusive' : 'tax_inclusive';
  if (priceType === 'tax_inclusive') {
    const taxRate = getMaterialDefaultTaxRate(material);
    return convertUnitPriceByPriceType(raw, taxRate, 'tax_inclusive', 'tax_exclusive');
  }
  return raw;
}

export function getMaterialDefaultPurchasePrice(material: Material | Record<string, unknown>): number {
  const defaults = (material as any).defaults ?? {};
  const purchase = defaults.purchase ?? defaults.Purchase ?? {};
  const fromPurchase =
    purchase && typeof purchase === 'object'
      ? Number(
          (purchase as Record<string, unknown>).standard_price ??
            (purchase as Record<string, unknown>).purchase_price ??
            (purchase as Record<string, unknown>).defaultPurchasePrice ??
            (purchase as Record<string, unknown>).default_purchase_price,
        ) || 0
      : 0;
  const raw =
    fromPurchase ||
    Number(
      defaults.defaultPurchasePrice ??
        defaults.default_purchase_price ??
        (material as any).source_config?.purchase_price ??
        (material as any).sourceConfig?.purchase_price,
    ) ||
    0;
  if (raw <= 0) return 0;

  const priceTypeRaw =
    (purchase && typeof purchase === 'object'
      ? (purchase as Record<string, unknown>).defaultPurchasePriceType ??
        (purchase as Record<string, unknown>).default_purchase_price_type
      : undefined) ??
    defaults.defaultPurchasePriceType ??
    defaults.default_purchase_price_type ??
    'tax_inclusive';
  const priceType = priceTypeRaw === 'tax_exclusive' ? 'tax_exclusive' : 'tax_inclusive';
  if (priceType === 'tax_inclusive') {
    const taxRate = getMaterialDefaultTaxRate(material);
    return convertUnitPriceByPriceType(raw, taxRate, 'tax_inclusive', 'tax_exclusive');
  }
  return raw;
}

export function getMaterialDefaultTaxRate(material: Material | Record<string, unknown>): number {
  const defaults = (material as any).defaults ?? {};
  const finance = defaults.finance ?? defaults.Finance;
  const fromFinance =
    finance && typeof finance === 'object'
      ? Number(
          (finance as Record<string, unknown>).defaultTaxRate ??
            (finance as Record<string, unknown>).default_tax_rate,
        ) || 0
      : 0;
  return (
    fromFinance ||
    Number(defaults.defaultTaxRate ?? defaults.default_tax_rate) ||
    Number((material as any).defaultTaxRate ?? (material as any).default_tax_rate) ||
    0
  );
}

/** 补齐物料 defaults（列表/引用展示常不带默认价税，需拉详情） */
export async function resolveMaterialForPricing(
  material: Material | Record<string, unknown>,
  materialList?: Array<Material | Record<string, unknown>>,
): Promise<Material | Record<string, unknown>> {
  const id = Number((material as any).id);
  let full =
    materialList?.find((m) => Number((m as any).id) === id) ?? material;
  const uuid = String((full as any).uuid ?? (material as any).uuid ?? '').trim();
  const needsDetail =
    getMaterialDefaultSalePrice(full) <= 0 || getMaterialDefaultTaxRate(full) <= 0;
  if (uuid && needsDetail) {
    try {
      full = await materialApi.get(uuid);
    } catch {
      /* 保留已有对象 */
    }
  }
  return full;
}

export function pickResolvedUnitPrice(resolved?: PartnerPriceResolveResult | null): number | undefined {
  return pickNumberField(resolved as Record<string, unknown> | null | undefined, 'unitPrice', 'unit_price');
}

export function pickResolvedTaxRate(resolved?: PartnerPriceResolveResult | null): number | undefined {
  return pickNumberField(resolved as Record<string, unknown> | null | undefined, 'taxRate', 'tax_rate');
}

function formatAsOf(asOf?: string | dayjs.Dayjs): string | undefined {
  if (!asOf) return undefined;
  return formatDateTime(asOf, 'YYYY-MM-DD');
}

export type ResolvePriceBatchLine = {
  materialId: number;
  variantAttributes?: Record<string, unknown>;
};

function normalizeBatchLines(
  materialIdsOrLines: number[] | ResolvePriceBatchLine[],
  materials?: Array<Material | Record<string, unknown>>,
): ResolvePriceBatchLine[] {
  if (!materialIdsOrLines.length) return [];
  if (typeof materialIdsOrLines[0] === 'number') {
    return (materialIdsOrLines as number[]).map((materialId) => {
      const material = materials?.find((m) => Number((m as any).id) === materialId);
      const variantAttributes = material
        ? parseVariantAttributesValue(
            (material as any).variantAttributes ?? (material as any).variant_attributes,
          )
        : undefined;
      return { materialId, variantAttributes };
    });
  }
  return materialIdsOrLines as ResolvePriceBatchLine[];
}

export async function resolveCustomerSalePrice(
  customerId: number,
  materialId: number,
  asOf?: string | dayjs.Dayjs,
  variantAttributes?: Record<string, unknown>,
): Promise<PartnerPriceResolveResult> {
  return customerPriceBookApi.resolve({
    partnerId: customerId,
    materialId,
    asOf: formatAsOf(asOf),
    variantAttributes,
  });
}

export async function resolveCustomerSalePricesBatch(
  customerId: number,
  materialIdsOrLines: number[] | ResolvePriceBatchLine[],
  asOf?: string | dayjs.Dayjs,
  materials?: Array<Material | Record<string, unknown>>,
): Promise<PartnerPriceResolveResult[]> {
  const lines = normalizeBatchLines(materialIdsOrLines, materials);
  if (!customerId || !lines.length) return [];
  const res = await customerPriceBookApi.resolveBatch({
    partnerId: customerId,
    items: lines,
    asOf: formatAsOf(asOf),
  });
  return res.items ?? [];
}

export async function resolveSupplierPurchasePrice(
  supplierId: number,
  materialId: number,
  asOf?: string | dayjs.Dayjs,
  variantAttributes?: Record<string, unknown>,
): Promise<PartnerPriceResolveResult> {
  return supplierPriceBookApi.resolve({
    partnerId: supplierId,
    materialId,
    asOf: formatAsOf(asOf),
    variantAttributes,
  });
}

export async function resolveSupplierPurchasePricesBatch(
  supplierId: number,
  materialIdsOrLines: number[] | ResolvePriceBatchLine[],
  asOf?: string | dayjs.Dayjs,
  materials?: Array<Material | Record<string, unknown>>,
): Promise<PartnerPriceResolveResult[]> {
  const lines = normalizeBatchLines(materialIdsOrLines, materials);
  if (!supplierId || !lines.length) return [];
  const res = await supplierPriceBookApi.resolveBatch({
    partnerId: supplierId,
    items: lines,
    asOf: formatAsOf(asOf),
  });
  return res.items ?? [];
}

export function pickSaleUnitPrice(
  material: Material | Record<string, unknown>,
  resolved?: PartnerPriceResolveResult | null,
): number {
  if (resolved?.found) {
    const fromResolved = pickResolvedUnitPrice(resolved);
    if (fromResolved != null) return fromResolved;
  }
  return getMaterialDefaultSalePrice(material);
}

export function pickPurchaseUnitPrice(
  material: Material | Record<string, unknown>,
  resolved?: PartnerPriceResolveResult | null,
): number {
  if (resolved?.found) {
    const fromResolved = pickResolvedUnitPrice(resolved);
    if (fromResolved != null) return fromResolved;
  }
  return getMaterialDefaultPurchasePrice(material);
}

export type ResolvedSalesMaterialLinePricing = {
  material: Material | Record<string, unknown>;
  unitPrice: number;
  taxRate: number;
};

/** 批量选料：客户价本 + 物料默认价税（与单行 applySalesDocumentLineMaterialPricing 一致） */
export async function resolveSalesDocumentMaterialLinesPricing(
  materials: Array<Material | Record<string, unknown>>,
  options?: {
    customerId?: number;
    asOf?: string | dayjs.Dayjs;
    priceType?: string;
    materialList?: Array<Material | Record<string, unknown>>;
  },
): Promise<ResolvedSalesMaterialLinePricing[]> {
  if (!materials.length) return [];

  const pt = options?.priceType ?? 'tax_exclusive';
  const asOf =
    options?.asOf != null
      ? dayjs.isDayjs(options.asOf)
        ? options.asOf
        : dayjs(options.asOf)
      : dayjs();

  const enriched = await Promise.all(
    materials.map((m) => resolveMaterialForPricing(m, options?.materialList)),
  );

  const resolveMap = new Map<number, PartnerPriceResolveResult>();
  const customerId = options?.customerId ? Number(options.customerId) : undefined;
  if (customerId && enriched.length) {
    try {
      const items = await resolveCustomerSalePricesBatch(
        customerId,
        enriched.map((m) => ({
          materialId: Number((m as Material).id),
          variantAttributes: parseVariantAttributesValue(
            (m as Material).variantAttributes ?? (m as any).variant_attributes,
          ),
        })),
        asOf,
        enriched,
      );
      enriched.forEach((m, i) => {
        const id = Number((m as Material).id);
        if (items[i]) resolveMap.set(id, items[i]);
      });
    } catch {
      /* 回退物料默认价 */
    }
  }

  return enriched.map((full, idx) => {
    const id = Number((full as Material).id ?? (materials[idx] as Material).id);
    const resolved = resolveMap.get(id);
    const taxRate = pickResolvedTaxRate(resolved) ?? getMaterialDefaultTaxRate(full);
    let unitPrice = pickSaleUnitPrice(full, resolved);
    if (pt === 'tax_inclusive' && unitPrice > 0) {
      unitPrice = convertUnitPriceByPriceType(unitPrice, taxRate, 'tax_exclusive', 'tax_inclusive');
    }
    return { material: full, unitPrice, taxRate };
  });
}

export async function resolveOrderLineSalePrice(
  customerId: number | undefined,
  materialId: number | undefined,
  variantAttributes: unknown,
  material: Material | Record<string, unknown> | undefined,
  asOf?: string | dayjs.Dayjs,
): Promise<{ unitPrice: number; taxRate: number; resolved?: PartnerPriceResolveResult }> {
  const attrs = parseVariantAttributesValue(variantAttributes);
  const taxR = material != null ? getMaterialDefaultTaxRate(material) : 0;
  if (!customerId || !materialId) {
    return {
      unitPrice: material ? getMaterialDefaultSalePrice(material) : 0,
      taxRate: taxR,
    };
  }
  try {
    const resolved = await resolveCustomerSalePrice(customerId, materialId, asOf, attrs);
    const taxRate = pickResolvedTaxRate(resolved) ?? taxR;
    const unitPrice = pickSaleUnitPrice(material ?? {}, resolved);
    return { unitPrice, taxRate, resolved };
  } catch {
    return { unitPrice: material ? getMaterialDefaultSalePrice(material) : 0, taxRate: taxR };
  }
}

const toSafeNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const toCents = (value: unknown): number => Math.round(toSafeNumber(value) * 100);
const fromCents = (cents: number): number => cents / 100;

/** 切换含税/不含税时换算行单价（不含税价为真源） */
export function convertUnitPriceByPriceType(
  unitPriceInput: unknown,
  taxRateInput: unknown,
  fromPriceType: string,
  toPriceType: string,
): number {
  const unitPriceCents = toCents(unitPriceInput);
  if (fromPriceType === toPriceType) return fromCents(unitPriceCents);

  const taxRate = toSafeNumber(taxRateInput);
  const factor = 1 + taxRate / 100;
  if (factor <= 0) return fromCents(unitPriceCents);

  if (fromPriceType === 'tax_exclusive' && toPriceType === 'tax_inclusive') {
    return fromCents(Math.round(unitPriceCents * factor));
  }
  if (fromPriceType === 'tax_inclusive' && toPriceType === 'tax_exclusive') {
    return fromCents(Math.round(unitPriceCents / factor));
  }
  return fromCents(unitPriceCents);
}

/** 选物料后解析客户价本/物料默认价并回填行单价与税率（与报价单一致） */
export async function applySalesDocumentLineMaterialPricing(
  form: FormWithLineItems | null | undefined,
  index: number,
  material: Material | Record<string, unknown>,
  options?: {
    materialList?: Array<Material | Record<string, unknown>>;
    asOfField?: string;
  },
): Promise<void> {
  if (!form) return;
  const full = await resolveMaterialForPricing(material, options?.materialList);
  const customerId = form.getFieldValue('customer_id');
  const asOfField = options?.asOfField ?? 'order_date';
  const asOfRaw = form.getFieldValue(asOfField);
  const asOf =
    asOfRaw != null
      ? dayjs.isDayjs(asOfRaw)
        ? asOfRaw
        : dayjs(asOfRaw as string)
      : dayjs();
  const pt = String(form.getFieldValue('price_type') ?? 'tax_exclusive');
  const materialId = Number((full as Material).id ?? (material as Record<string, unknown>).id);
  const { unitPrice, taxRate } = await resolveOrderLineSalePrice(
    customerId ? Number(customerId) : undefined,
    Number.isFinite(materialId) ? materialId : undefined,
    undefined,
    full,
    asOf,
  );
  let up = unitPrice;
  if (pt === 'tax_inclusive' && up > 0) {
    up = convertUnitPriceByPriceType(up, taxRate, 'tax_exclusive', 'tax_inclusive');
  }
  const items = [...normalizeFormListItems<Record<string, unknown>>(form.getFieldValue('items'))];
  if (!items[index]) return;
  items[index] = { ...items[index], unit_price: up, tax_rate: taxRate };
  form.setFieldsValue({ items });
  // 嵌套字段显式写入，避免 Form.List 行内 InputNumber 与 store 不同步
  form.setFieldValue(['items', index, 'unit_price'], up);
  form.setFieldValue(['items', index, 'tax_rate'], taxRate);
}

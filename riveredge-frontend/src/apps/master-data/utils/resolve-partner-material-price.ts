import dayjs from 'dayjs';
import type { Material } from '../types/material';
import { customerPriceBookApi, supplierPriceBookApi } from '../services/partner-price-book';
import type { PartnerPriceResolveResult } from '../types/partner-price-book';
import { parseVariantAttributesValue } from '../components/VariantAttributeFields';

export function getMaterialDefaultSalePrice(material: Material | Record<string, unknown>): number {
  const defaults = (material as any).defaults ?? {};
  return (
    Number(
      defaults.defaultSalePrice ??
        defaults.default_sale_price ??
        (material as any).defaultSalePrice ??
        (material as any).default_sale_price,
    ) || 0
  );
}

export function getMaterialDefaultPurchasePrice(material: Material | Record<string, unknown>): number {
  const defaults = (material as any).defaults ?? {};
  const purchase = defaults.purchase ?? {};
  return (
    Number(
      purchase.standard_price ??
        purchase.purchase_price ??
        defaults.defaultPurchasePrice ??
        defaults.default_purchase_price ??
        (material as any).source_config?.purchase_price ??
        (material as any).sourceConfig?.purchase_price,
    ) || 0
  );
}

export function getMaterialDefaultTaxRate(material: Material | Record<string, unknown>): number {
  const defaults = (material as any).defaults ?? {};
  return Number(defaults.defaultTaxRate ?? defaults.default_tax_rate) || 0;
}

function formatAsOf(asOf?: string | dayjs.Dayjs): string | undefined {
  if (!asOf) return undefined;
  return dayjs(asOf).format('YYYY-MM-DD');
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
  if (resolved?.found && resolved.unitPrice != null) {
    return Number(resolved.unitPrice) || 0;
  }
  return getMaterialDefaultSalePrice(material);
}

export function pickPurchaseUnitPrice(
  material: Material | Record<string, unknown>,
  resolved?: PartnerPriceResolveResult | null,
): number {
  if (resolved?.found && resolved.unitPrice != null) {
    return Number(resolved.unitPrice) || 0;
  }
  return getMaterialDefaultPurchasePrice(material);
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
    const taxRate = resolved?.taxRate != null ? Number(resolved.taxRate) : taxR;
    const unitPrice = pickSaleUnitPrice(material ?? {}, resolved);
    return { unitPrice, taxRate, resolved };
  } catch {
    return { unitPrice: material ? getMaterialDefaultSalePrice(material) : 0, taxRate: taxR };
  }
}

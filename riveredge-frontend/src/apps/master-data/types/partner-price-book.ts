/** 客户/供应商价格本类型 */

export type PartnerPriceBookType = 'customer' | 'supplier';

export interface PartnerPriceVariantLine {
  variantAttributes: Record<string, unknown>;
  unitPrice: number;
}

export interface PartnerPriceBook {
  id: number;
  uuid: string;
  tenantId: number;
  partnerType: PartnerPriceBookType;
  partnerId: number;
  partnerCode?: string;
  partnerName?: string;
  materialId: number;
  materialCode?: string;
  materialName?: string;
  partnerMaterialCode?: string;
  partnerMaterialName?: string;
  unitPrice?: number;
  priceType?: 'tax_inclusive' | 'tax_exclusive';
  variantPrices?: PartnerPriceVariantLine[];
  currencyCode?: string;
  taxRate?: number;
  unit?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  remark?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerPriceBookCreate {
  partnerId: number;
  materialId: number;
  unitPrice?: number;
  priceType?: 'tax_inclusive' | 'tax_exclusive';
  variantPrices?: PartnerPriceVariantLine[];
  currencyCode?: string;
  taxRate?: number;
  unit?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  remark?: string;
  isActive?: boolean;
  /** 无编号映射时可提交，保存后回写 MaterialCodeAlias */
  partnerMaterialCode?: string;
  partnerMaterialName?: string;
  /** 默认 true；已有映射时不写入 */
  syncPartnerAlias?: boolean;
}

export interface PartnerPriceBookUpdate extends Partial<PartnerPriceBookCreate> {}

export interface PartnerPriceBookListParams {
  skip?: number;
  limit?: number;
  partnerId?: number;
  materialId?: number;
  keyword?: string;
  activeOnly?: boolean;
  effectiveOn?: string;
}

export interface PartnerPriceBookListResponse {
  data: PartnerPriceBook[];
  total: number;
}

export interface PartnerPriceResolveResult {
  found: boolean;
  unitPrice?: number;
  isVariantPrice?: boolean;
  currencyCode?: string;
  taxRate?: number;
  unit?: string;
  materialId?: number;
  partnerMaterialCode?: string;
  partnerMaterialName?: string;
  priceBookUuid?: string;
}

export interface PartnerPriceResolveBatchLineRequest {
  materialId: number;
  variantAttributes?: Record<string, unknown>;
}

export interface PartnerPriceResolveBatchRequest {
  partnerId: number;
  materialIds?: number[];
  items?: PartnerPriceResolveBatchLineRequest[];
  asOf?: string;
}

export interface PartnerPriceResolveBatchResponse {
  items: PartnerPriceResolveResult[];
}

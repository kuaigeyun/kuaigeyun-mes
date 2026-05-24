import { api } from '../../../services/api';
import type {
  PartnerPriceBook,
  PartnerPriceBookCreate,
  PartnerPriceBookListParams,
  PartnerPriceBookListResponse,
  PartnerPriceBookType,
  PartnerPriceBookUpdate,
  PartnerPriceResolveBatchRequest,
  PartnerPriceResolveBatchResponse,
  PartnerPriceResolveResult,
} from '../types/partner-price-book';

function resourcePath(partnerType: PartnerPriceBookType): string {
  return partnerType === 'customer' ? 'customer-price-books' : 'supplier-price-books';
}

export function createPartnerPriceBookApi(partnerType: PartnerPriceBookType) {
  const base = `/apps/master-data/supply-chain/${resourcePath(partnerType)}`;

  return {
    create: (data: PartnerPriceBookCreate): Promise<PartnerPriceBook> => api.post(base, data),
    list: (params?: PartnerPriceBookListParams): Promise<PartnerPriceBookListResponse> =>
      api.get(base, { params }),
    get: (uuid: string): Promise<PartnerPriceBook> => api.get(`${base}/${uuid}`),
    update: (uuid: string, data: PartnerPriceBookUpdate): Promise<PartnerPriceBook> =>
      api.put(`${base}/${uuid}`, data),
    delete: (uuid: string): Promise<void> => api.delete(`${base}/${uuid}`),
    resolve: (params: {
      partnerId: number;
      materialId?: number;
      partnerMaterialCode?: string;
      variantAttributes?: Record<string, unknown>;
      asOf?: string;
    }): Promise<PartnerPriceResolveResult> => {
      if (params.variantAttributes && Object.keys(params.variantAttributes).length > 0) {
        return api.post(`${base}/resolve`, {
          partnerId: params.partnerId,
          materialId: params.materialId,
          partnerMaterialCode: params.partnerMaterialCode,
          variantAttributes: params.variantAttributes,
          asOf: params.asOf,
        });
      }
      return api.get(`${base}/resolve`, { params });
    },
    resolveBatch: (data: PartnerPriceResolveBatchRequest): Promise<PartnerPriceResolveBatchResponse> =>
      api.post(`${base}/resolve-batch`, data),
  };
}

export const customerPriceBookApi = createPartnerPriceBookApi('customer');
export const supplierPriceBookApi = createPartnerPriceBookApi('supplier');

import { api } from '../../../services/api';
import type {
  LoadMarketPricePresetResult,
  MaterialMarketInstrument,
  MaterialMarketPrice,
  MaterialMarketPriceCreate,
  MaterialMarketPricePresetItem,
  MaterialMarketPriceUpdate,
  MaterialMarketPriceTrend,
  MaterialMarketSaleResolve,
} from '../types/material-market-price';

const BASE = '/apps/master-data/materials';

export const materialMarketPriceApi = {
  list: async (params?: {
    skip?: number;
    limit?: number;
    keyword?: string;
    quoteCode?: string;
    priceDate?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<{ items: MaterialMarketPrice[]; total: number }> => {
    const res = await api.get<{ items: MaterialMarketPrice[]; total: number }>(`${BASE}/market-prices`, {
      params,
    });
    if (Array.isArray(res)) return { items: res, total: res.length };
    return { items: res?.items ?? [], total: res?.total ?? 0 };
  },

  listInstruments: async (): Promise<MaterialMarketInstrument[]> => {
    const res = await api.get<{ items: MaterialMarketInstrument[] }>(`${BASE}/market-prices/instruments`);
    if (Array.isArray(res)) return res;
    return res?.items ?? [];
  },

  listPresets: async (): Promise<MaterialMarketPricePresetItem[]> => {
    const res = await api.get<MaterialMarketPricePresetItem[]>(`${BASE}/market-prices/preset-preview`);
    return Array.isArray(res) ? res : [];
  },

  loadPresets: (codes?: string[]) =>
    api.post<LoadMarketPricePresetResult>(`${BASE}/market-prices/load-preset`, { codes }),

  create: (data: MaterialMarketPriceCreate) =>
    api.post<MaterialMarketPrice>(`${BASE}/market-prices`, data),

  get: (uuid: string) => api.get<MaterialMarketPrice>(`${BASE}/market-prices/${uuid}`),

  update: (uuid: string, data: MaterialMarketPriceUpdate) =>
    api.put<MaterialMarketPrice>(`${BASE}/market-prices/${uuid}`, data),

  delete: (uuid: string) => api.delete(`${BASE}/market-prices/${uuid}`),

  getTrend: (quoteCode: string, params?: { days?: number; endDate?: string }) =>
    api.get<MaterialMarketPriceTrend>(`${BASE}/market-prices/trend`, {
      params: { quoteCode, ...params },
    }),

  resolveSale: (materialUuid: string, priceDate: string) =>
    api.get<MaterialMarketSaleResolve>(`${BASE}/market-prices/resolve-sale`, {
      params: { materialUuid, priceDate },
    }),
};

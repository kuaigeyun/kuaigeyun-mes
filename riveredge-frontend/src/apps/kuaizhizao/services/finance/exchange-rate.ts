/**
 * 轻财务汇率 API（销售订单填汇率；后端 /apps/kuaicaiwu）
 */
import { apiRequest } from '../../../../services/api';

export interface GlExchangeRateLookupResult {
  currency_code: string;
  as_of_date: string;
  found: boolean;
  rate?: number | null;
}

const API = '/apps/kuaicaiwu/exchange-rates';

export const exchangeRateService = {
  lookup: (params: { currency_code: string; as_of_date: string }) =>
    apiRequest<GlExchangeRateLookupResult>(`${API}/lookup`, { method: 'GET', params }),
};

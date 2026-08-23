export type MarketPriceType = 'tax_inclusive' | 'tax_exclusive';

export interface MaterialMarketPrice {
  id: number;
  uuid: string;
  code: string;
  name: string;
  priceDate: string;
  unitPrice: number;
  priceType: MarketPriceType;
  createdBy?: number;
  createdByName?: string;
  updatedBy?: number;
  updatedByName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MaterialMarketPriceCreate {
  code: string;
  name: string;
  priceDate: string;
  unitPrice: number;
  priceType: MarketPriceType;
}

export interface MaterialMarketPriceUpdate {
  name?: string;
  unitPrice?: number;
  priceType?: MarketPriceType;
}

export interface MaterialMarketInstrument {
  code: string;
  name: string;
}

export interface MaterialMarketPricePresetItem {
  code: string;
  name: string;
  exists: boolean;
}

export interface LoadMarketPricePresetResult {
  created: number;
  skipped: number;
  priceDate: string;
  message: string;
}

export interface MaterialMarketSaleResolve {
  found: boolean;
  salePriceMethod: 'fixed' | 'market';
  unitPrice: number;
  taxRate: number;
  snapshot?: Record<string, unknown> | null;
  message?: string | null;
}

export interface MaterialMarketPriceTrendPoint {
  priceDate: string;
  unitPrice: number;
  priceType: MarketPriceType;
}

export interface MaterialMarketPriceTrend {
  code: string;
  name: string;
  startDate: string;
  endDate: string;
  points: MaterialMarketPriceTrendPoint[];
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
}

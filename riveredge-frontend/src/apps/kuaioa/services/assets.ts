import { kuaioaDelete, kuaioaGet, kuaioaList, kuaioaPost, kuaioaPut } from './kuaioaApi';

const BASE = '/apps/kuaioa/assets';

export interface AssetPurchase {
  id: number;
  purchase_code: string;
  title: string;
  asset_category?: string | null;
  estimated_amount?: number | null;
  status: string;
  applicant_name?: string | null;
  approval_status?: string | null;
}

export interface FixedAsset {
  id: number;
  asset_code: string;
  asset_name: string;
  asset_category?: string | null;
  custodian_name?: string | null;
  status: string;
}

export const listAssetPurchases = (params?: Record<string, unknown>) =>
  kuaioaList<AssetPurchase>(`${BASE}/purchases`, params);
export const getAssetPurchase = (id: number) =>
  kuaioaGet<AssetPurchase>(`${BASE}/purchases/${id}`);
export const createAssetPurchase = (data: Partial<AssetPurchase>) =>
  kuaioaPost<AssetPurchase>(`${BASE}/purchases`, data);
export const updateAssetPurchase = (id: number, data: Partial<AssetPurchase>) =>
  kuaioaPut<AssetPurchase>(`${BASE}/purchases/${id}`, data);
export const deleteAssetPurchase = (id: number) => kuaioaDelete(`${BASE}/purchases/${id}`);
export const submitAssetPurchase = (id: number) =>
  kuaioaPost<AssetPurchase>(`${BASE}/purchases/${id}/submit`);
export const revokeAssetPurchase = (id: number) =>
  kuaioaPost<AssetPurchase>(`${BASE}/purchases/${id}/revoke`);
export const registerAssetFromPurchase = (id: number) =>
  kuaioaPost<FixedAsset>(`${BASE}/purchases/${id}/register`);

export const listFixedAssets = (params?: Record<string, unknown>) =>
  kuaioaList<FixedAsset>(`${BASE}/registry`, params);
export const getFixedAsset = (id: number) =>
  kuaioaGet<FixedAsset>(`${BASE}/registry/${id}`);
export const createFixedAsset = (data: Partial<FixedAsset>) =>
  kuaioaPost<FixedAsset>(`${BASE}/registry`, data);
export const updateFixedAsset = (id: number, data: Partial<FixedAsset>) =>
  kuaioaPut<FixedAsset>(`${BASE}/registry/${id}`, data);
export const deleteFixedAsset = (id: number) => kuaioaDelete(`${BASE}/registry/${id}`);
export const assignFixedAsset = (id: number, data: { custodian_id: number; custodian_name: string }) =>
  kuaioaPost<FixedAsset>(`${BASE}/registry/${id}/assign`, data);
export const returnFixedAsset = (id: number) =>
  kuaioaPost<FixedAsset>(`${BASE}/registry/${id}/return`);
export const scrapFixedAsset = (id: number) =>
  kuaioaPost<FixedAsset>(`${BASE}/registry/${id}/scrap`);

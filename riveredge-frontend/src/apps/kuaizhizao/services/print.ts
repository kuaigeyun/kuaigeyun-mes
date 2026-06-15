/**
 * 快制造 — 通用单据打印预览
 */

import { apiRequest } from '../../../services/api';

export function loadKuaizhizaoPrintTemplatePresets(): Promise<{ created: number }> {
  return apiRequest('/apps/kuaizhizao/print/load-presets', { method: 'POST' });
}

export function resolveDeliveryNoticeQualityCertificates(
  noticeId: number | string,
): Promise<{ certificates: Array<{ inspection_id: number; material_name?: string; release_certificate?: string }> }> {
  return apiRequest(`/apps/kuaizhizao/delivery-notices/${noticeId}/resolve-quality-certificate`, {
    method: 'GET',
  });
}

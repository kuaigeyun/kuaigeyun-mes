/**
 * 主数据工程资料深链（新标签打开）
 */

export type EngineeringLinkType = 'bom' | 'drawing' | 'route' | 'sop' | 'material';

const BASE = '/apps/master-data';

export const ENGINEERING_LINK_TYPE_LABELS: Record<string, string> = {
  bom: 'BOM',
  drawing: '图纸',
  route: '工艺路线',
  process_route: '工艺路线',
  sop: 'SOP',
  material: '物料',
};

export interface MasterDataLinkTarget {
  link_type: EngineeringLinkType;
  target_uuid?: string | null;
  target_id?: number | string | null;
  version?: string | null;
  material_id?: number | string | null;
}

export function buildMasterDataUrl(target: MasterDataLinkTarget): string | null {
  const { link_type, target_uuid, target_id, version, material_id } = target;
  const normalizedType = link_type === 'process_route' ? 'route' : link_type;
  switch (normalizedType) {
    case 'bom': {
      if (material_id != null) {
        const v = version ? `&version=${encodeURIComponent(version)}` : '';
        return `${BASE}/process/engineering-bom/designer?materialId=${material_id}${v}`;
      }
      return `${BASE}/process/engineering-bom`;
    }
    case 'drawing':
      if (target_uuid) return `${BASE}/process/drawings?uuid=${encodeURIComponent(target_uuid)}`;
      return `${BASE}/process/drawings`;
    case 'route':
      if (target_uuid) return `${BASE}/process/routes?uuid=${encodeURIComponent(target_uuid)}`;
      if (target_id != null) return `${BASE}/process/routes?id=${target_id}`;
      return `${BASE}/process/routes`;
    case 'sop':
      if (target_uuid) return `${BASE}/process/sop?uuid=${encodeURIComponent(target_uuid)}`;
      return `${BASE}/process/sop`;
    case 'material':
      if (target_id != null) return `${BASE}/materials?highlight=${target_id}`;
      return `${BASE}/materials`;
    default:
      return null;
  }
}

export function openMasterDataInNewTab(target: MasterDataLinkTarget): boolean {
  const url = buildMasterDataUrl(target);
  if (!url) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

export function buildBomChangeCreateUrl(): string {
  return `${BASE}/process/engineering-bom`;
}

export function buildRouteChangeCreateUrl(): string {
  return `${BASE}/process/routes`;
}

export function buildPurchaseInquiryUrl(inquiryId: number | string): string {
  return `/apps/kuaizhizao/purchase-management/purchase-inquiries?highlight=${inquiryId}`;
}

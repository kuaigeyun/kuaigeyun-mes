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

export function buildBomChangeCreateUrl(materialId?: number | string | null): string {
  if (materialId != null) {
    return `${BASE}/process/engineering-bom/designer?materialId=${materialId}`;
  }
  return `${BASE}/process/engineering-bom`;
}

export function buildWorkOrderUrl(targetId?: number | string | null, targetCode?: string | null): string {
  const base = '/apps/kuaizhizao/production-execution/work-orders';
  if (targetCode) {
    return `${base}?keyword=${encodeURIComponent(targetCode)}`;
  }
  if (targetId != null) {
    return `${base}?keyword=${encodeURIComponent(String(targetId))}`;
  }
  return base;
}

export function buildRequirementUrl(projectId?: number | string | null, requirementId?: number | string | null): string {
  const params = new URLSearchParams();
  if (projectId != null) params.set('project_id', String(projectId));
  if (requirementId != null) params.set('highlight', String(requirementId));
  const qs = params.toString();
  return `/apps/kuaiplm/phase2/requirements${qs ? `?${qs}` : ''}`;
}

export interface ProjectLinkTarget {
  link_type: string;
  target_type?: string | null;
  target_uuid?: string | null;
  target_id?: number | string | null;
  target_code?: string | null;
  version?: string | null;
  material_id?: number | string | null;
  project_id?: number | string | null;
}

export function buildProjectLinkUrl(target: ProjectLinkTarget): string | null {
  const linkType = String(target.link_type || target.target_type || '').toLowerCase();
  if (linkType === 'work_order') {
    return buildWorkOrderUrl(target.target_id, target.target_code);
  }
  if (linkType === 'requirement') {
    return buildRequirementUrl(target.project_id, target.target_id);
  }
  if (linkType === 'design_review') {
    const params = new URLSearchParams();
    if (target.project_id != null) params.set('project_id', String(target.project_id));
    const qs = params.toString();
    return `/apps/kuaiplm/phase2/design-reviews${qs ? `?${qs}` : ''}`;
  }
  if (linkType === 'fmea') {
    const params = new URLSearchParams();
    if (target.project_id != null) params.set('project_id', String(target.project_id));
    const qs = params.toString();
    return `/apps/kuaiplm/phase2/fmea${qs ? `?${qs}` : ''}`;
  }
  return buildMasterDataUrl({
    link_type: linkType as EngineeringLinkType,
    target_uuid: target.target_uuid,
    target_id: target.target_id,
    version: target.version,
    material_id: target.material_id,
  });
}

export function openProjectLinkInNewTab(target: ProjectLinkTarget): boolean {
  const url = buildProjectLinkUrl(target);
  if (!url) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

export function buildRouteChangeCreateUrl(): string {
  return `${BASE}/process/routes`;
}

export function buildDrawingChangeCreateUrl(drawingUuid?: string | null): string {
  const params = new URLSearchParams({ create: 'drawing' });
  if (drawingUuid) params.set('drawingUuid', drawingUuid);
  return `/apps/kuaiplm/change-management?${params.toString()}`;
}

export function buildPurchaseInquiryUrl(inquiryId: number | string): string {
  return `/apps/kuaizhizao/purchase-management/purchase-inquiries?highlight=${inquiryId}`;
}

/** 从检验单记录解析方案/标准模板（other_checks 或 quality_characteristics） */
export function getInspectionTemplateSource(record: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!record) return null;
  const src = record.quality_characteristics ?? record.other_checks;
  if (!src || typeof src !== 'object') return null;
  return src as Record<string, unknown>;
}

export type InspectionPlanStepItem = {
  sequence?: number;
  inspection_item?: string;
  inspection_method?: string;
  acceptance_criteria?: string;
  sampling_type?: string;
};

export function getTemplateStepItems(template: Record<string, unknown> | null): InspectionPlanStepItem[] {
  if (!template) return [];
  const items = template.items;
  return Array.isArray(items) ? (items as InspectionPlanStepItem[]) : [];
}

export function hasInspectionPlanSteps(template: Record<string, unknown> | null): boolean {
  return getTemplateStepItems(template).length > 0;
}

/** 从表单值提取 conduct 所需的 measurement_data / item_results */
export function pickInspectionConductExtras(values: Record<string, unknown>): Record<string, unknown> {
  const extras: Record<string, unknown> = {};
  const measurement = values.measurement_data;
  const itemResults = values.item_results;
  if (measurement && typeof measurement === 'object' && Object.keys(measurement as object).length > 0) {
    extras.measurement_data = measurement;
  }
  if (itemResults && typeof itemResults === 'object' && Object.keys(itemResults as object).length > 0) {
    extras.item_results = itemResults;
  }
  return extras;
}

const INSPECTION_SOURCE_PATH: Record<string, string> = {
  incoming_inspection: '/apps/kuaizhizao/quality-management/incoming-inspection',
  process_inspection: '/apps/kuaizhizao/quality-management/process-inspection',
  finished_goods_inspection: '/apps/kuaizhizao/quality-management/finished-goods-inspection',
  oqc_inspection: '/apps/kuaizhizao/quality-management/oqc-inspection',
};

const INSPECTION_SOURCE_QUERY_KEY: Record<string, string> = {
  incoming_inspection: 'incoming_inspection_id',
  process_inspection: 'process_inspection_id',
  finished_goods_inspection: 'finished_goods_inspection_id',
  oqc_inspection: 'oqc_inspection_id',
};

export function buildInspectionDetailPath(sourceType?: string | null, inspectionId?: number | null): string | null {
  if (!sourceType || !inspectionId || !INSPECTION_SOURCE_PATH[sourceType]) return null;
  const key = INSPECTION_SOURCE_QUERY_KEY[sourceType];
  return `${INSPECTION_SOURCE_PATH[sourceType]}?${key}=${inspectionId}`;
}

export type TraceabilityNodeLike = {
  id?: string;
  type?: string;
  data?: Record<string, unknown>;
};

const TRACEABILITY_NODE_LABEL: Record<string, string> = {
  work_order: '产线工单',
  batch: '物料批次',
  process_inspection: '过程检验',
  finished_goods_inspection: '成品检验',
  defect_record: '不合格品',
  incoming_inspection: '来料检验',
  oqc_inspection: '出货检验',
};

export function getTraceabilityNodeTypeLabel(type?: string): string {
  if (!type) return '节点';
  return TRACEABILITY_NODE_LABEL[type] || type;
}

export function buildTraceabilityNodePath(node: TraceabilityNodeLike): string | null {
  if (!node?.type) return null;
  const data = node.data || {};

  if (node.type === 'work_order') {
    const params = new URLSearchParams();
    if (data.work_order_id != null) params.set('id', String(data.work_order_id));
    if (data.work_order_code) params.set('code', String(data.work_order_code));
    const q = params.toString();
    return q ? `/apps/kuaizhizao/production-execution/work-orders?${q}` : '/apps/kuaizhizao/production-execution/work-orders';
  }

  if (node.type === 'process_inspection' && data.inspection_id) {
    return buildInspectionDetailPath('process_inspection', Number(data.inspection_id));
  }
  if (node.type === 'finished_goods_inspection' && data.inspection_id) {
    return buildInspectionDetailPath('finished_goods_inspection', Number(data.inspection_id));
  }
  if (node.type === 'incoming_inspection' && data.inspection_id) {
    return buildInspectionDetailPath('incoming_inspection', Number(data.inspection_id));
  }
  if (node.type === 'oqc_inspection' && data.inspection_id) {
    return buildInspectionDetailPath('oqc_inspection', Number(data.inspection_id));
  }
  if (node.type === 'defect_record' && data.defect_id) {
    return `/apps/kuaizhizao/quality-management/nonconforming-ledger?defect_id=${data.defect_id}`;
  }

  return null;
}

export function getTraceabilityNodeStyle(type?: string): { fill: string; stroke: string } {
  switch (type) {
    case 'work_order':
      return { fill: '#E6F7FF', stroke: '#1890FF' };
    case 'process_inspection':
      return { fill: '#F9F0FF', stroke: '#722ED1' };
    case 'finished_goods_inspection':
      return { fill: '#F6FFED', stroke: '#52C41A' };
    case 'incoming_inspection':
      return { fill: '#E6FFFB', stroke: '#13C2C2' };
    case 'oqc_inspection':
      return { fill: '#FFF7E6', stroke: '#FA8C16' };
    case 'defect_record':
      return { fill: '#FFF1F0', stroke: '#F5222D' };
    default:
      return { fill: '#FAFAFA', stroke: '#8C8C8C' };
  }
}

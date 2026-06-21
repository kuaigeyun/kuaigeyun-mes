import type { TFunction } from 'i18next';
import { translateWorkOrderLifecycleStatus } from '../../../utils/workOrderLifecycle';
import {
  normalizeValueType,
  type InspectionTemplateStepItem,
  type StepConductEntry,
} from '../../../types/inspectionStepSpec';

/** 从检验单记录解析方案/标准模板（other_checks 或 quality_characteristics） */
export function getInspectionTemplateSource(record: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!record) return null;
  const src = record.quality_characteristics ?? record.other_checks;
  if (!src || typeof src !== 'object') return null;
  return src as Record<string, unknown>;
}

export type { InspectionTemplateStepItem };

export function getTemplateStepItems(template: Record<string, unknown> | null): InspectionTemplateStepItem[] {
  if (!template) return [];
  const items = template.items;
  if (!Array.isArray(items)) return [];
  return items as InspectionTemplateStepItem[];
}

export function hasInspectionPlanSteps(template: Record<string, unknown> | null): boolean {
  return getTemplateStepItems(template).length > 0;
}

/** 快照项是否含结构化 value_type（新方案）；否则走 legacy 合格/不合格 */
export function isTypedInspectionStep(step: InspectionTemplateStepItem): boolean {
  return !!step.value_type;
}

/** 已保存的分项检验结果（conduct 后写入模板 JSON） */
export function getConductStepResults(
  template: Record<string, unknown> | null,
): Record<string, StepConductEntry> {
  if (!template) return {};
  const typed = template.conduct_step_results;
  if (typed && typeof typed === 'object') {
    return typed as Record<string, StepConductEntry>;
  }
  const legacy = template.conduct_item_results;
  if (!legacy || typeof legacy !== 'object') return {};
  const out: Record<string, StepConductEntry> = {};
  Object.entries(legacy as Record<string, unknown>).forEach(([k, v]) => {
    if (v === 'pass' || v === 'fail') {
      out[k] = { judgment: v };
    }
  });
  return out;
}

export function hasConductStepResults(inspection: Record<string, unknown> | null | undefined): boolean {
  const template = getInspectionTemplateSource(inspection);
  if (!template) return false;
  return Object.keys(getConductStepResults(template)).length > 0;
}

/** 从表单值提取 conduct 所需的 measurement_data / item_results / conduct_step_results */
export function pickInspectionConductExtras(values: Record<string, unknown>): Record<string, unknown> {
  const extras: Record<string, unknown> = {};
  const measurement = values.measurement_data;
  const itemResults = values.item_results;
  const stepResults = values.conduct_step_results;
  if (measurement && typeof measurement === 'object' && Object.keys(measurement as object).length > 0) {
    extras.measurement_data = measurement;
  }
  if (itemResults && typeof itemResults === 'object' && Object.keys(itemResults as object).length > 0) {
    extras.item_results = itemResults;
  }
  if (stepResults && typeof stepResults === 'object' && Object.keys(stepResults as object).length > 0) {
    const normalized: Record<string, unknown> = {};
    Object.entries(stepResults as Record<string, unknown>).forEach(([key, raw]) => {
      if (!raw || typeof raw !== 'object') {
        normalized[key] = raw;
        return;
      }
      const entry = { ...(raw as Record<string, unknown>) };
      if (Array.isArray(entry.photos)) {
        entry.photos = entry.photos
          .filter((p) => p && typeof p === 'object')
          .map((p) => {
            const photo = p as Record<string, unknown>;
            return {
              uid: photo.uid,
              name: photo.name,
              url: photo.url,
              status: photo.status || 'done',
            };
          })
          .filter((p) => p.uid || p.url);
      }
      normalized[key] = entry;
    });
    extras.conduct_step_results = normalized;
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

const TRACEABILITY_NODE_TYPE_I18N: Record<string, string> = {
  work_order: 'app.kuaizhizao.quality.traceability.nodeType.workOrder',
  batch: 'app.kuaizhizao.quality.traceability.nodeType.batch',
  serial: 'app.kuaizhizao.quality.traceability.nodeType.serial',
  inbound: 'app.kuaizhizao.quality.traceability.nodeType.inbound',
  outbound: 'app.kuaizhizao.quality.traceability.nodeType.outbound',
  process_inspection: 'app.kuaizhizao.quality.traceability.nodeType.processInspection',
  finished_goods_inspection: 'app.kuaizhizao.quality.traceability.nodeType.finishedGoodsInspection',
  defect_record: 'app.kuaizhizao.quality.traceability.nodeType.defectRecord',
  incoming_inspection: 'app.kuaizhizao.quality.traceability.nodeType.incomingInspection',
  oqc_inspection: 'app.kuaizhizao.quality.traceability.nodeType.oqcInspection',
  reporting_record: 'app.kuaizhizao.quality.traceability.nodeType.reportingRecord',
  finished_goods_receipt: 'app.kuaizhizao.quality.traceability.nodeType.finishedGoodsReceipt',
  semi_finished_goods_receipt: 'app.kuaizhizao.quality.traceability.nodeType.semiFinishedGoodsReceipt',
  purchase_receipt: 'app.kuaizhizao.quality.traceability.nodeType.purchaseReceipt',
  customer_material_registration: 'app.kuaizhizao.quality.traceability.nodeType.customerMaterialRegistration',
  sales_delivery: 'app.kuaizhizao.quality.traceability.nodeType.salesDelivery',
  sales_return: 'app.kuaizhizao.quality.traceability.nodeType.salesReturn',
  material_binding: 'app.kuaizhizao.quality.traceability.nodeType.materialBinding',
};

export function formatTraceEventRemark(remark: string | undefined | null, t: TFunction): string {
  if (!remark?.trim()) return '-';
  const trimmed = remark.trim();
  const statusMatch = trimmed.match(/^(?:状态|status):\s*(.+)$/i);
  if (statusMatch) {
    const translated = translateWorkOrderLifecycleStatus(t, statusMatch[1].trim());
    return t('app.kuaizhizao.quality.traceability.remarkStatus', { status: translated });
  }
  return trimmed;
}

export function getTraceabilityNodeTypeLabel(type: string | undefined, t: TFunction): string {
  if (!type) return t('app.kuaizhizao.quality.traceability.nodeType.default');
  const key = TRACEABILITY_NODE_TYPE_I18N[type];
  return key ? t(key) : type;
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

  const docType = String(data.document_type || '');
  const docId = data.document_id;
  if (docType === 'finished_goods_receipt' && docId) {
    return `/apps/kuaizhizao/warehouse-management/inbound?receipt_id=${docId}`;
  }
  if (docType === 'purchase_receipt' && docId) {
    return `/apps/kuaizhizao/purchase-management/purchase-receipts?receipt_id=${docId}`;
  }
  if (docType === 'sales_delivery' && docId) {
    return `/apps/kuaizhizao/sales-management/sales-deliveries?delivery_id=${docId}`;
  }
  if (docType === 'sales_return' && docId) {
    return `/apps/kuaizhizao/sales-management/sales-returns?return_id=${docId}`;
  }
  if (docType === 'semi_finished_goods_receipt' && docId) {
    return `/apps/kuaizhizao/warehouse-management/inbound?semi_receipt_id=${docId}`;
  }

  return null;
}

export function getTraceabilityNodeStyle(type?: string): { fill: string; stroke: string } {
  switch (type) {
    case 'work_order':
      return { fill: '#E6F7FF', stroke: '#1890FF' };
    case 'serial':
      return { fill: '#F0F5FF', stroke: '#2F54EB' };
    case 'batch':
      return { fill: '#FCFFE6', stroke: '#A0D911' };
    case 'inbound':
      return { fill: '#E6FFFB', stroke: '#13C2C2' };
    case 'outbound':
      return { fill: '#FFF7E6', stroke: '#FA8C16' };
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

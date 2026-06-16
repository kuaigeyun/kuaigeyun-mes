/**
 * 采购询价单生命周期
 */

import type { LifecycleResult, SubStage } from '../../../components/uni-lifecycle/types';
import type { BackendLifecycle } from './backendLifecycle';
import { parseBackendLifecycle } from './backendLifecycle';
import {
  LIST_LIFECYCLE_STAGE_FIELD,
  resolveListLifecycleStageFromSearch,
  toListLifecycleStageApiParams,
} from '../../../utils/listLifecycleStage';

const STATUS_TO_STAGE: Record<string, string> = {
  DRAFT: '草稿',
  QUOTING: '询价中',
  PENDING_COMPARE: '待比价',
  AWARDED: '已定标',
  CONVERTED: '已转单',
  CANCELLED: '已取消',
  草稿: '草稿',
  询价中: '询价中',
  待比价: '待比价',
  已定标: '已定标',
  已转单: '已转单',
  已取消: '已取消',
};

const STAGE_LABELS = ['草稿', '询价中', '待比价', '已定标', '已转单'] as const;

const STAGE_I18N: Record<string, string> = {
  草稿: 'app.kuaizhizao.purchaseInquiry.lifecycleDraft',
  询价中: 'app.kuaizhizao.purchaseInquiry.lifecycleQuoting',
  待比价: 'app.kuaizhizao.purchaseInquiry.lifecyclePendingCompare',
  已定标: 'app.kuaizhizao.purchaseInquiry.lifecycleAwarded',
  已转单: 'app.kuaizhizao.purchaseInquiry.lifecycleConverted',
};

export function isInquiryDraft(record: { status?: string }): boolean {
  const s = (record.status ?? '').trim();
  return s === 'DRAFT' || s === '草稿';
}

export function isInquiryQuoting(record: { status?: string }): boolean {
  const s = (record.status ?? '').trim();
  return s === 'QUOTING' || s === '询价中';
}

export function isInquiryPendingCompare(record: { status?: string }): boolean {
  const s = (record.status ?? '').trim();
  return s === 'PENDING_COMPARE' || s === '待比价';
}

export function isInquiryAwarded(record: { status?: string }): boolean {
  const s = (record.status ?? '').trim();
  return s === 'AWARDED' || s === '已定标';
}

export function buildPurchaseInquiryLifecycleValueEnum(
  t?: (key: string) => string,
): Record<string, { text: string; status?: string }> {
  const map: Record<string, { text: string; status?: string }> = {};
  STAGE_LABELS.forEach((label) => {
    map[label] = {
      text: t && STAGE_I18N[label] ? t(STAGE_I18N[label]) : label,
      status: label === '已转单' ? 'Success' : 'Default',
    };
  });
  return map;
}

export function resolvePurchaseInquiryListLifecycleParams(
  searchFormValues?: Record<string, unknown> | null,
  params?: Record<string, unknown> | null,
): { lifecycle_stage?: string } {
  const stage = resolveListLifecycleStageFromSearch(searchFormValues, params, {
    allowedStages: STAGE_LABELS,
  });
  return toListLifecycleStageApiParams(stage);
}

export function getPurchaseInquiryLifecycle(record: Record<string, unknown> | null | undefined): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  const backend = record.lifecycle as BackendLifecycle | undefined;
  if (backend?.main_stages?.length) {
    return parseBackendLifecycle(backend);
  }
  const status = (record.status as string) ?? '';
  const stageName = (STATUS_TO_STAGE[status] ?? status) || '草稿';
  const keyMap: Record<string, string> = {
    草稿: 'draft',
    询价中: 'quoting',
    待比价: 'pending_compare',
    已定标: 'awarded',
    已转单: 'converted',
  };
  const key = keyMap[stageName] ?? 'draft';
  const order = ['draft', 'quoting', 'pending_compare', 'awarded', 'converted'];
  const labels: Record<string, string> = {
    draft: '草稿',
    quoting: '询价中',
    pending_compare: '待比价',
    awarded: '已定标',
    converted: '已转单',
  };
  const idx = order.indexOf(key);
  const mainStages: SubStage[] = order.map((k, i) => ({
    key: k,
    label: labels[k],
    status: i < idx ? 'done' : i === idx ? 'active' : 'pending',
  }));
  return {
    percent: Math.round(((idx + 1) / order.length) * 100),
    stageName,
    mainStages,
  };
}

export { LIST_LIFECYCLE_STAGE_FIELD };

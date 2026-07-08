/**
 * 装箱绑定列表生命周期：绑定记录无审核流，展示「已绑定」完成态。
 */

import type { LifecycleResult } from '../../../components/uni-lifecycle/types';

export function getPackingBindingLifecycle(
  record: Record<string, unknown> | null | undefined
): LifecycleResult {
  if (!record) {
    return { percent: 0, stageName: '-', mainStages: [] };
  }
  return {
    percent: 100,
    stageName: '已绑定',
    status: 'success',
    mainStages: [{ key: 'bound', label: '已绑定', status: 'done' }],
    nextStepSuggestions: [],
  };
}

const PACKING_BINDING_METHOD_KEYS = ['scan', 'manual'] as const;

const PACKING_BINDING_METHOD_I18N: Record<string, string> = {
  scan: 'app.kuaizhizao.packingBinding.bindingMethodScan',
  manual: 'app.kuaizhizao.packingBinding.bindingMethodManual',
};

export function buildPackingBindingMethodValueEnum(
  t: (key: string) => string,
): Record<string, { text: string; status?: 'Success' | 'Default' }> {
  const statusByKey: Record<string, 'Success' | 'Default'> = {
    scan: 'Success',
    manual: 'Default',
  };
  return Object.fromEntries(
    PACKING_BINDING_METHOD_KEYS.map((key) => [
      key,
      { text: t(PACKING_BINDING_METHOD_I18N[key]!), status: statusByKey[key] },
    ]),
  );
}

export function resolvePackingBindingListMethodParams(
  searchFormValues?: Record<string, unknown> | null,
): { binding_method?: string } {
  const raw = searchFormValues?.binding_method;
  if (raw == null || String(raw).trim() === '') return {};
  const binding_method = String(raw).trim();
  if (PACKING_BINDING_METHOD_KEYS.includes(binding_method as (typeof PACKING_BINDING_METHOD_KEYS)[number])) {
    return { binding_method };
  }
  return {};
}

const PACKING_BINDING_SOURCE_KEYS = ['finished_goods_receipt', 'sales_delivery'] as const;

const PACKING_BINDING_SOURCE_I18N: Record<string, string> = {
  finished_goods_receipt: 'app.kuaizhizao.packingBinding.sourceFinishedGoodsReceipt',
  sales_delivery: 'app.kuaizhizao.packingBinding.sourceSalesDelivery',
};

export function buildPackingBindingSourceValueEnum(
  t: (key: string) => string,
): Record<string, { text: string }> {
  return Object.fromEntries(
    PACKING_BINDING_SOURCE_KEYS.map((key) => [key, { text: t(PACKING_BINDING_SOURCE_I18N[key]!) }]),
  );
}

export function resolvePackingBindingListSourceParams(
  searchFormValues?: Record<string, unknown> | null,
): { source_type?: string } {
  const raw = searchFormValues?.source_type;
  if (raw == null || String(raw).trim() === '') return {};
  const source_type = String(raw).trim();
  if (PACKING_BINDING_SOURCE_KEYS.includes(source_type as (typeof PACKING_BINDING_SOURCE_KEYS)[number])) {
    return { source_type };
  }
  return {};
}

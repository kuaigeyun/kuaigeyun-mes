/**
 * 成本模块表单：工单/采购/委外等下拉选项（快财务依赖快智造接口）
 */

import { workOrderApi } from '../../../kuaizhizao/services/work-order';
import { outsourceWorkOrderApi } from '../../../kuaizhizao/services/production';
import { listPurchaseOrders, getPurchaseOrder } from '../../../kuaizhizao/services/purchase';

export type CostSelectOption = { label: string; value: number };

export function normalizeCostListRows(res: unknown): any[] {
  if (Array.isArray(res)) return res;
  if (res && typeof res === 'object') {
    const o = res as Record<string, unknown>;
    return (o.data as any[]) ?? (o.items as any[]) ?? [];
  }
  return [];
}

export async function loadWorkOrderSelectOptions(limit = 400): Promise<CostSelectOption[]> {
  const res = await workOrderApi.list({ limit, skip: 0 });
  const rows = normalizeCostListRows(res);
  const opts: CostSelectOption[] = [];
  for (const wo of rows) {
    const id = wo?.id;
    if (id == null || typeof id !== 'number') continue;
    const code = wo.code || wo.work_order_code || '-';
    opts.push({ value: id, label: `${code} (#${id})` });
  }
  return opts;
}

export async function loadOutsourceWorkOrderSelectOptions(limit = 400): Promise<CostSelectOption[]> {
  const res = await outsourceWorkOrderApi.list({ limit, skip: 0 });
  const rows = normalizeCostListRows(res);
  const opts: CostSelectOption[] = [];
  for (const row of rows) {
    const id = row?.id;
    if (id == null || typeof id !== 'number') continue;
    const code = row.code || row.outsource_work_order_code || '-';
    opts.push({ value: id, label: `${code} (#${id})` });
  }
  return opts;
}

export async function loadPurchaseOrderSelectOptions(limit = 200): Promise<CostSelectOption[]> {
  const res = await listPurchaseOrders({ limit, skip: 0 });
  const rows = res?.data ?? [];
  const opts: CostSelectOption[] = [];
  for (const po of rows) {
    const id = po?.id;
    if (id == null || typeof id !== 'number') continue;
    opts.push({ value: id, label: `${po.order_code || '-'} (#${id})` });
  }
  return opts;
}

/** 拉取最近若干张采购订单并展开明细行，用于「采购订单明细」下拉 */
export async function loadPurchaseOrderItemSelectOptions(maxOrders = 32): Promise<CostSelectOption[]> {
  const res = await listPurchaseOrders({ limit: maxOrders, skip: 0 });
  const orders = res?.data ?? [];
  const options: CostSelectOption[] = [];
  const chunk = 6;
  for (let i = 0; i < orders.length; i += chunk) {
    const slice = orders.slice(i, i + chunk);
    await Promise.all(
      slice.map(async (po: { id?: number; order_code?: string }) => {
        if (po?.id == null) return;
        try {
          const detail = await getPurchaseOrder(po.id);
          const code = detail.order_code || po.order_code || '-';
          for (const item of detail.items || []) {
            if (item?.id == null) continue;
            options.push({
              value: item.id,
              label: `${code} · ${item.material_code || ''} ${item.material_name || ''} (#${item.id})`,
            });
          }
        } catch {
          /* 单张失败跳过 */
        }
      })
    );
  }
  return options;
}

export function materialsToIdSelectOptions(materials: any[]): CostSelectOption[] {
  return (materials || []).map((m) => ({
    value: m.id,
    label: `${m.mainCode || m.code} - ${m.name} (#${m.id})`,
  }));
}

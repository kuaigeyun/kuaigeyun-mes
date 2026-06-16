/**
 * 设备管理模块生命周期展示（列表 UniLifecycle / 详情 UniLifecycleStepper）
 * 主数据与业务单无后端 lifecycle 字段时的前端兜底。
 */

import type { LifecycleResult } from '../../../components/uni-lifecycle/types';
import { applyLifecycleI18n, type LifecycleTranslateFn } from './lifecycleI18n';

const EF = 'app.kuaizhizao.equipmentFault.lifecycle';
const MP = 'app.kuaizhizao.maintenancePlan.lifecycle';
const MR = 'app.kuaizhizao.maintenanceReminder.lifecycle';
const SP = 'app.kuaizhizao.sparePart.lifecycle';

/** 设备台账：运行状态 + 是否启用 */
export function getEquipmentAssetLifecycle(record: Record<string, unknown> | null | undefined): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  const status = String(record.status ?? '').trim();
  const active = record.is_active === true;
  const scrapped = status === '报废';
  const stopped = status === '停用' || !active;
  const repair = status === '维修中';

  let percent = 60;
  let stageName = '运行';
  let st: LifecycleResult['status'] = 'normal';
  if (scrapped) {
    percent = 100;
    stageName = '报废';
    st = 'exception';
  } else if (stopped) {
    percent = 25;
    stageName = '停用';
    st = 'normal';
  } else if (repair) {
    percent = 45;
    stageName = '维修';
    st = 'exception';
  } else if (status === '正常') {
    percent = 85;
    stageName = '正常';
    st = 'success';
  }

  return {
    percent,
    stageName,
    status: st,
    mainStages: [
      { key: 'asset', label: '台账', status: 'done' },
      { key: 'run', label: scrapped ? '报废' : stopped ? '停用' : repair ? '维修中' : '运行', status: 'active' },
    ],
    subStages: [],
    nextStepSuggestions: repair ? ['跟进维修'] : stopped ? ['可启用设备'] : [],
  };
}

/** 设备故障单 */
export function getEquipmentFaultLifecycle(
  record: Record<string, unknown> | null | undefined,
  t?: LifecycleTranslateFn,
): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  const status = String(record.status ?? '').trim();
  const order = ['待处理', '处理中', '已修复', '已关闭'];
  const idx = Math.max(0, order.indexOf(status));
  const percent = Math.round(((idx + 1) / order.length) * 100);

  const result: LifecycleResult = {
    percent,
    stageName: status || '待处理',
    status: status === '已修复' || status === '已关闭' ? 'success' : 'normal',
    mainStages: order.map((label, i) => ({
      key: `s-${i}`,
      label,
      status: i < idx ? 'done' : i === idx ? 'active' : 'pending',
    })),
    subStages: [],
    nextStepSuggestions: status === '待处理' ? ['派工处理'] : status === '处理中' ? ['完成修复'] : [],
  };
  if (!t) return result;
  return applyLifecycleI18n(
    result,
    t,
    {
      's-0': `${EF}.pending`,
      's-1': `${EF}.processing`,
      's-2': `${EF}.repaired`,
      's-3': `${EF}.closed`,
    },
    {
      's-0': [`${EF}.suggestionDispatch`],
      's-1': [`${EF}.suggestionCompleteRepair`],
    },
  );
}

/** 维护保养计划 */
export function getMaintenancePlanLifecycle(
  record: Record<string, unknown> | null | undefined,
  t?: LifecycleTranslateFn,
): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  const status = String(record.status ?? '').trim();
  const order = ['待执行', '执行中', '已完成', '已取消'];
  const idx = order.indexOf(status);
  const safeIdx = idx >= 0 ? idx : 0;
  const percent = status === '已取消' ? 100 : Math.round(((safeIdx + 1) / 3) * 100);

  const result: LifecycleResult = {
    percent,
    stageName: status || '待执行',
    status: status === '已完成' ? 'success' : status === '已取消' ? 'exception' : 'normal',
    mainStages: [
      { key: 'plan', label: '计划', status: 'done' },
      { key: 'exec', label: '执行', status: status === '待执行' ? 'active' : 'done' },
      { key: 'done', label: '结案', status: status === '已完成' || status === '已取消' ? 'active' : 'pending' },
    ],
    subStages: [],
    nextStepSuggestions: status === '待执行' ? ['执行保养'] : [],
  };
  if (!t) return result;
  return applyLifecycleI18n(
    result,
    t,
    {
      plan: `${MP}.plan`,
      exec: `${MP}.execute`,
      done: `${MP}.close`,
    },
    {
      exec: [`${MP}.suggestionExecute`],
    },
  );
}

/** 工装台账（状态含领用中/校验中等） */
export function getToolAssetLifecycle(record: Record<string, unknown> | null | undefined): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  const status = String(record.status ?? '').trim();
  const active = record.is_active === true;
  const scrapped = status === '报废';
  const stopped = status === '停用' || !active;
  const busy = status === '领用中' || status === '维修中' || status === '校验中';

  let percent = 70;
  let stageName = status || '在库';
  let st: LifecycleResult['status'] = 'normal';
  if (scrapped) {
    percent = 100;
    stageName = '报废';
    st = 'exception';
  } else if (stopped) {
    percent = 25;
    stageName = '停用';
  } else if (busy) {
    percent = 55;
    st = 'exception';
  } else if (status === '正常') {
    percent = 90;
    st = 'success';
  }

  return {
    percent,
    stageName,
    status: st,
    mainStages: [
      { key: 'ledger', label: '台账', status: 'done' },
      { key: 'state', label: stageName, status: 'active' },
    ],
    subStages: [],
    nextStepSuggestions: status === '领用中' ? ['归还工装'] : [],
  };
}

/** 模具台账 */
export function getMoldAssetLifecycle(record: Record<string, unknown> | null | undefined): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  const status = String(record.status ?? '').trim();
  const active = record.is_active === true;
  const scrapped = status === '报废';
  const stopped = status === '停用' || !active;
  const busy = status === '使用中' || status === '维护中';

  let percent = 70;
  let stageName = status || '正常';
  let st: LifecycleResult['status'] = 'normal';
  if (scrapped) {
    percent = 100;
    stageName = '报废';
    st = 'exception';
  } else if (stopped) {
    percent = 25;
    stageName = '停用';
  } else if (busy) {
    percent = 55;
    st = busy && status === '维护中' ? 'exception' : 'normal';
  } else if (status === '正常') {
    percent = 88;
    st = 'success';
  }

  return {
    percent,
    stageName,
    status: st,
    mainStages: [
      { key: 'mold', label: '模具', status: 'done' },
      { key: 'state', label: stageName, status: 'active' },
    ],
    subStages: [],
    nextStepSuggestions: status === '维护中' ? ['完成维护'] : [],
  };
}

/** 工装/模具领用记录 */
export function getCheckoutUsageLifecycle(record: Record<string, unknown> | null | undefined): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  const status = String(record.status ?? '').trim();
  const inUse = status === '使用中' || status === '领用中';
  return {
    percent: inUse ? 50 : 100,
    stageName: status || '-',
    status: inUse ? 'normal' : 'success',
    mainStages: [
      { key: 'out', label: '领出', status: 'done' },
      { key: 'in', label: inUse ? '待归还' : '已归还', status: inUse ? 'active' : 'done' },
    ],
    subStages: [],
    nextStepSuggestions: inUse ? ['归还'] : [],
  };
}

/** 备件库存（低于安全库存视为预警） */
export function getSparePartInventoryLifecycle(
  record: Record<string, unknown> | null | undefined,
  t?: LifecycleTranslateFn,
): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  const qty = Number(record.stock_quantity ?? 0);
  const safe = Number(record.safety_stock ?? record.min_stock ?? 5);
  const low = qty < safe;
  const result: LifecycleResult = {
    percent: low ? 35 : 95,
    stageName: low ? '低库存' : '充足',
    status: low ? 'exception' : 'success',
    mainStages: [
      { key: 'inv', label: '库存', status: 'done' },
      { key: 'alert', label: low ? '预警' : '正常', status: 'active' },
    ],
    subStages: [],
    nextStepSuggestions: low ? ['补货/领用控制'] : [],
  };
  if (!t) return result;
  return applyLifecycleI18n(
    result,
    t,
    {
      inv: `${SP}.inventory`,
      alert: low ? `${SP}.alert` : `${SP}.normal`,
    },
    {
      alert: low ? [`${SP}.suggestionRestock`] : [],
    },
  );
}

/** 工装维保记录（结果） */
export function getToolMaintenanceLifecycle(record: Record<string, unknown> | null | undefined): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  const result = String(record.result ?? '').trim();
  const done = result === '完成';
  return {
    percent: done ? 100 : 50,
    stageName: result || '维保',
    status: done ? 'success' : 'normal',
    mainStages: [
      { key: 'do', label: '执行', status: 'done' },
      { key: 'res', label: done ? '完成' : result || '待跟进', status: 'active' },
    ],
    subStages: [],
    nextStepSuggestions: !done ? ['跟进维保'] : [],
  };
}

/** 校验记录（结果） */
export function getCalibrationResultLifecycle(record: Record<string, unknown> | null | undefined): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  const result = String(record.result ?? '').trim();
  const ok = result === '合格' || result === '准用';
  return {
    percent: ok ? 100 : 40,
    stageName: result || '待判定',
    status: ok ? 'success' : 'exception',
    mainStages: [
      { key: 'cal', label: '校验', status: 'done' },
      { key: 'res', label: result || '结果', status: 'active' },
    ],
    subStages: [],
    nextStepSuggestions: !ok ? ['复检或处置'] : [],
  };
}

/** 保养/校准到期提醒（due_type / reminder_type） */
export function getDueReminderLifecycle(record: Record<string, unknown> | null | undefined): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  const dueType = String(record.due_type ?? '').trim();
  const reminderType = String(record.reminder_type ?? '').trim();
  const overdue = dueType === 'overdue' || reminderType === 'overdue';
  const soon = dueType === 'due_soon' || reminderType === 'due_soon';
  return {
    percent: overdue ? 100 : soon ? 55 : 80,
    stageName: overdue ? '已过期' : soon ? '即将到期' : '正常',
    status: overdue ? 'exception' : soon ? 'normal' : 'success',
    mainStages: [
      { key: 'watch', label: '监控', status: 'done' },
      { key: 'alert', label: overdue ? '已过期' : soon ? '预警' : '受控', status: 'active' },
    ],
    subStages: [],
    nextStepSuggestions: overdue || soon ? ['安排保养/校准'] : [],
  };
}

/** 维护提醒：已读 / 已处理 */
export function getMaintenanceReminderLifecycle(
  record: Record<string, unknown> | null | undefined,
  t?: LifecycleTranslateFn,
): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  const read = record.is_read === true;
  const handled = record.is_handled === true;
  let percent = 30;
  if (handled) percent = 100;
  else if (read) percent = 65;
  const result: LifecycleResult = {
    percent,
    stageName: handled ? '已处理' : read ? '已读' : '待阅',
    status: handled ? 'success' : 'normal',
    mainStages: [
      { key: 'notify', label: '提醒', status: 'done' },
      { key: 'read', label: read ? '已读' : '未读', status: read ? 'done' : 'active' },
      { key: 'done', label: handled ? '已处理' : '待处理', status: handled ? 'active' : 'pending' },
    ],
    subStages: [],
    nextStepSuggestions: !handled ? ['标记处理'] : [],
  };
  if (!t) return result;
  return applyLifecycleI18n(
    result,
    t,
    {
      notify: `${MR}.notify`,
      read: read ? `${MR}.read` : `${MR}.unread`,
      done: handled ? `${MR}.handled` : `${MR}.pending`,
    },
    {
      read: !handled ? [`${MR}.suggestionMarkHandled`] : [],
      done: !handled ? [`${MR}.suggestionMarkHandled`] : [],
    },
  );
}

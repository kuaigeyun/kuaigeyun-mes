/**
 * 快财务列表：UniLifecycle 展示（应收/应付/发票/收付款单等）
 */
import type { LifecycleResult, SubStage } from '../../../components/uni-lifecycle/types';

function reviewSubStages(review: string): { reviewDone: boolean; reviewRejected: boolean; reviewPending: boolean } {
  const r = String(review ?? '');
  return {
    reviewRejected: r === '已驳回' || r === '驳回',
    reviewPending: r === '待审核',
    reviewDone: r === '已审核' || r === '通过',
  };
}

/** 应收单：审核 → 收款进度 */
export function getReceivableLifecycle(record: Record<string, unknown>): LifecycleResult {
  const { reviewRejected, reviewPending, reviewDone } = reviewSubStages(String(record.review_status ?? ''));
  const status = String(record.status ?? '');

  if (reviewRejected) {
    return {
      percent: 0,
      stageName: '已驳回',
      status: 'exception',
      subStages: [
        { key: 'rv', label: '审核', status: 'active' },
        { key: 'col', label: '收款', status: 'pending' },
      ],
    };
  }

  const subStages: SubStage[] = [
    {
      key: 'rv',
      label: '审核',
      status: reviewPending ? 'active' : 'done',
    },
    {
      key: 'col',
      label: '收款',
      status: 'pending',
    },
  ];

  if (reviewPending) {
    return { percent: 20, stageName: '待审核', status: 'normal', subStages };
  }

  if (!reviewDone) {
    return { percent: 35, stageName: String(record.review_status ?? '-'), status: 'normal', subStages };
  }

  subStages[0].status = 'done';
  if (status === '已结清') {
    subStages[1].status = 'done';
    return { percent: 100, stageName: '已结清', status: 'success', subStages };
  }
  if (status === '部分收款') {
    subStages[1].status = 'active';
    return { percent: 80, stageName: '部分收款', status: 'normal', subStages };
  }
  subStages[1].status = 'active';
  return { percent: 55, stageName: '未收款', status: 'normal', subStages };
}

/** 应付单：审核 → 付款进度 */
export function getPayableLifecycle(record: Record<string, unknown>): LifecycleResult {
  const { reviewRejected, reviewPending, reviewDone } = reviewSubStages(String(record.review_status ?? ''));
  const status = String(record.status ?? '');

  if (reviewRejected) {
    return {
      percent: 0,
      stageName: '已驳回',
      status: 'exception',
      subStages: [
        { key: 'rv', label: '审核', status: 'active' },
        { key: 'pay', label: '付款', status: 'pending' },
      ],
    };
  }

  const subStages: SubStage[] = [
    { key: 'rv', label: '审核', status: reviewPending ? 'active' : 'done' },
    { key: 'pay', label: '付款', status: 'pending' },
  ];

  if (reviewPending) {
    return { percent: 20, stageName: '待审核', status: 'normal', subStages };
  }
  if (!reviewDone) {
    return { percent: 35, stageName: String(record.review_status ?? '-'), status: 'normal', subStages };
  }

  subStages[0].status = 'done';
  if (status === '已结清') {
    subStages[1].status = 'done';
    return { percent: 100, stageName: '已结清', status: 'success', subStages };
  }
  if (status === '部分付款') {
    subStages[1].status = 'active';
    return { percent: 80, stageName: '部分付款', status: 'normal', subStages };
  }
  subStages[1].status = 'active';
  return { percent: 55, stageName: '未付款', status: 'normal', subStages };
}

/** 采购/销售发票（中文字段 status + review_status） */
export function getChineseInvoiceLifecycle(record: Record<string, unknown>): LifecycleResult {
  const stRaw = String(record.status ?? '').trim();
  if (stRaw === '已作废') {
    return {
      percent: 0,
      stageName: '已作废',
      status: 'exception',
      subStages: [
        { key: 'rv', label: '审核', status: 'done' },
        { key: 'inv', label: '发票', status: 'exception' },
      ],
    };
  }
  if (stRaw === '已红冲') {
    return {
      percent: 100,
      stageName: '已红冲',
      status: 'success',
      subStages: [
        { key: 'blue', label: '蓝字', status: 'done' },
        { key: 'red', label: '红字', status: 'active' },
      ],
    };
  }

  const { reviewRejected, reviewPending, reviewDone } = reviewSubStages(String(record.review_status ?? ''));
  const st = String(record.status ?? '');

  if (reviewRejected) {
    return {
      percent: 0,
      stageName: '已驳回',
      status: 'exception',
      subStages: [
        { key: 'rv', label: '审核', status: 'active' },
        { key: 'inv', label: '发票', status: 'pending' },
      ],
    };
  }

  const subStages: SubStage[] = [
    { key: 'rv', label: '审核', status: reviewPending ? 'active' : 'done' },
    { key: 'inv', label: '发票', status: 'pending' },
  ];

  if (reviewPending) {
    return { percent: 25, stageName: '待审核', status: 'normal', subStages };
  }
  if (!reviewDone) {
    return { percent: 40, stageName: String(record.review_status ?? '-'), status: 'normal', subStages };
  }

  subStages[0].status = 'done';
  const approved = st === '已审核' || st === '已开票';
  subStages[1].status = approved ? 'done' : 'active';
  if (approved) {
    return { percent: 100, stageName: st || '已审核', status: 'success', subStages };
  }
  return { percent: 70, stageName: st || '未审核', status: 'normal', subStages };
}

/** 统一发票列表（DRAFT / CONFIRMED / VERIFIED / CANCELLED） */
export function getUnifiedInvoiceLifecycle(record: Record<string, unknown>): LifecycleResult {
  const s = String(record.status ?? '');
  const map: Record<string, { percent: number; name: string; st?: LifecycleResult['status'] }> = {
    DRAFT: { percent: 15, name: '草稿' },
    CONFIRMED: { percent: 60, name: '已确认' },
    VERIFIED: { percent: 100, name: '已认证', st: 'success' },
    CANCELLED: { percent: 0, name: '已作废', st: 'exception' },
  };
  const m = map[s] || { percent: 40, name: s || '-' };
  return {
    percent: m.percent,
    stageName: m.name,
    status: m.st ?? 'normal',
  };
}

/** 收款单/付款单 Draft / Confirmed / Cancelled */
export function getFinanceVoucherLifecycle(record: Record<string, unknown>): LifecycleResult {
  const s = String(record.status ?? '');
  if (s === 'Cancelled') {
    return { percent: 0, stageName: '已作废', status: 'exception' };
  }
  if (s === 'Draft') {
    return { percent: 35, stageName: '草稿', status: 'normal' };
  }
  if (s === 'Confirmed') {
    return { percent: 100, stageName: '已确认', status: 'success' };
  }
  return { percent: 50, stageName: s || '-', status: 'normal' };
}

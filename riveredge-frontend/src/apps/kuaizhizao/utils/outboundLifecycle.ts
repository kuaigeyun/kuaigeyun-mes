/**
 * 出库管理生命周期：以后端 lifecycle 为唯一真源（各出库类型阶段不同）。
 * stageDefs 仅作类型对齐；展示文案与主轴顺序来自 record.lifecycle.main_stages。
 */

import { createLifecycleResolver } from './createLifecycleResolver';

export const getOutboundLifecycle = createLifecycleResolver({
  stageDefs: [
    { key: 'pending_picking', label: '待领料' },
    { key: 'pending_outbound', label: '待出库' },
    { key: 'draft', label: '草稿' },
    { key: 'confirmed', label: '已确认' },
    { key: 'completed', label: '已完成' },
    { key: 'cancelled', label: '已取消' },
  ],
  statusToKey: {
    草稿: 'draft',
    draft: 'draft',
    待领料: 'pending_picking',
    待出库: 'pending_outbound',
    待借出: 'pending_borrow',
    已确认: 'confirmed',
    confirmed: 'confirmed',
    已领料: 'completed',
    已出库: 'completed',
    已借出: 'borrowed',
    已完成: 'completed',
    completed: 'completed',
    已取消: 'cancelled',
    cancelled: 'cancelled',
  },
  exceptionKeys: ['cancelled'],
  exceptionStageKey: 'cancelled',
  nextStepSuggestionKeys: {},
  successKeys: ['completed', 'borrowed'],
});

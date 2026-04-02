/**
 * 发货通知生命周期：待发货→已通知→已出库
 */

import { createLifecycleResolver } from './createLifecycleResolver';

export const getShipmentNoticeLifecycle = createLifecycleResolver({
  stageDefs: [
    { key: 'pending', label: '待发货' },
    { key: 'notified', label: '已通知' },
    { key: 'shipped', label: '已出库' },
  ],
  statusToKey: {
    待发货: 'pending',
    已通知: 'notified',
    已出库: 'shipped',
  },
  nextStepSuggestions: {
    pending: ['通知仓库', '编辑通知明细'],
    notified: ['撤回通知（回到待发货）', '执行出库'],
    shipped: [],
  },
  successKeys: ['shipped'],
});

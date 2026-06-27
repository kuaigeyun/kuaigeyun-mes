/**
 * 收货通知生命周期：待收货→已通知→已入库
 */

import { createLifecycleResolver } from './createLifecycleResolver';

export const getReceiptNoticeLifecycle = createLifecycleResolver({
  stageDefs: [
    { key: 'pending_receive', label: '待收货' },
    { key: 'notified', label: '已通知' },
    { key: 'received', label: '已入库' },
  ],
  statusToKey: {
    待收货: 'pending_receive',
    已通知: 'notified',
    已入库: 'received',
  },
  nextStepSuggestions: {
    pending_receive: ['通知仓库'],
    notified: ['撤回通知（回到待收货）', '入库'],
    received: [],
  },
  successKeys: ['received'],
});

/**
 * 发货单/送货单生命周期：待发送→已发送→已签收
 */

import { createLifecycleResolver } from './createLifecycleResolver';

export const getDeliveryNoticeLifecycle = createLifecycleResolver({
  stageDefs: [
    { key: 'pending', label: '待发送' },
    { key: 'sent', label: '已发送' },
    { key: 'signed', label: '已签收' },
  ],
  statusToKey: {
    待发送: 'pending',
    已发送: 'sent',
    已签收: 'signed',
  },
  nextStepSuggestions: {
    pending: ['发送'],
    sent: ['签收'],
    signed: [],
  },
  successKeys: ['signed'],
});

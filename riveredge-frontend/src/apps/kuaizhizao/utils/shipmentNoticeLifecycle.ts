/**
 * 发货通知生命周期：待发货→已通知→已出库
 */

import { createLifecycleResolver } from './createLifecycleResolver';

const P = 'app.kuaizhizao.shipmentNotice';

export const getShipmentNoticeLifecycle = createLifecycleResolver({
  stageDefs: [
    { key: 'pending_ship', label: '待发货', labelKey: `${P}.statusPending` },
    { key: 'notified', label: '已通知', labelKey: `${P}.statusNotified` },
    { key: 'shipped', label: '已出库', labelKey: `${P}.statusShipped` },
  ],
  statusToKey: {
    待发货: 'pending_ship',
    已通知: 'notified',
    已出库: 'shipped',
  },
  nextStepSuggestions: {
    pending_ship: ['通知仓库', '编辑通知明细'],
    notified: ['撤回通知（回到待发货）', '执行出库'],
    shipped: [],
  },
  nextStepSuggestionKeys: {
    pending_ship: [`${P}.lifecycleNextNotifyWarehouse`, `${P}.lifecycleNextEditItems`],
    notified: [`${P}.lifecycleNextWithdrawNotify`, `${P}.lifecycleNextExecuteOutbound`],
    shipped: [],
  },
  successKeys: ['shipped'],
});

import { createLifecycleResolver } from './createLifecycleResolver';

const P = 'app.kuaizhizao.salesReturn';

export const getSalesReturnLifecycle = createLifecycleResolver({
  stageDefs: [
    { key: 'pending_return_goods', label: '待退货', labelKey: `${P}.statusPending` },
    { key: 'completed', label: '已退货', labelKey: `${P}.statusReturned` },
  ],
  statusToKey: {
    待退货: 'pending_return_goods',
    已退货: 'completed',
    草稿: 'pending_return_goods',
  },
  nextStepSuggestions: {
    pending_return_goods: ['确认退货'],
    completed: ['撤回确认（回到待退货）'],
  },
  nextStepSuggestionKeys: {
    pending_return_goods: [`${P}.lifecycleNextConfirmReturn`],
    completed: [`${P}.lifecycleNextWithdrawConfirm`],
  },
  successKeys: ['completed'],
});

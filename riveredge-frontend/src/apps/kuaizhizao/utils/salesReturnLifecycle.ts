import { createLifecycleResolver } from './createLifecycleResolver';

const P = 'app.kuaizhizao.salesReturn';

export const getSalesReturnLifecycle = createLifecycleResolver({
  stageDefs: [
    { key: 'pending', label: '待退货', labelKey: `${P}.statusPending` },
    { key: 'completed', label: '已退货', labelKey: `${P}.statusReturned` },
  ],
  statusToKey: {
    待退货: 'pending',
    已退货: 'completed',
    草稿: 'pending',
  },
  nextStepSuggestions: {
    pending: ['确认退货'],
    completed: ['撤回确认（回到待退货）'],
  },
  nextStepSuggestionKeys: {
    pending: [`${P}.lifecycleNextConfirmReturn`],
    completed: [`${P}.lifecycleNextWithdrawConfirm`],
  },
  successKeys: ['completed'],
});

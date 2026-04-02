import { createLifecycleResolver } from './createLifecycleResolver';

export const getSalesReturnLifecycle = createLifecycleResolver({
  stageDefs: [
    { key: 'pending', label: '待退货' },
    { key: 'completed', label: '已退货' },
  ],
  statusToKey: {
    待退货: 'pending',
    已退货: 'completed',
  },
  nextStepSuggestions: {
    pending: ['确认退货'],
    completed: ['撤回确认（回到待退货）'],
  },
  successKeys: ['completed'],
});

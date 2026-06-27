/**
 * 需求 lifecycle（模式 A）：业务主轴仅「已下推计算」；审核态由 record.audit + 列表「审核状态」列展示。
 */

import { createLifecycleResolver } from './createLifecycleResolver';

const P = 'app.kuaizhizao.demandManagement';

export const getDemandLifecycle = createLifecycleResolver({
  stageDefs: [
    { key: 'pushed', label: '已下推计算', labelKey: `${P}.lifecyclePushed` },
  ],
  statusToKey: {
    已下推计算: 'pushed',
    pushed: 'pushed',
  },
  nextStepSuggestions: {
    pushed: [],
  },
  successKeys: ['pushed'],
});

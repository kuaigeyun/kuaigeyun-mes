/**
 * 线边仓库存行状态：可用→已预留→已消耗
 */

import { createLifecycleResolver } from './createLifecycleResolver';

export const getLineSideInventoryLifecycle = createLifecycleResolver({
  stageDefs: [
    { key: 'available', label: '可用' },
    { key: 'reserved', label: '已预留' },
    { key: 'consumed', label: '已消耗' },
  ],
  statusToKey: {
    available: 'available',
    reserved: 'reserved',
    consumed: 'consumed',
  },
  nextStepSuggestions: {
    available: [],
    reserved: [],
    consumed: [],
  },
  successKeys: ['consumed'],
});

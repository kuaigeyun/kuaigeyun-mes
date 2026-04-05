/**
 * 分析中心 · 单据耗时：是否已有关键节点数据
 */
import type { LifecycleResult, SubStage } from '../../../components/uni-lifecycle/types';

export function getDocumentTimingLifecycle(record: { nodes?: unknown[] }): LifecycleResult {
  const hasNodes = Array.isArray(record.nodes) && record.nodes.length > 0;
  const subStages: SubStage[] = [
    { key: 'collect', label: '节点采集', status: 'pending' },
    { key: 'sum', label: '耗时汇总', status: 'pending' },
  ];
  if (hasNodes) {
    subStages[0].status = 'done';
    subStages[1].status = 'done';
    return { percent: 100, stageName: '已汇总', status: 'success', subStages };
  }
  subStages[0].status = 'active';
  return { percent: 50, stageName: '待汇总', status: 'normal', subStages };
}

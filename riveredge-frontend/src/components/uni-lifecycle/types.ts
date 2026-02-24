/**
 * 通用生命周期类型（全项目复用）
 * 各业务 getXxxLifecycle(record) 返回此结构，供 UniLifecycle 展示。
 */

/** 子阶段状态：已完成 / 进行中 / 待进行 */
export type SubStageStatus = 'done' | 'active' | 'pending';

/** 全链路子阶段（如执行中：BOM检查→需求计算→…→销售出库） */
export interface SubStage {
  key: string;
  label: string;
  status: SubStageStatus;
}

/** 生命周期结果，与业务解耦 */
export interface LifecycleResult {
  /** 主进度 0～100 */
  percent: number;
  /** 当前主阶段名 */
  stageName: string;
  /** 异常态时使用 */
  status?: 'success' | 'exception' | 'normal' | 'active';
  /** 当前主阶段内整体子进度 0～100（可选） */
  subPercent?: number;
  /** 当前子阶段名或含义（如「工单执行」「开票」） */
  subLabel?: string;
  /** 主生命周期全部节点（用于详情「节点+线」展示），可选 */
  mainStages?: SubStage[];
  /** 全链路子阶段列表（如执行中 7 步），可选 */
  subStages?: SubStage[];
  /** 当前阶段的下一步操作建议，可选 */
  nextStepSuggestions?: string[];
}

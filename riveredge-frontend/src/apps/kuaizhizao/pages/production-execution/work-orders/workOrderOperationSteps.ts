/**
 * 工单工序步骤轴工具。
 *
 * 列表「工序」列：展示全部节点 + 限宽拖动（见 WorkOrderOperationStepsStrip）。
 * 运营看板仍可用固定槽位窗口算法。
 */

export type WorkOrderOperationStepStatus = 'done' | 'active' | 'pending';

export interface WorkOrderOperationStep {
  name: string;
  sequence?: number;
  status: WorkOrderOperationStepStatus;
  progress: number;
}

export type WorkOrderOperationStepSlot = {
  key: string;
  step?: WorkOrderOperationStep;
  placeholder: boolean;
};

const DEFAULT_SLOT_COUNT = 5;

/** 全部工序节点（无占位、不截断），供列表步骤轴使用 */
export function buildAllWorkOrderOperationStepSlots(
  steps: WorkOrderOperationStep[],
): WorkOrderOperationStepSlot[] {
  if (!steps?.length) return [];
  return steps.map((step, idx) => ({
    key: `s-${idx}-${step.name}`,
    step,
    placeholder: false,
  }));
}

/**
 * 固定槽位窗口：不足补占位，超过则围绕 active 工序滑动窗口。
 * 供运营看板等仍需「固定 N 格」的场景；列表列请用 buildAllWorkOrderOperationStepSlots。
 */
export function buildWorkOrderOperationStepSlots(
  steps: WorkOrderOperationStep[],
  slotCount: number = DEFAULT_SLOT_COUNT,
): WorkOrderOperationStepSlot[] {
  if (!steps?.length) return [];

  const slots: WorkOrderOperationStepSlot[] = [];

  if (steps.length >= slotCount) {
    const activeIdx = steps.findIndex((s) => s.status === 'active');
    const focusIdx = activeIdx === -1 ? steps.length - 1 : activeIdx;
    let start = Math.max(0, focusIdx - 3);
    let end = Math.min(steps.length, focusIdx + 2);
    if (end - start < slotCount) {
      if (start === 0) end = Math.min(steps.length, slotCount);
      else if (end === steps.length) start = Math.max(0, steps.length - slotCount);
    }
    steps.slice(start, end).forEach((step, idx) => {
      slots.push({ key: `s-${start + idx}-${step.name}`, step, placeholder: false });
    });
    return slots;
  }

  steps.forEach((step, idx) => {
    slots.push({ key: `s-${idx}-${step.name}`, step, placeholder: false });
  });
  for (let i = steps.length; i < slotCount; i += 1) {
    slots.push({ key: `ph-${i}`, placeholder: true });
  }
  return slots;
}

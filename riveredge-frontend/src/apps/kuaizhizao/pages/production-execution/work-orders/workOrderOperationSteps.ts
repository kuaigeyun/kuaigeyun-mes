/**
 * 工单工序步骤轴：与运营看板 BusinessBoardPage 固定 5 槽位窗口算法一致。
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

/** 固定槽位窗口：不足补占位，超过则围绕 active 工序滑动窗口。 */
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

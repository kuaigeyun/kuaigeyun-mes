/**
 * 可视排产 AI 助手 API
 */

import { apiRequest } from '../../../services/api';

export interface SchedulingAiExplainResult {
  answer: string;
}

export interface SchedulingAiPriorityResult {
  suggestedPoolOrder: number[];
  rationale: string;
  confidenceNotes?: string | null;
}

export interface SchedulingAiWorkOrderAdjustment {
  workOrderId: number;
  plannedStartDate: string;
  plannedEndDate: string;
}

export interface SchedulingAiOperationAdjustment {
  operationId: number;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  assignedStationId?: number | null;
}

export interface SchedulingAiValidationPreview {
  valid: boolean;
  conflictCount: number;
}

export interface SchedulingAiProposal {
  summary?: string | null;
  confidenceNotes?: string | null;
  warnings: string[];
  workOrderAdjustments: SchedulingAiWorkOrderAdjustment[];
  operationAdjustments: SchedulingAiOperationAdjustment[];
  poolReorder: number[];
  validationPreview?: SchedulingAiValidationPreview | null;
}

export interface SchedulingAiContextParams {
  workOrderIds?: number[];
  planDate?: string;
  selectedWorkOrderIds?: number[];
}

function buildContextBody(params: SchedulingAiContextParams) {
  return {
    workOrderIds: params.workOrderIds?.length ? params.workOrderIds : undefined,
    planDate: params.planDate || undefined,
    selectedWorkOrderIds: params.selectedWorkOrderIds?.length ? params.selectedWorkOrderIds : undefined,
  };
}

export const schedulingAiApi = {
  explain: async (text: string, context: SchedulingAiContextParams): Promise<SchedulingAiExplainResult> => {
    return apiRequest<SchedulingAiExplainResult>('/apps/kuaizhizao/scheduling/ai-assist/explain', {
      method: 'POST',
      body: JSON.stringify({ text, ...buildContextBody(context) }),
    });
  },

  suggestPriority: async (
    context: SchedulingAiContextParams,
    text?: string,
  ): Promise<SchedulingAiPriorityResult> => {
    return apiRequest<SchedulingAiPriorityResult>('/apps/kuaizhizao/scheduling/ai-assist/suggest-priority', {
      method: 'POST',
      body: JSON.stringify({ text: text || undefined, ...buildContextBody(context) }),
    });
  },

  suggestAdjustments: async (
    text: string,
    context: SchedulingAiContextParams,
    proposalContext?: SchedulingAiProposal | null,
  ): Promise<{ proposal: SchedulingAiProposal }> => {
    return apiRequest<{ proposal: SchedulingAiProposal }>(
      '/apps/kuaizhizao/scheduling/ai-assist/suggest-adjustments',
      {
        method: 'POST',
        body: JSON.stringify({
          text,
          context: proposalContext ?? undefined,
          ...buildContextBody(context),
        }),
      },
    );
  },

  parseDispatchImage: async (
    file: File,
    context: SchedulingAiContextParams,
  ): Promise<{ proposal: SchedulingAiProposal }> => {
    const formData = new FormData();
    formData.append('file', file);
    if (context.workOrderIds?.length) {
      formData.append('work_order_ids', context.workOrderIds.join(','));
    }
    if (context.planDate) formData.append('plan_date', context.planDate);
    if (context.selectedWorkOrderIds?.length) {
      formData.append('selected_work_order_ids', context.selectedWorkOrderIds.join(','));
    }
    return apiRequest<{ proposal: SchedulingAiProposal }>(
      '/apps/kuaizhizao/scheduling/ai-assist/parse-dispatch-image',
      { method: 'POST', body: formData },
    );
  },
};

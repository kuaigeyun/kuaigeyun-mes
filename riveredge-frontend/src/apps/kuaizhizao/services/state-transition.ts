/**
 * 状态流转服务
 *
 * 提供状态流转相关的API接口，包括执行状态流转、获取状态流转历史、获取可用状态流转选项等。
 *
 * @author Luigi Lu
 * @date 2025-01-15
 */

import { apiRequest } from '../../../services/api';

/**
 * 状态流转请求
 */
export interface StateTransitionRequest {
  to_state: string;
  transition_reason?: string;
  transition_comment?: string;
}

/**
 * 状态流转响应
 */
export interface StateTransitionResponse {
  success: boolean;
  transition_log_id: number;
  from_state: string;
  to_state: string;
  transition_time?: string;
}

/**
 * 状态流转历史记录
 */
export interface StateTransitionLog {
  id: number;
  uuid: string;
  from_state: string;
  to_state: string;
  transition_reason?: string;
  transition_comment?: string;
  operator_id: number;
  operator_name: string;
  transition_time?: string;
  related_entity_type?: string;
  related_entity_id?: number;
}

/**
 * 可用状态流转选项
 */
export interface AvailableTransition {
  to_state: string;
  description: string;
  required_permission?: string;
  required_role?: string;
}

/**
 * 状态流转API服务
 */
export const stateTransitionApi = {
  /**
   * 执行状态流转
   *
   * @param entityType 实体类型（如 'work_order', 'demand'）
   * @param entityId 实体ID
   * @param data 状态流转请求数据
   * @returns 状态流转响应
   */
  transition: async (
    entityType: string,
    entityId: number,
    data: StateTransitionRequest
  ): Promise<StateTransitionResponse> => {
    return apiRequest(
      `/apps/kuaizhizao/state-transitions/${entityType}/${entityId}`,
      {
        method: 'POST',
        data,
      }
    );
  },

  /**
   * 获取状态流转历史
   *
   * @param entityType 实体类型
   * @param entityId 实体ID
   * @returns 状态流转历史列表
   */
  getHistory: async (
    entityType: string,
    entityId: number
  ): Promise<StateTransitionLog[]> => {
    return apiRequest(
      `/apps/kuaizhizao/state-transitions/history/${entityType}/${entityId}`,
      {
        method: 'GET',
      }
    );
  },

  /**
   * 获取可用状态流转选项
   *
   * @param entityType 实体类型
   * @param currentState 当前状态
   * @returns 可用状态流转选项列表
   */
  getAvailableTransitions: async (
    entityType: string,
    currentState: string
  ): Promise<AvailableTransition[]> => {
    return apiRequest(
      `/apps/kuaizhizao/state-transitions/available/${entityType}`,
      {
        method: 'GET',
        params: { current_state: currentState },
      }
    );
  },
};

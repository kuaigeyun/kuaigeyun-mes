/**
 * KU-AI 动作 API（主仓薄客户端；完整包在 kuaigeyun-pro compose 后）。
 */
import { apiRequest } from './api';

export async function executeAiAction(confirmToken: string): Promise<Record<string, unknown>> {
  return apiRequest('/apps/kuaiai/actions/execute', {
    method: 'POST',
    body: JSON.stringify({ confirm_token: confirmToken }),
  });
}

/**
 * 轻财务总账 API（销售订单等宿主页只读引用；后端 /apps/kuaicaiwu）
 */
import { apiRequest } from '../../../../services/api';

const BASE = '/apps/kuaicaiwu/gl';

export const glService = {
  getSettings: () =>
    apiRequest<Record<string, unknown>>(`${BASE}/settings`, { method: 'GET' }),
};

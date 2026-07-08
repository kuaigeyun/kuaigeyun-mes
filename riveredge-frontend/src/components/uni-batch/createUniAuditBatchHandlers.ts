/**
 * 与行级 UniWorkflowActions 共用 `/core/uni-audit` 入口，批量逐条调用。
 */

import { apiRequest } from '../../services/api';
import type { AuditBatchAction, AuditBatchHandlers } from './auditBatchMenu';

const DEFAULT_ACTIONS: AuditBatchAction[] = ['submit', 'withdraw', 'approve', 'revoke'];

export function createUniAuditBatchHandlers(
  entityType: string,
  actions: AuditBatchAction[] = DEFAULT_ACTIONS,
): AuditBatchHandlers {
  const et = entityType.trim();
  if (!et) {
    throw new Error('createUniAuditBatchHandlers requires entityType');
  }
  const handlers: AuditBatchHandlers = {};
  for (const action of actions) {
    handlers[action] = (id: number) =>
      apiRequest(`/core/uni-audit/${et}/${id}/${action}`, { method: 'POST' });
  }
  return handlers;
}

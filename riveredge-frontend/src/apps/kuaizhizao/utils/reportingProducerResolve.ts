import { searchUserDisplay } from '../../../services/user';
import type { User } from '../../../services/user';

export type ProxyWorkerLike = Pick<User, 'id' | 'full_name' | 'username'> | null;

const DEFAULT_WORKER_UUID_FIELD = 'proxy_worker_uuid';
const DEFAULT_WORKER_ID_FIELD = 'proxy_worker_id';
const DEFAULT_WORKER_NAME_FIELD = 'proxy_worker_name';

/** 代报工：优先表单 hidden id / uuid，再回退 ref 缓存 */
export async function resolveProxyWorkerFromForm(
  values: Record<string, unknown>,
  fallback: ProxyWorkerLike,
  options?: {
    workerUuidField?: string;
    workerIdField?: string;
    workerNameField?: string;
  },
): Promise<ProxyWorkerLike> {
  const workerIdField = options?.workerIdField ?? DEFAULT_WORKER_ID_FIELD;
  const workerNameField = options?.workerNameField ?? DEFAULT_WORKER_NAME_FIELD;
  const workerUuidField = options?.workerUuidField ?? DEFAULT_WORKER_UUID_FIELD;

  const rawId = Number(values[workerIdField]);
  if (Number.isFinite(rawId) && rawId > 0) {
    const name = String(values[workerNameField] || fallback?.full_name || fallback?.username || '').trim();
    return {
      id: rawId,
      full_name: name,
      username: fallback?.username || '',
    };
  }

  const uuidRaw = values[workerUuidField];
  const uuid = typeof uuidRaw === 'string' ? uuidRaw.trim() : '';
  if (uuid) {
    try {
      const res = await searchUserDisplay({ user_uuids: [uuid] });
      const u = res.items?.[0];
      if (u?.id) {
        return {
          id: u.id,
          full_name: u.full_name || u.username || '',
          username: u.username,
        };
      }
    } catch {
      /* 解析失败时走 fallback */
    }
  }

  if (fallback?.id) return fallback;
  return null;
}

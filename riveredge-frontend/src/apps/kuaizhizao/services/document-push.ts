/**
 * 通用外推（外部系统），与系统内 document-push-pull 无关。
 */
import { apiRequest } from '../../../services/api';

export interface DocumentPushProfile {
  source_type: string;
  target_profile: string;
}

export interface DocumentPushPayload {
  source_type: string;
  source_id: number;
  /** 单一目标；传 "*" 按业务配置 document_push_targets 多目标 */
  target_profile?: string;
  /** 多目标列表（优先）；一单可同时推金蝶+OA */
  target_profiles?: string[];
  connection_code?: string;
  save_api_uuid?: string;
  dry_run?: boolean;
}

export interface DocumentPushResult {
  success?: boolean;
  skipped?: boolean;
  dry_run?: boolean;
  multi?: boolean;
  message?: string;
  bill_no?: string;
  bill_id?: number;
  form_id?: string;
  target_profile?: string;
  target_profiles?: string[];
  results?: DocumentPushResult[];
  model?: Record<string, unknown>;
  body?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * profiles 为租户级静态注册表，短 TTL + 并发合并，避免 Hub 打开期间父页重渲染打爆接口。
 */
const PROFILES_TTL_MS = 60_000;
let _profilesInflight: Promise<DocumentPushProfile[]> | null = null;
let _profilesCache: { at: number; data: DocumentPushProfile[] } | null = null;

export async function listDocumentPushProfiles(): Promise<DocumentPushProfile[]> {
  if (_profilesCache && Date.now() - _profilesCache.at < PROFILES_TTL_MS) {
    return _profilesCache.data;
  }
  if (_profilesInflight) return _profilesInflight;
  _profilesInflight = apiRequest<DocumentPushProfile[]>(
    '/apps/kuaizhizao/document-push/profiles',
  )
    .then((data) => {
      _profilesCache = { at: Date.now(), data };
      return data;
    })
    .finally(() => {
      _profilesInflight = null;
    });
  return _profilesInflight;
}

export async function pushDocumentExternal(
  payload: DocumentPushPayload,
): Promise<DocumentPushResult> {
  return apiRequest<DocumentPushResult>('/apps/kuaizhizao/document-push', {
    method: 'POST',
    data: payload,
    timeoutMs: 120_000,
  });
}

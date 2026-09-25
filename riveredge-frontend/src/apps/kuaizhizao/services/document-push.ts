/**
 * 通用外推（外部系统），与系统内 document-push-pull 无关。
 */
import { apiRequest } from '../../../services/api';

export interface DocumentPushProfile {
  source_type: string;
  target_profile: string;
}

export interface DocumentPushTargetPayload {
  connection_code?: string;
  save_api_uuid?: string;
  target_profile: string;
}

export interface DocumentPushPayload {
  source_type: string;
  source_id: number;
  /** 多连接器目标（每条独立连接器与 Save 接口） */
  targets?: DocumentPushTargetPayload[];
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
 * 与后端 SUPPORTED_PROFILES 的 target_profile 对齐。
 * 禁止把 connector 目录（WMS/PLM/CRM 等）当成可推目标展示。
 */
export const DOCUMENT_PUSH_KNOWN_PROFILES = [
  'kingdee_prd_mo',
  'oa_http_webhook',
  'feishu_im_notify',
  'kingdee_prd_morpt',
  'kingdee_sal_saleorder',
  'kingdee_pur_purchaseorder',
  'kingdee_stk_miscellaneous',
] as const;

const KNOWN_PROFILE_SET = new Set<string>(DOCUMENT_PUSH_KNOWN_PROFILES);

export const DOCUMENT_PUSH_PROFILE_CATEGORY: Record<
  (typeof DOCUMENT_PUSH_KNOWN_PROFILES)[number],
  string
> = {
  kingdee_prd_mo: 'erp',
  oa_http_webhook: 'oa',
  feishu_im_notify: 'collaboration',
  kingdee_prd_morpt: 'erp',
  kingdee_sal_saleorder: 'erp',
  kingdee_pur_purchaseorder: 'erp',
  kingdee_stk_miscellaneous: 'erp',
};

export function isKnownDocumentPushProfile(profile: string): boolean {
  return KNOWN_PROFILE_SET.has(String(profile || '').trim());
}

/** 已注册 profile 所落品类。未知 profile 不会进入结果。 */
export function categoriesWithRegisteredPush(profiles: string[] | null | undefined): Set<string> {
  const out = new Set<string>();
  for (const raw of profiles || []) {
    const profile = String(raw || '').trim();
    if (!isKnownDocumentPushProfile(profile)) continue;
    const category =
      DOCUMENT_PUSH_PROFILE_CATEGORY[profile as keyof typeof DOCUMENT_PUSH_PROFILE_CATEGORY];
    if (category) out.add(category);
  }
  return out;
}

/** 取某 source 在 profiles 接口中的已知可推目标（已过滤目录噪音）。 */
export function filterProfilesForSource(
  rows: DocumentPushProfile[] | null | undefined,
  sourceType: string,
): string[] {
  const st = String(sourceType || '').trim();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows || []) {
    if (String(row.source_type || '').trim() !== st) continue;
    const p = String(row.target_profile || '').trim();
    if (!p || !isKnownDocumentPushProfile(p) || seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
}

/**
 * 默认勾选：preferred ∩ 接口该 source 可用；preferred 为空则取接口全部。
 */
export function resolveDefaultTargetProfiles(
  available: string[],
  preferred: string[] | null | undefined,
): string[] {
  if (!available.length) return [];
  const prefs = (preferred || []).map((p) => String(p || '').trim()).filter(Boolean);
  if (!prefs.length) return [...available];
  const allowed = new Set(available);
  const hit = prefs.filter((p) => allowed.has(p));
  return hit.length ? hit : [...available];
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

import { apiRequest } from './api';
import { getInstalledApplicationList } from './application';

export type ClientProduct = {
  client_key: string;
  display_name: string;
  app_code: string | null;
  client_kind: string;
  platform_target: string;
  supports_ota: boolean;
  login_tile_slot: string;
  sort_order: number;
};

export type ClientProductConfig = {
  client_key: string;
  display_name: string;
  platform_target: string;
  push_configurable: boolean;
  push_enabled: boolean;
  jpush_app_key: string;
  jpush_master_secret_configured: boolean;
  effective_push_ready: boolean;
  env_fallback_app_key: boolean;
  env_fallback_master_secret: boolean;
};

export type ClientProductConfigUpdateInput = {
  push_enabled?: boolean;
  jpush_app_key?: string;
  jpush_master_secret?: string;
};

export type ClientPushTestInput = {
  tenant_id: number;
  user_id: number;
};

export type ClientPushTestResult = {
  alias: string;
  success: boolean;
  http_status: number;
  jpush_message: string;
  hint?: string | null;
};

export type ClientReleasePackage = {
  url: string;
  sha256?: string | null;
  size_bytes?: number | null;
  filename?: string;
};

export type ClientRelease = {
  id: number;
  uuid: string;
  client_key: string;
  platform: string;
  app_version: string;
  version_code: number;
  runtime_version: string | null;
  update_type: string;
  requires_native: boolean;
  force_update: boolean;
  min_version_code: number;
  release_notes: string;
  bundle_id: string | null;
  is_active: boolean;
  rollout_percent: number;
  artifact_ext?: string | null;
  published_at: string | null;
  created_by: string | null;
  package?: ClientReleasePackage | null;
  apk?: ClientReleasePackage | null;
  ota?: { updates_url: string; relative_path?: string } | null;
};

export type LoginClientDownload = {
  client_key: string;
  display_name: string;
  app_version: string;
  url: string;
  sha256?: string | null;
  size_bytes?: number | null;
  release_notes?: string;
};

export type LoginClientDownloads = {
  windows?: LoginClientDownload | null;
  android_pda?: LoginClientDownload | null;
};

export type ClientReleaseCreateInput = {
  client_key: string;
  platform: string;
  app_version: string;
  version_code?: number;
  runtime_version?: string | null;
  update_type?: 'package' | 'ota' | 'both';
  requires_native?: boolean;
  force_update?: boolean;
  min_version_code?: number;
  release_notes?: string;
  bundle_id?: string | null;
  ota_relative_path?: string | null;
  rollout_percent?: number;
  activate?: boolean;
};

const ADMIN_BASE = '/infra/client-releases';

export async function listClientProducts(appCode?: string): Promise<ClientProduct[]> {
  return apiRequest<ClientProduct[]>(`${ADMIN_BASE}/products`, {
    params: appCode ? { app_code: appCode } : undefined,
  });
}

export async function getClientProductConfig(clientKey: string): Promise<ClientProductConfig> {
  return apiRequest<ClientProductConfig>(`${ADMIN_BASE}/products/${encodeURIComponent(clientKey)}/config`);
}

export async function listClientProductConfigs(platform?: string): Promise<ClientProductConfig[]> {
  return apiRequest<ClientProductConfig[]>(`${ADMIN_BASE}/products/configs`, {
    params: platform ? { platform } : undefined,
  });
}

export async function updateClientProductConfig(
  clientKey: string,
  input: ClientProductConfigUpdateInput,
): Promise<ClientProductConfig> {
  return apiRequest<ClientProductConfig>(`${ADMIN_BASE}/products/${encodeURIComponent(clientKey)}/config`, {
    method: 'PUT',
    data: input,
  });
}

export async function sendClientPushTest(
  clientKey: string,
  input: ClientPushTestInput,
): Promise<ClientPushTestResult> {
  return apiRequest<ClientPushTestResult>(
    `${ADMIN_BASE}/products/${encodeURIComponent(clientKey)}/push-test`,
    {
      method: 'POST',
      data: input,
    },
  );
}

export type PushTestUserListParams = {
  tenant_id: number;
  keyword?: string;
  page?: number;
  page_size?: number;
};

export type PushTestUserOption = {
  id: number;
  uuid: string;
  username: string;
  full_name?: string | null;
  label: string;
};

export type PushTestUserListResponse = {
  items: PushTestUserOption[];
  total: number;
  page: number;
  page_size: number;
};

/** 平台超管：推送测试选人（不依赖租户 RBAC） */
export async function listPushTestUsers(
  clientKey: string,
  params: PushTestUserListParams,
): Promise<PushTestUserListResponse> {
  return apiRequest<PushTestUserListResponse>(
    `${ADMIN_BASE}/products/${encodeURIComponent(clientKey)}/push-test-users`,
    { params },
  );
}

export async function listClientReleases(params?: {
  client_key?: string;
  platform?: string;
}): Promise<ClientRelease[]> {
  return apiRequest<ClientRelease[]>(ADMIN_BASE, { params });
}

export async function activateClientRelease(releaseId: number): Promise<ClientRelease> {
  return apiRequest<ClientRelease>(`${ADMIN_BASE}/${releaseId}/activate`, { method: 'POST' });
}

export async function deleteClientRelease(releaseId: number): Promise<void> {
  await apiRequest<{ success: boolean }>(`${ADMIN_BASE}/${releaseId}`, { method: 'DELETE' });
}

export type ClientPackageInspectResult = {
  platform: string;
  app_version: string;
  version_code: number;
  package_name?: string | null;
  runtime_version?: string | null;
};

export async function inspectClientPackage(
  platform: string,
  file: File | Blob,
  filename?: string,
): Promise<ClientPackageInspectResult> {
  const formData = new FormData();
  const payload = file instanceof File ? file : new File([file], filename ?? 'package.bin');
  formData.append('file', payload);
  return apiRequest<ClientPackageInspectResult>(`${ADMIN_BASE}/inspect-package`, {
    method: 'POST',
    params: { platform },
    body: formData,
    headers: {},
  });
}

export async function createClientRelease(input: ClientReleaseCreateInput): Promise<ClientRelease> {
  return apiRequest<ClientRelease>(ADMIN_BASE, {
    method: 'POST',
    data: input,
  });
}

export async function uploadClientReleasePackage(
  releaseId: number,
  file: File | Blob,
  filename?: string,
): Promise<ClientRelease> {
  const formData = new FormData();
  const payload = file instanceof File ? file : new File([file], filename ?? 'package.bin');
  formData.append('file', payload);
  return apiRequest<ClientRelease>(`${ADMIN_BASE}/upload-package`, {
    method: 'POST',
    params: { release_id: releaseId },
    body: formData,
    headers: {},
  });
}

export async function publishClientReleasePackage(
  input: Omit<ClientReleaseCreateInput, 'activate'>,
  file: File,
  options?: { activate?: boolean },
): Promise<ClientRelease> {
  const release = await createClientRelease({ ...input, activate: false, update_type: input.update_type ?? 'package' });
  const uploaded = await uploadClientReleasePackage(release.id, file, file.name);
  if (options?.activate !== false) {
    return activateClientRelease(uploaded.id);
  }
  return uploaded;
}

export async function getClientReleasesByApp(appCode: string): Promise<ClientRelease[]> {
  return apiRequest<ClientRelease[]>(`/core/client-releases/by-app/${encodeURIComponent(appCode)}`);
}

export type TenantClientDownload = LoginClientDownload & {
  platform: string;
};

/** 与 core client_product_registry 展示名一致（by-app 聚合回退用） */
const CLIENT_KEY_DISPLAY: Record<string, string> = {
  haoligo: '好力 GO 移动端',
  'touch-terminal-windows': '触屏工位机终端',
  'touch-terminal-android': '移动端 PDA',
};

function releaseToTenantDownload(
  release: ClientRelease,
  appName?: string,
): TenantClientDownload | null {
  const pkg = release.package ?? release.apk;
  if (!release.is_active || !pkg?.url) return null;
  return {
    client_key: release.client_key,
    display_name: CLIENT_KEY_DISPLAY[release.client_key] ?? appName ?? release.client_key,
    platform: release.platform,
    app_version: release.app_version,
    url: pkg.url,
    sha256: pkg.sha256,
    size_bytes: pkg.size_bytes,
    filename: pkg.filename,
    release_notes: release.release_notes,
  };
}

async function resolveTenantClientDownloadsFromApps(): Promise<TenantClientDownload[]> {
  const apps = await getInstalledApplicationList({ is_active: true });
  const seenClientKeys = new Set<string>();
  const results: TenantClientDownload[] = [];

  await Promise.all(
    apps.map(async (app) => {
      const code = app.code?.trim();
      if (!code) return;
      let releases: ClientRelease[];
      try {
        releases = await getClientReleasesByApp(code);
      } catch {
        return;
      }
      for (const release of releases) {
        if (seenClientKeys.has(release.client_key)) continue;
        const item = releaseToTenantDownload(release, app.name);
        if (!item) continue;
        seenClientKeys.add(release.client_key);
        results.push(item);
      }
    }),
  );

  return results.sort((a, b) => a.client_key.localeCompare(b.client_key));
}

export async function getTenantClientDownloads(): Promise<TenantClientDownload[]> {
  try {
    const rows = await apiRequest<TenantClientDownload[]>('/core/client-releases/downloads');
    if (rows.length > 0) {
      return rows;
    }
  } catch {
    // 未部署 /downloads 或暂不可用时走 by-app 聚合
  }
  return resolveTenantClientDownloadsFromApps();
}

export async function getClientDownloadQrOrigin(port?: number): Promise<string> {
  const data = await apiRequest<{ origin: string }>('/core/client-releases/qr-origin', {
    params: port ? { port } : undefined,
  });
  return data.origin;
}

export async function getLoginClientDownloads(): Promise<LoginClientDownloads> {
  const response = await fetch('/api/v1/infra/clients/login-downloads');
  if (!response.ok) {
    throw new Error('无法加载客户端下载信息');
  }
  return response.json() as Promise<LoginClientDownloads>;
}

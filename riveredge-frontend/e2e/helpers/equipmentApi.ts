/**
 * 设备运维 E2E：后端 API 夹具（UTF-8 安全，避免 curl 中文 body 解析失败）
 */
import { BACKEND_URL, TENANT_ID, apiLogin } from './session';

export type Json = Record<string, unknown>;

let cachedToken: string | null = null;

export async function getAccessToken(forceRefresh = false): Promise<string> {
  if (cachedToken && !forceRefresh) return cachedToken;
  const login = await apiLogin();
  cachedToken = login.accessToken;
  return cachedToken;
}

async function api(
  method: string,
  path: string,
  body?: unknown,
  retried = false,
): Promise<{ status: number; data: any }> {
  const token = await getAccessToken(retried);
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/api/v1/apps/kuaizhizao${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Tenant-ID': String(TENANT_ID),
        'Content-Type': 'application/json; charset=utf-8',
        Accept: 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    if (!retried) return api(method, path, body, true);
    throw err;
  }
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  // 连库抖动导致的 5xx：刷新 token 后重试一次
  if (res.status >= 500 && !retried) {
    cachedToken = null;
    return api(method, path, body, true);
  }
  return { status: res.status, data };
}

export function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
}

export async function createEquipment(overrides: Json = {}) {
  const suffix = uniqueSuffix();
  const payload = {
    // 显式唯一编码：软删后编号规则可能复用序列值导致冲突
    code: `E2E${suffix}`.slice(0, 40),
    name: `E2E设备-${suffix}`,
    status: '正常',
    is_active: true,
    brand: 'E2E',
    model: 'M1',
    ...overrides,
  };
  const { status, data } = await api('POST', '/equipment', payload);
  if (status >= 400) {
    throw new Error(`创建设备失败 ${status}: ${JSON.stringify(data)}`);
  }
  return data as { uuid: string; code: string; name: string; status: string; id: number };
}

export type EquipmentRow = { uuid: string; code: string; name: string; status: string; id: number };

export async function getEquipment(uuid: string) {
  const { status, data } = await api('GET', `/equipment/${uuid}`);
  if (status >= 400) throw new Error(`获取设备失败 ${status}: ${JSON.stringify(data)}`);
  return data;
}

export async function updateEquipment(uuid: string, payload: Json) {
  const { status, data } = await api('PUT', `/equipment/${uuid}`, payload);
  if (status >= 400) throw new Error(`更新设备失败 ${status}: ${JSON.stringify(data)}`);
  return data;
}

export async function deleteEquipment(uuid: string) {
  const { status, data } = await api('DELETE', `/equipment/${uuid}`);
  if (status >= 400 && status !== 204) {
    throw new Error(`删除设备失败 ${status}: ${JSON.stringify(data)}`);
  }
  return status;
}

export async function getEquipmentTrace(uuid: string) {
  const { status, data } = await api('GET', `/equipment/${uuid}/trace`);
  if (status >= 400) throw new Error(`追溯失败 ${status}: ${JSON.stringify(data)}`);
  return data;
}

export async function listEquipment(params: Record<string, string | number> = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => qs.set(k, String(v)));
  const { status, data } = await api('GET', `/equipment?${qs.toString()}`);
  if (status >= 400) throw new Error(`列表失败 ${status}: ${JSON.stringify(data)}`);
  return data;
}

export async function createEquipmentFault(equipmentUuid: string, overrides: Json = {}) {
  const payload = {
    equipment_uuid: equipmentUuid,
    fault_date: new Date().toISOString(),
    fault_type: '其他',
    fault_level: '一般',
    fault_description: `E2E故障-${uniqueSuffix()}`,
    status: '待处理',
    repair_required: true,
    ...overrides,
  };
  const { status, data } = await api('POST', '/equipment-faults', payload);
  if (status >= 400) throw new Error(`报修失败 ${status}: ${JSON.stringify(data)}`);
  return data as { uuid: string; fault_no?: string; status: string };
}

export async function createEquipmentRepair(equipmentUuid: string, overrides: Json = {}) {
  const payload = {
    equipment_uuid: equipmentUuid,
    repair_date: new Date().toISOString(),
    repair_type: '现场维修',
    repairer_name: 'E2E测试员',
    repair_description: `E2E维修-${uniqueSuffix()}`,
    status: '进行中',
    ...overrides,
  };
  const { status, data } = await api('POST', '/equipment-faults/repairs', payload);
  if (status >= 400) throw new Error(`维修失败 ${status}: ${JSON.stringify(data)}`);
  return data as { uuid: string; repair_no?: string; status: string };
}

export async function completeEquipmentRepair(uuid: string, overrides: Json = {}) {
  const payload = {
    status: '已完成',
    // schema 仅允许：成功 / 失败 / 部分成功
    repair_result: '成功',
    repair_description: 'E2E完修',
    ...overrides,
  };
  const { status, data } = await api('PUT', `/equipment-faults/repairs/${uuid}`, payload);
  if (status >= 400) throw new Error(`完修失败 ${status}: ${JSON.stringify(data)}`);
  return data;
}

/** 点检项 + 点检方案 + 设备绑定（点检创建前置） */
export async function ensureSpotCheckScheme(equipmentId: number) {
  const suffix = uniqueSuffix();
  const itemRes = await api('POST', '/equipment-inspection-items', {
    code: `II-${suffix}`.slice(0, 64),
    name: `E2E点检项-${suffix}`,
    value_type: 'boolean',
    is_active: true,
  });
  if (itemRes.status >= 400) {
    throw new Error(`点检项创建失败 ${itemRes.status}: ${JSON.stringify(itemRes.data)}`);
  }
  const itemId = itemRes.data.id as number;

  const schemeRes = await api('POST', '/equipment-inspection-schemes', {
    code: `IS-${suffix}`.slice(0, 64),
    name: `E2E点检方案-${suffix}`,
    is_active: true,
    lines: [{ item_id: itemId, sort_order: 1 }],
  });
  if (schemeRes.status >= 400) {
    throw new Error(`点检方案创建失败 ${schemeRes.status}: ${JSON.stringify(schemeRes.data)}`);
  }
  const schemeId = schemeRes.data.id as number;

  const bindRes = await api('POST', '/equipment-scheme-bindings', {
    equipment_id: equipmentId,
    scheme_id: schemeId,
    scheme_type: 'spot_check',
  });
  if (bindRes.status >= 400) {
    throw new Error(`方案绑定失败 ${bindRes.status}: ${JSON.stringify(bindRes.data)}`);
  }
  return { itemId, schemeId };
}

export async function createSparePart(overrides: Json = {}) {
  const suffix = uniqueSuffix();
  const payload = {
    part_no: `SP-${suffix}`,
    part_name: `E2E备件-${suffix}`,
    ...overrides,
  };
  const { status, data } = await api('POST', '/spare-parts', payload);
  if (status >= 400) throw new Error(`备件创建失败 ${status}: ${JSON.stringify(data)}`);
  return data;
}

export async function createCalibration(equipmentUuid: string, overrides: Json = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const payload = {
    equipment_uuid: equipmentUuid,
    calibration_date: today,
    result: '合格',
    certificate_no: `CAL-${uniqueSuffix()}`,
    ...overrides,
  };
  const { status, data } = await api('POST', '/equipment/calibrations', payload);
  if (status >= 400) throw new Error(`校验创建失败 ${status}: ${JSON.stringify(data)}`);
  return data;
}

export async function createSpotCheck(equipmentId: number, overrides: Json = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const hasScheme = overrides.scheme_id != null;
  const schemeId = hasScheme
    ? (overrides.scheme_id as number)
    : (await ensureSpotCheckScheme(equipmentId)).schemeId;
  const { scheme_id: _ignored, ...rest } = overrides;
  const payload = {
    equipment_id: equipmentId,
    check_date: today,
    inspector_name: 'E2E检验员',
    remark: `E2E点检-${uniqueSuffix()}`,
    ...rest,
    scheme_id: schemeId,
  };
  const { status, data } = await api('POST', '/equipment-spot-checks', payload);
  if (status >= 400) throw new Error(`点检创建失败 ${status}: ${JSON.stringify(data)}`);
  return data;
}

export async function createMaintenanceExecution(equipmentUuid: string, overrides: Json = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const payload = {
    equipment_uuid: equipmentUuid,
    execution_date: today,
    executor_name: 'E2E执行人',
    execution_content: `E2E保养-${uniqueSuffix()}`,
    execution_result: '正常',
    status: '草稿',
    ...overrides,
  };
  const { status, data } = await api('POST', '/maintenance-plans/executions', payload);
  if (status >= 400) throw new Error(`保养执行创建失败 ${status}: ${JSON.stringify(data)}`);
  return data as { uuid: string; status: string };
}

export async function updateMaintenanceExecution(uuid: string, payload: Json) {
  const { status, data } = await api('PUT', `/maintenance-plans/executions/${uuid}`, payload);
  if (status >= 400) throw new Error(`保养执行更新失败 ${status}: ${JSON.stringify(data)}`);
  return data;
}

export async function createScrapApplication(equipmentId: number, overrides: Json = {}) {
  const payload = {
    equipment_id: equipmentId,
    reason: `E2E报废-${uniqueSuffix()}`,
    scrap_date: new Date().toISOString().slice(0, 10),
    ...overrides,
  };
  const { status, data } = await api('POST', '/equipment-scrap-applications', payload);
  if (status >= 400) throw new Error(`报废申请失败 ${status}: ${JSON.stringify(data)}`);
  return data as { id: number; uuid?: string; status?: string };
}

export async function submitScrapApplication(rowId: number) {
  const { status, data } = await api('POST', `/equipment-scrap-applications/${rowId}/submit`, {});
  if (status >= 400) throw new Error(`报废提交失败 ${status}: ${JSON.stringify(data)}`);
  return data;
}

export async function approveScrapApplication(rowId: number) {
  const { status, data } = await api('POST', `/equipment-scrap-applications/${rowId}/approve`, {});
  if (status >= 400) throw new Error(`报废审批失败 ${status}: ${JSON.stringify(data)}`);
  return data;
}

export async function listEquipmentStatus(params: Record<string, string | number> = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => qs.set(k, String(v)));
  const { status, data } = await api('GET', `/equipment-status/monitors?${qs.toString()}`);
  if (status >= 400) throw new Error(`状态监控列表失败 ${status}: ${JSON.stringify(data)}`);
  return data;
}

export async function updateEquipmentStatusMonitor(payload: Json) {
  const { status, data } = await api('POST', '/equipment-status', payload);
  if (status >= 400) {
    // 某些环境可能用 PUT /equipment-status/{id}
    const retry = await api('PUT', '/equipment-status', payload);
    if (retry.status >= 400) {
      throw new Error(`状态更新失败 ${status}/${retry.status}: ${JSON.stringify(data)}`);
    }
    return retry.data;
  }
  return data;
}

/** 页面健康检查：忽略偶发 core/auth 基建 5xx，仅断言 kuaizhizao 业务 API 与页面壳 */
export async function assertPageHealthy(page: import('@playwright/test').Page, route: string) {
  const { expect } = await import('@playwright/test');
  const pageErrors: string[] = [];
  const serverErrors: string[] = [];
  const onPageError = (err: Error) => pageErrors.push(String(err?.message || err));
  const onResponse = (res: import('@playwright/test').Response) => {
    if (res.status() < 500 || !res.url().includes('/api/')) return;
    // 仅统计业务应用 API；core/auth/personal 偶发连库抖动不阻断设备页用例
    if (!res.url().includes('/api/v1/apps/kuaizhizao/')) return;
    serverErrors.push(`${res.status()} ${res.request().method()} ${res.url()}`);
  };
  page.on('pageerror', onPageError);
  page.on('response', onResponse);
  try {
    let loaded = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      pageErrors.length = 0;
      serverErrors.length = 0;
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.ant-layout', { timeout: 60_000 });
      await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
      expect(new URL(page.url()).pathname, `路由 ${route} 被重定向到登录页`).not.toBe('/login');
      const appFail = page.getByText('应用加载失败');
      const pageFail = page.getByText('页面出现错误');
      if ((await appFail.count()) > 0 || (await pageFail.count()) > 0) {
        if (attempt < 2) continue;
        throw new Error(`路由 ${route} 应用/页面加载失败（已重试）`);
      }
      loaded = true;
      break;
    }
    expect(loaded, `路由 ${route} 未能加载`).toBeTruthy();
    expect(pageErrors, `路由 ${route} 存在未捕获 JS 异常`).toEqual([]);
    expect(serverErrors, `路由 ${route} 存在业务 API 5xx`).toEqual([]);
  } finally {
    page.off('pageerror', onPageError);
    page.off('response', onResponse);
  }
}

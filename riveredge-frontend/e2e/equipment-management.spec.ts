/**
 * 设备运维 E2E：台账 + 点检/巡检/故障维修/保养/备件/报废校验/状态监控
 *
 * 策略：API 建夹具验证业务契约；关键页面用 storageState 做 UI 健康与关键交互断言。
 */
import { test, expect } from '@playwright/test';
import { STORAGE_STATE_PATH } from './helpers/session';
import {
  assertPageHealthy,
  completeEquipmentRepair,
  createCalibration,
  createEquipment,
  createEquipmentFault,
  createEquipmentRepair,
  createMaintenanceExecution,
  createScrapApplication,
  submitScrapApplication,
  approveScrapApplication,
  createSparePart,
  createSpotCheck,
  deleteEquipment,
  ensureSpotCheckScheme,
  getEquipment,
  getEquipmentTrace,
  listEquipment,
  listEquipmentStatus,
  uniqueSuffix,
  updateEquipment,
  updateMaintenanceExecution,
} from './helpers/equipmentApi';

test.use({ storageState: STORAGE_STATE_PATH });

const ROUTES = {
  equipment: '/apps/kuaizhizao/equipment-management/equipment',
  inspectionItems: '/apps/kuaizhizao/equipment-management/inspection-items',
  inspectionSchemes: '/apps/kuaizhizao/equipment-management/inspection-schemes',
  spotChecks: '/apps/kuaizhizao/equipment-management/spot-checks',
  patrolRoutes: '/apps/kuaizhizao/equipment-management/patrol-routes',
  routePatrols: '/apps/kuaizhizao/equipment-management/route-patrols',
  faults: '/apps/kuaizhizao/equipment-management/equipment-faults',
  repairs: '/apps/kuaizhizao/equipment-management/equipment-repairs',
  maintenanceItems: '/apps/kuaizhizao/equipment-management/maintenance-items',
  maintenanceSchemes: '/apps/kuaizhizao/equipment-management/maintenance-schemes',
  maintenancePlans: '/apps/kuaizhizao/equipment-management/maintenance-plans',
  maintenanceExecutions: '/apps/kuaizhizao/equipment-management/maintenance-executions',
  maintenanceReminders: '/apps/kuaizhizao/equipment-management/maintenance-reminders',
  spareParts: '/apps/kuaizhizao/equipment-management/spare-parts',
  spareRequisitions: '/apps/kuaizhizao/equipment-management/spare-part-requisitions',
  transfers: '/apps/kuaizhizao/equipment-management/equipment-transfers',
  scrap: '/apps/kuaizhizao/equipment-management/equipment-scrap',
  calibrations: '/apps/kuaizhizao/equipment-management/equipment-calibrations',
  status: '/apps/kuaizhizao/equipment-management/equipment-status',
} as const;

test.describe('设备运维 台账 CRUD', () => {
  test('API：新建 / 查重编码 / 更新 / 追溯 / 软删', async () => {
    const eq = await createEquipment({ status: '正常' });
    expect(eq.uuid).toBeTruthy();
    expect(eq.code).toBeTruthy();

    const dup = await listEquipment({ keyword: eq.code, limit: 20 });
    const items = Array.isArray(dup) ? dup : dup?.data || dup?.items || [];
    expect(items.some((r: any) => r.uuid === eq.uuid || r.code === eq.code)).toBeTruthy();

    // 重复编码应失败
    const token = await (await import('./helpers/equipmentApi')).getAccessToken();
    const res = await fetch('http://127.0.0.1:8200/api/v1/apps/kuaizhizao/equipment', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Tenant-ID': '35',
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({ code: eq.code, name: '重复编码设备', status: '正常' }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);

    const renamed = `E2E改名-${uniqueSuffix()}`;
    await updateEquipment(eq.uuid, { name: renamed, status: '维修中' });
    const got = await getEquipment(eq.uuid);
    expect(got.name).toBe(renamed);
    expect(got.status).toBe('维修中');

    // 校验中为合法状态（与字典/schema 对齐）
    await updateEquipment(eq.uuid, { status: '校验中' });
    expect((await getEquipment(eq.uuid)).status).toBe('校验中');
    await updateEquipment(eq.uuid, { status: '正常' });

    const trace = await getEquipmentTrace(eq.uuid);
    expect(trace).toBeTruthy();

    await deleteEquipment(eq.uuid);
    let gone = false;
    try {
      await getEquipment(eq.uuid);
    } catch {
      gone = true;
    }
    expect(gone).toBeTruthy();
  });

  test('UI：列表页健康 + 新建弹窗 + 详情 Tab', async ({ page }) => {
    test.setTimeout(180_000);
    const created = await createEquipment({ name: `E2E-UI-${uniqueSuffix()}`, status: '正常' });
    try {
      await assertPageHealthy(page, ROUTES.equipment);

      const createBtn = page.getByRole('button', { name: /新建|新增|创建/ }).first();
      await expect(createBtn).toBeVisible({ timeout: 20_000 });
      await createBtn.click();
      await expect(page.locator('.ant-modal, .ant-drawer').first()).toBeVisible({ timeout: 15_000 });
      await page.keyboard.press('Escape');

      // 详情页：遇连库抖动时重试
      let detailOk = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        await page.goto(`${ROUTES.equipment}/${created.uuid}`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.ant-layout', { timeout: 60_000 });
        await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
        expect(page.url()).toContain(created.uuid);
        if ((await page.getByText('应用加载失败').count()) > 0) continue;
        const nameOrCode = page
          .getByText(created.name, { exact: false })
          .or(page.getByText(created.code, { exact: false }));
        if ((await nameOrCode.count()) > 0) {
          await expect(nameOrCode.first()).toBeVisible({ timeout: 15_000 });
          detailOk = true;
          break;
        }
      }
      expect(detailOk, '设备详情未能展示名称/编码').toBeTruthy();

      const tabCandidates = ['点检', '巡检', '故障', '保养', '备件', '报废'];
      for (const label of tabCandidates) {
        const tab = page.getByRole('tab', { name: new RegExp(label) }).first();
        if (await tab.count()) {
          await tab.click();
          await expect(page.locator('.ant-spin-spinning')).toHaveCount(0, { timeout: 10_000 }).catch(() => undefined);
        }
      }
    } finally {
      await deleteEquipment(created.uuid).catch(() => undefined);
    }
  });
});

test.describe('设备运维 点检 巡检', () => {
  test('API：点检创建（正常设备）+ 报废设备应被拒', async () => {
    const eq = await createEquipment({ status: '正常' });
    try {
      expect(eq.id).toBeTruthy();
      const { schemeId } = await ensureSpotCheckScheme(eq.id);
      const sc = await createSpotCheck(eq.id, { scheme_id: schemeId });
      expect(sc).toBeTruthy();
      expect(sc.document_no || sc.uuid || sc.id).toBeTruthy();

      await updateEquipment(eq.uuid, { status: '报废' });
      let rejected = false;
      try {
        await createSpotCheck(eq.id, { scheme_id: schemeId });
      } catch (e: any) {
        rejected = /报废|点检创建失败/.test(String(e?.message || e));
      }
      const got = await getEquipment(eq.uuid);
      expect(got.status).toBe('报废');
      expect(rejected, '报废设备创建点检应被后端拒绝').toBeTruthy();
    } finally {
      await deleteEquipment(eq.uuid).catch(() => undefined);
    }
  });

  test('UI：点检项目/方案/记录、巡检路线/记录页健康', async ({ page }) => {
    test.setTimeout(240_000);
    for (const route of [
      ROUTES.inspectionItems,
      ROUTES.inspectionSchemes,
      ROUTES.spotChecks,
      ROUTES.patrolRoutes,
      ROUTES.routePatrols,
    ]) {
      await assertPageHealthy(page, route);
    }
  });
});

test.describe('设备运维 故障维修', () => {
  test('API：报修 → 转维修 → 完修', async () => {
    const eq = await createEquipment({ status: '正常' });
    try {
      const fault = await createEquipmentFault(eq.uuid);
      expect(fault.uuid).toBeTruthy();
      expect(fault.status === '待处理' || !!fault.status).toBeTruthy();

      const repair = await createEquipmentRepair(eq.uuid, {
        equipment_fault_uuid: fault.uuid,
      });
      expect(repair.uuid).toBeTruthy();
      expect(repair.status).toBe('进行中');

      const done = await completeEquipmentRepair(repair.uuid);
      expect(done.status).toBe('已完成');
      expect(done.repair_result).toBe('成功');
    } finally {
      await deleteEquipment(eq.uuid).catch(() => undefined);
    }
  });

  test('UI：故障/维修列表页健康', async ({ page }) => {
    test.setTimeout(120_000);
    await assertPageHealthy(page, ROUTES.faults);
    await assertPageHealthy(page, ROUTES.repairs);
  });
});

test.describe('设备运维 保养链', () => {
  test('API：保养执行 草稿→确认→验收', async () => {
    const eq = await createEquipment({ status: '正常' });
    try {
      const exec = await createMaintenanceExecution(eq.uuid, { status: '草稿' });
      expect(exec.uuid).toBeTruthy();

      const confirmed = await updateMaintenanceExecution(exec.uuid, {
        status: '已确认',
        execution_result: '正常',
      });
      expect(confirmed.status).toBe('已确认');

      const accepted = await updateMaintenanceExecution(exec.uuid, {
        status: '已验收',
        acceptance_result: '合格',
      });
      expect(accepted.status).toBe('已验收');
    } finally {
      await deleteEquipment(eq.uuid).catch(() => undefined);
    }
  });

  test('UI：保养相关页面健康', async ({ page }) => {
    test.setTimeout(240_000);
    for (const route of [
      ROUTES.maintenanceItems,
      ROUTES.maintenanceSchemes,
      ROUTES.maintenancePlans,
      ROUTES.maintenanceExecutions,
      ROUTES.maintenanceReminders,
    ]) {
      await assertPageHealthy(page, route);
    }
  });
});

test.describe('设备运维 备件 调拨报废校验 状态监控', () => {
  test('API：备件创建 + 校验记录', async () => {
    const eq = await createEquipment({ status: '正常' });
    try {
      const part = await createSparePart();
      expect(part.part_no || part.id || part.uuid).toBeTruthy();

      const cal = await createCalibration(eq.uuid);
      expect(cal).toBeTruthy();
      const got = await getEquipment(eq.uuid);
      // 创建校验后可能回写 last/next_calibration_date
      expect(got.uuid || got.code).toBeTruthy();
    } finally {
      await deleteEquipment(eq.uuid).catch(() => undefined);
    }
  });

  test('API：报废申请审批后设备状态=报废', async () => {
    const eq = await createEquipment({ status: '正常' });
    try {
      const app = await createScrapApplication(eq.id);
      expect(app.id).toBeTruthy();
      await submitScrapApplication(app.id).catch(() => undefined);
      await approveScrapApplication(app.id);
      const got = await getEquipment(eq.uuid);
      expect(got.status).toBe('报废');
    } finally {
      await deleteEquipment(eq.uuid).catch(() => undefined);
    }
  });

  test('API：状态监控列表可读', async () => {
    const data = await listEquipmentStatus({ limit: 5 });
    expect(data).toBeTruthy();
  });

  test('UI：备件/调拨/报废/校验/状态监控页健康', async ({ page }) => {
    test.setTimeout(240_000);
    for (const route of [
      ROUTES.spareParts,
      ROUTES.spareRequisitions,
      ROUTES.transfers,
      ROUTES.scrap,
      ROUTES.calibrations,
      ROUTES.status,
    ]) {
      await assertPageHealthy(page, route);
    }
  });
});

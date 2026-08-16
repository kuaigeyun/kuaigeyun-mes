/**
 * 租户1 · 卢定杰(u005) · 物料分组/物料/BOM 前端点击创建流
 * 目的：模拟真实点击；过程记录不完善点，供同步优化。
 *
 * 运行：
 *   cd riveredge-frontend
 *   npx playwright test -c e2e/playwright.tenant1-click.config.ts
 */
import { test, expect, type Page, type Locator } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const USERNAME = process.env.E2E_USERNAME || 'u005';
const PASSWORD = process.env.E2E_PASSWORD || 'Password123';
const TENANT_NAME = '无锡快格信息技术有限公司';

type Finding = {
  severity: 'high' | 'medium' | 'low' | 'info';
  area: string;
  title: string;
  detail: string;
  at: string;
};

const findings: Finding[] = [];
const stamp = () => new Date().toISOString();

function note(severity: Finding['severity'], area: string, title: string, detail: string) {
  findings.push({ severity, area, title, detail, at: stamp() });
  console.log(`[FINDING:${severity}] ${area} · ${title} — ${detail}`);
}

async function dumpFindings() {
  const outDir = path.join(__dirname, 'output');
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, 'kg-bom-click-findings.json');
  fs.writeFileSync(file, JSON.stringify({ findings, count: findings.length }, null, 2), 'utf-8');
  console.log(`[findings] wrote ${findings.length} -> ${file}`);
}

async function loginAsLu(page: Page) {
  await page.goto('/login');
  await page.waitForSelector('form');
  await page.locator('input[autocomplete="username"]').fill(USERNAME);
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();

  const tenantOption = page.getByText(TENANT_NAME).first();
  try {
    await tenantOption.click({ timeout: 8_000 });
    note('info', 'login', '出现组织选择', `已点选 ${TENANT_NAME}`);
  } catch {
    note('info', 'login', '无组织选择弹窗', '单组织账号直接进入');
  }

  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
  const token = await page.evaluate(() => localStorage.getItem('token'));
  expect(token).toBeTruthy();

  const userInfoRaw = await page.evaluate(() => localStorage.getItem('user_info'));
  const userInfo = userInfoRaw ? JSON.parse(userInfoRaw) : {};
  const fullName = userInfo.full_name || userInfo.fullName || '';
  if (fullName !== '卢定杰') {
    note('high', 'login', '操作人不是卢定杰', `实际 full_name=${fullName}`);
  } else {
    note('info', 'login', '操作人确认', '卢定杰 / u005');
  }

  // 卢定杰个人偏好可能是英文：记录后通过偏好 API 切到中文（仅改 localStorage 会被偏好覆盖）
  const lngBefore = await page.evaluate(() => localStorage.getItem('i18nextLng'));
  if (lngBefore && !String(lngBefore).startsWith('zh')) {
    note(
      'medium',
      'i18n',
      '账号界面语言非中文',
      `登录后 i18nextLng=${lngBefore}。中文操作指引与真实 UI 不一致，自动化若只匹配中文会失败（已踩坑）。`,
    );
  }
  const tokenStr = await page.evaluate(() => localStorage.getItem('token'));
  if (tokenStr) {
    const prefRes = await page.request.put('http://127.0.0.1:8200/api/v1/personal/user-preferences', {
      headers: {
        Authorization: `Bearer ${tokenStr}`,
        'X-Tenant-ID': '1',
        'Content-Type': 'application/json',
      },
      data: { preferences: { language: 'zh-CN' } },
    });
    note('info', 'i18n', '尝试切换偏好语言为 zh-CN', `status=${prefRes.status()}`);
  }
  await page.evaluate(() => localStorage.setItem('i18nextLng', 'zh-CN'));
  await page.reload();
  await page.waitForLoadState('networkidle').catch(() => undefined);
}

async function fillByLabel(page: Page | Locator, label: string, value: string) {
  const item = page.locator('.ant-form-item').filter({ hasText: new RegExp(label) }).first();
  const input = item.locator('input:not([type="checkbox"]):not([type="radio"]), textarea').first();
  await expect(input).toBeVisible({ timeout: 15_000 });
  await input.fill(value);
}

async function selectAntOption(page: Page, label: string, optionText: string | RegExp) {
  const item = page.locator('.ant-form-item').filter({ hasText: new RegExp(label) }).first();
  const selector = item.locator('.ant-select').first();
  await selector.click();
  await page.waitForTimeout(200);
  const search = page
    .locator(
      '.ant-select-dropdown:not(.ant-select-dropdown-hidden) input.ant-select-selection-search-input, .ant-select-dropdown:not(.ant-select-dropdown-hidden) input',
    )
    .first();
  const needle = typeof optionText === 'string' ? optionText : '';
  if (needle && (await search.isVisible().catch(() => false))) {
    await search.fill(needle);
    await page.waitForTimeout(350);
  }
  const opt = page
    .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
    .filter({ hasText: optionText })
    .first();
  await expect(opt).toBeVisible({ timeout: 10_000 });
  await opt.click();
}

async function selectSourceTypeMake(page: Page) {
  const item = page.locator('.ant-form-item').filter({ hasText: /物料来源类型|Source Type/i }).first();
  await expect(item).toBeVisible({ timeout: 10_000 });
  await item.scrollIntoViewIfNeeded();
  await item.locator('.ant-select').first().click();
  const opt = page
    .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
    .filter({ hasText: /自制|Make/i })
    .first();
  await expect(opt).toBeVisible({ timeout: 10_000 });
  await opt.click();
  await page.keyboard.press('Escape');
}

async function clickTab(page: Page, name: string | RegExp) {
  const tab = page.locator('.ant-tabs-tab').filter({ hasText: name }).first();
  await expect(tab).toBeVisible({ timeout: 10_000 });
  await tab.click();
}

async function dismissOpenModals(page: Page) {
  for (let i = 0; i < 3; i++) {
    const modal = page.locator('.ant-modal-wrap:not([style*="display: none"]) .ant-modal').last();
    if (!(await modal.isVisible().catch(() => false))) break;
    const cancel = modal.getByRole('button', { name: /取消|Cancel|关闭|Close/i }).first();
    if (await cancel.isVisible().catch(() => false)) {
      await cancel.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(300);
  }
}

async function selectParentGroup(page: Page, modal: Locator, keyword: string) {
  const parentItem = modal.locator('.ant-form-item').filter({ hasText: /父分组|Parent Group/i }).first();
  if (!(await parentItem.isVisible().catch(() => false))) {
    note('medium', 'group-modal', '无父分组字段', '弹窗无父级选择');
    return false;
  }
  await parentItem.locator('.ant-select').first().click();
  const search = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) input').first();
  if (await search.isVisible().catch(() => false)) {
    await search.fill(keyword);
    await page.waitForTimeout(400);
  } else {
    await page.keyboard.type(keyword, { delay: 40 });
    await page.waitForTimeout(400);
  }
  const opt = page
    .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
    .filter({ hasText: new RegExp(keyword) })
    .first();
  try {
    await expect(opt).toBeVisible({ timeout: 8_000 });
    await opt.click();
    return true;
  } catch {
    note(
      'medium',
      'group-modal',
      '父分组下拉难选',
      `关键字「${keyword}」无匹配。选项 label 可能是「编号 - 代号 - 名称」长文案，搜索体验需优化。`,
    );
    await page.keyboard.press('Escape');
    return false;
  }
}

async function waitToast(page: Page, textPart?: string) {
  const toast = page.locator('.ant-message-notice, .ant-notification-notice').last();
  try {
    await expect(toast).toBeVisible({ timeout: 15_000 });
    const text = (await toast.innerText()).trim();
    if (textPart && !text.includes(textPart)) {
      note('medium', 'toast', '提示文案与预期不符', `期望含「${textPart}」，实际「${text}」`);
    }
    return text;
  } catch {
    note('medium', 'toast', '未出现成功/失败提示', textPart || '无');
    return '';
  }
}

test.describe.serial('租户1 物料BOM 点击创建（卢定杰）', () => {
  test.afterAll(async () => {
    await dumpFindings();
  });

  test('登录 → KG分组 → 物料 → BOM', async ({ page }) => {
    page.on('dialog', async (d) => {
      note('medium', 'dialog', '出现原生弹窗', d.message());
      await d.dismiss();
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        note('low', 'console', '前端 console.error', msg.text().slice(0, 300));
      }
    });

    page.on('pageerror', (err) => {
      note('high', 'pageerror', '页面未捕获异常', String(err).slice(0, 400));
    });

    // —— 1. 登录 ——
    await loginAsLu(page);

    // —— 2. 物料管理：新建 KG 分组 ——
    await page.goto('/apps/master-data/materials');
    await page.waitForLoadState('networkidle').catch(() => undefined);

    // 偏好服务端回写英文时，用个人偏好接口或页面内切换；先双语匹配按钮
    const createGroupBtn = page
      .getByRole('button', { name: /新建分组|新建物料分组|Create Group|Create Material Group/ })
      .first();
    const t0 = Date.now();
    await expect(createGroupBtn).toBeVisible({ timeout: 30_000 });
    const groupBtnText = ((await createGroupBtn.textContent()) || '').trim();
    if (/Create Material Group/i.test(groupBtnText)) {
      note(
        'medium',
        'i18n',
        '物料页仍为英文',
        '仅改 localStorage i18nextLng 无效，语言被个人偏好覆盖。建议：偏好切换后即时生效，或测试入口提供「按操作文档语言预览」。',
      );
      // 尝试从顶栏切中文（若有语言菜单）
      const langSwitch = page.getByRole('button', { name: /语言|Language|中文|English/i }).first();
      if (await langSwitch.isVisible().catch(() => false)) {
        await langSwitch.click();
        const zh = page.getByText(/简体中文|中文|Chinese|zh-CN/i).first();
        if (await zh.isVisible().catch(() => false)) {
          await zh.click();
          await page.waitForTimeout(800);
        }
      }
    }
    if (Date.now() - t0 > 8_000) {
      note('medium', 'materials', '分组按钮出现慢', `等待 ${Date.now() - t0}ms`);
    }
    // 若上次运行已创建 KG，跳过根分组
    const existingKG = page.locator('.material-group-tree, .ant-tree').getByText(/快格流程测试|^KG/).first();
    if (await existingKG.isVisible().catch(() => false)) {
      note('info', 'group', 'KG 分组已存在', '跳过根分组创建');
    } else {
      await createGroupBtn.click();
      const groupModal = page
        .locator('.ant-modal')
        .filter({ hasText: /新建分组|新建物料分组|Create Group|Create Material Group|新建子分组|Create Sub|新建分组|Create Group/ })
        .last();
      await expect(groupModal).toBeVisible({ timeout: 15_000 });

      const codeLabelVisible = await groupModal
        .getByText(/分组编号|Group Code/i)
        .first()
        .isVisible()
        .catch(() => false);
      if (!codeLabelVisible) {
        note('high', 'group-modal', '缺少分组编号标签', '弹窗打开后未看到分组编号/Group Code 字段');
      }

      await fillByLabel(groupModal, '分组编号|Group Code', 'KG');
      await fillByLabel(groupModal, '分组名称|Group Name', '快格流程测试');
      const aliasItem = groupModal.locator('.ant-form-item').filter({ hasText: /分组代号|Group Alias|Alias/i }).first();
      if (await aliasItem.isVisible().catch(() => false)) {
        await aliasItem.locator('input').first().fill('KG');
      }

      const confirmBtn = groupModal.getByRole('button', { name: /^(创建|确定|保存|Create|OK|Save)/ }).last();
      await confirmBtn.click();
      await waitToast(page);
      await dismissOpenModals(page);
    }

    const treeKG = page.locator('.material-group-tree, .ant-tree').getByText(/快格流程测试|^KG/).first();
    try {
      await expect(treeKG).toBeVisible({ timeout: 15_000 });
      note('info', 'group', 'KG 分组已出现在左侧树', 'OK');
    } catch {
      note('high', 'group', '左侧树未见 KG', '可能需刷新或创建失败');
      await page.reload();
      await page.waitForLoadState('networkidle').catch(() => undefined);
    }

    // 再建子分组 KG-FG / KG-RM（右键或再点新建后选父级）
    for (const [code, name] of [
      ['KG-FG', 'KG成品'],
      ['KG-RM', 'KG原材料'],
      ['KG-SEMI', 'KG半成品'],
    ] as const) {
      await dismissOpenModals(page);
      const exists = page.locator('.material-group-tree, .ant-tree').getByText(new RegExp(code)).first();
      if (await exists.isVisible().catch(() => false)) {
        note('info', 'group', `子分组 ${code} 已存在`, '跳过');
        continue;
      }
      await page.getByRole('button', { name: /新建分组|新建物料分组|Create Group|Create Material Group/ }).first().click();
      const modal = page.locator('.ant-modal').filter({ hasText: /新建分组|新建物料分组|Create Group|Create Material Group|新建子分组|Create Sub/ }).last();
      await expect(modal).toBeVisible({ timeout: 15_000 });
      await selectParentGroup(page, modal, 'KG');
      await fillByLabel(modal, '分组编号|Group Code', code);
      await fillByLabel(modal, '分组名称|Group Name', name);

      await modal.getByRole('button', { name: /^(创建|确定|保存|Create|OK|Save)/ }).last().click();
      await waitToast(page);
      await page.waitForTimeout(500);
      await dismissOpenModals(page);
    }

    // —— 3. 新建完备成品物料（先点左侧 KG-FG，使新建带 groupId）——
    await dismissOpenModals(page);
    const fgNode = page.locator('.material-group-tree, .ant-tree').getByText(/KG-FG/).first();
    if (await fgNode.isVisible().catch(() => false)) {
      await fgNode.click();
      await page.waitForTimeout(400);
      note('info', 'materials', '先选中左侧 KG-FG 再新建', '利用 ?groupId= 预填，避开 UniDropdown 难选');
    } else {
      note('medium', 'materials', '左侧未见 KG-FG 节点', '将依赖表单内下拉选分组');
    }
    // 注意：「新建物料分组」包含「新建物料」，必须用更严正则，否则会误点分组按钮（已踩坑）
    const createMatBtn = page
      .getByRole('button', { name: /新建物料\s*[（(]|Create Material\s*\(/ })
      .first();
    await expect(createMatBtn).toBeVisible({ timeout: 15_000 });
    note(
      'medium',
      'materials',
      '「新建物料」与「新建物料分组」文案前缀冲突',
      '已将分组按钮文案改为「新建分组/Create Group」以降低误点；保留本记录作回归依据。',
    );
    await createMatBtn.click();
    try {
      await page.waitForURL(/\/apps\/master-data\/materials\/new/, { timeout: 20_000 });
    } catch {
      note('high', 'material-form', '点击新建物料未进入 /new', `url=${page.url()}`);
      await page.goto('/apps/master-data/materials/new');
      await page.waitForURL(/\/materials\/new/, { timeout: 15_000 });
    }

    // 主按钮文案：创建页应是「创建」而非「更新」
    const primary = page.getByRole('button', { name: /创建|更新|保存并提交|保存|Create|Update|Save/ }).last();
    const primaryText = ((await primary.textContent()) || '').trim();
    if ((/更新|Update/i.test(primaryText)) && !(/创建|Create/i.test(primaryText))) {
      note('high', 'material-form', '新建页主按钮文案错误', `显示「${primaryText}」，应为「创建/Create」`);
    } else {
      note('info', 'material-form', '新建页主按钮', primaryText);
    }

    // 基本信息
    await fillByLabel(page, '物料名称|Material Name', `KG流程测试智能落地柜-${Date.now().toString().slice(-6)}`);
    const groupSelected = page
      .locator('.ant-form-item')
      .filter({ hasText: /物料分组|Material Group/i })
      .locator('.ant-select-selection-item')
      .first();
    const groupText = ((await groupSelected.textContent().catch(() => '')) || '').trim();
    if (/KG-FG/.test(groupText)) {
      note('info', 'material-form', '分组已由左侧树预填', groupText);
    } else {
      try {
        await selectAntOption(page, '物料分组|Material Group', /KG-FG/);
      } catch (e) {
        note('high', 'material-form', '无法选择 KG-FG 分组', String(e).slice(0, 160));
      }
    }

    try {
      await selectAntOption(page, '基础单位|Base Unit', '台');
    } catch {
      try {
        await selectAntOption(page, '基础单位|Base Unit', '件');
        note('medium', 'material-form', '单位「台」不可用', '已回退选择「件」');
      } catch {
        note('high', 'material-form', '基础单位无法选择', '');
      }
    }

    await fillByLabel(page, '规格|Specification|Spec', '双门双抽/全流程测试');
    await fillByLabel(page, '品牌|Brand', '快格测试');
    await fillByLabel(page, '型号|Model', 'KG-CABINET-PRO');

    try {
      await selectSourceTypeMake(page);
      note('info', 'material-form', '已选物料来源=自制', 'OK');
    } catch (e) {
      note('high', 'material-form', '物料来源类型选择失败', String(e).slice(0, 200));
      note(
        'medium',
        'material-form',
        '来源类型易漏填',
        '必填多选且位于基本信息中段，新建默认不预填，易导致点创建后才报错。',
      );
    }

    note('info', 'material-form', '跳过手动改批号/默认值 Tab', '依赖开启开关时自动回填系统默认规则');

    // 主编号：若提示选分组，记为问题
    const mainCodeItem = page.locator('.ant-form-item').filter({ hasText: /主编号|主编码|Main Code/i }).first();
    if (await mainCodeItem.isVisible().catch(() => false)) {
      const v = await mainCodeItem.locator('input').first().inputValue().catch(() => '');
      if (!v || v.includes('请') || v.includes('分组') || /select group/i.test(v)) {
        note('medium', 'material-form', '主编号未自动生成', `当前值「${v}」`);
      } else {
        note('info', 'material-form', '主编号已生成', v);
      }
    }

    await primary.click();
    const saveToast = await waitToast(page);
    if (/失败|错误|fail|error/i.test(saveToast)) {
      note('high', 'material-form', '物料保存失败', saveToast);
    }

    // 保存后应离开 new 或仍在表单但成功
    await page.waitForTimeout(1500);
    const stillNew = page.url().includes('/materials/new');
    if (stillNew && !/成功|success/i.test(saveToast)) {
      const errors = page.locator('.ant-form-item-explain-error');
      const errCount = await errors.count();
      const errTexts: string[] = [];
      for (let i = 0; i < Math.min(errCount, 8); i++) {
        errTexts.push((await errors.nth(i).innerText()).trim());
      }
      note('high', 'material-form', '仍停在新建页', `校验: ${errTexts.join(' | ') || '无可见校验'}`);
    } else {
      note('info', 'material-form', '成品物料保存路径完成', page.url());
    }

    // —— 4. 再建 1 个原材料（用于 BOM） ——
    await page.goto('/apps/master-data/materials');
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.getByRole('button', { name: /新建物料\s*[（(]|Create Material\s*\(/ }).first().click();
    await page.waitForURL(/\/materials\/new/, { timeout: 20_000 });
    await fillByLabel(page, '物料名称|Material Name', `KG测试侧板钢板-${Date.now().toString().slice(-6)}`);
    try {
      await selectAntOption(page, '物料分组|Material Group', /KG-RM/);
    } catch {
      note('medium', 'material-form', '原材料分组选择失败', '');
    }
    try {
      await selectAntOption(page, '基础单位|Base Unit', '个');
    } catch {
      await selectAntOption(page, '基础单位|Base Unit', '件').catch(() => undefined);
    }
    await fillByLabel(page, '规格|Specification|Spec', '2.0mm*600*400');
    try {
      const sourceItem = page.locator('.ant-form-item').filter({ hasText: /物料来源类型|Source Type/i }).first();
      await sourceItem.scrollIntoViewIfNeeded();
      await sourceItem.locator('.ant-select').first().click();
      await page
        .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
        .filter({ hasText: /采购|Buy/i })
        .first()
        .click({ timeout: 8_000 });
      await page.keyboard.press('Escape');
    } catch {
      note('low', 'material-form', '原材料来源未改成采购', '可能默认已是采购');
    }
    await page.getByRole('button', { name: /^(创建|确定|Create|OK)/ }).last().click();
    await waitToast(page);
    await page.waitForTimeout(1000);

    // —— 5. BOM 点击创建 ——
    await page.goto('/apps/master-data/process/engineering-bom');
    await page.waitForLoadState('networkidle').catch(() => undefined);

    const newBom = page.getByRole('button', { name: /新建BOM|Create BOM|新建/ }).first();
    try {
      await expect(newBom).toBeVisible({ timeout: 20_000 });
    } catch {
      note('high', 'bom', '未见新建 BOM 按钮', page.url());
      await dumpFindings();
      return;
    }
    await newBom.click();

    const bomModal = page.locator('.ant-modal').filter({ hasText: /新建BOM|Create BOM|BOM/ }).last();
    await expect(bomModal).toBeVisible({ timeout: 15_000 });

    // 选父件
    try {
      const parentItem = bomModal.locator('.ant-form-item').filter({ hasText: /父件|主物料|物料|Material/i }).first();
      await parentItem.locator('.ant-select').first().click();
      await page.keyboard.type('KG流程测试智能落地柜', { delay: 30 });
      await page.waitForTimeout(800);
      const opt = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option').first();
      if (await opt.isVisible().catch(() => false)) {
        await opt.click();
      } else {
        note('high', 'bom', '父件下拉无结果', '按名称搜索成品失败');
      }
    } catch (e) {
      note('high', 'bom', '选择父件失败', String(e).slice(0, 200));
    }

    // 添加子件
    const addChild = bomModal.getByRole('button', { name: /添加子物料|添加|新增一行|Add/i }).first();
    if (await addChild.isVisible().catch(() => false)) {
      await addChild.click();
    } else {
      note('medium', 'bom', '无「添加子物料」按钮', '可能是 ProFormList 其它交互');
    }

    try {
      const childSelect = bomModal.locator('.ant-select').nth(1);
      await childSelect.click();
      await page.keyboard.type('KG测试侧板钢板', { delay: 30 });
      await page.waitForTimeout(800);
      const opt = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option').first();
      await opt.click({ timeout: 8_000 });
    } catch {
      note('high', 'bom', '选择子件失败', '');
    }

    // 数量
    const qty = bomModal.locator('.ant-form-item').filter({ hasText: /数量|Quantity/i }).locator('input').first();
    if (await qty.isVisible().catch(() => false)) {
      await qty.fill('2');
    }

    await bomModal.getByRole('button', { name: /^(创建|确定|保存|Create|OK|Save)/ }).last().click();
    await waitToast(page);
    await page.waitForTimeout(1000);

    note('info', 'flow', '点击流结束', `共记录 ${findings.length} 条发现`);
    await dumpFindings();
  });
});

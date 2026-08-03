/**
 * 专业版应用清单与前端占位（未 compose / 未入库时展示于应用中心「专业」）。
 * 真实应用以 kuaigeyun-pro compose + 后端扫描为准；占位仅补全缺失 code。
 */

export const PRO_APP_CODES = [
  'kuaiai',
  'kuaireport',
  'kuaiiot',
  'kuaiems',
  'kuaisrm',
] as const;

export type ProAppCode = (typeof PRO_APP_CODES)[number];

type ProPlaceholderMeta = {
  nameKey: string;
  descKey: string;
  nameDefault: string;
  descDefault: string;
  version: string;
  sort_order: number;
};

/** 与应用中心 PRO 展示顺序、文案键一致 */
export const PRO_PLACEHOLDER_META: Record<ProAppCode, ProPlaceholderMeta> = {
  kuaiai: {
    nameKey: 'sys.app.kuaiai.name',
    descKey: 'sys.app.kuaiai.desc',
    nameDefault: 'KU-AI',
    descDefault: '嵌入业务场景的 AI 智能辅助引擎，提供对话助手与业务智能建议',
    version: 'PRO',
    sort_order: 210,
  },
  kuaireport: {
    nameKey: 'sys.app.kuaireport.name',
    descKey: 'sys.app.kuaireport.desc',
    nameDefault: '快报表',
    descDefault: '多源数据聚合与经营分析决策中心',
    version: 'PRO',
    sort_order: 220,
  },
  kuaiiot: {
    nameKey: 'sys.app.kuaiiot.name',
    descKey: 'sys.app.kuaiiot.desc',
    nameDefault: '快数采',
    descDefault: '工业物联网设备数采集成平台，敬请期待',
    version: 'PRO',
    sort_order: 230,
  },
  kuaiems: {
    nameKey: 'pages.system.applications.mock.kuaienergy.name',
    descKey: 'pages.system.applications.mock.kuaienergy.desc',
    nameDefault: '快能源',
    descDefault: '能源数据监控与能效分析平台，敬请期待',
    version: 'PRO',
    sort_order: 240,
  },
  kuaisrm: {
    nameKey: 'pages.system.applications.mock.kuaisrm.name',
    descKey: 'pages.system.applications.mock.kuaisrm.desc',
    nameDefault: '快协同',
    descDefault: '新一代供应链与供应商协同平台，敬请期待',
    version: 'Beta',
    sort_order: 250,
  },
};

export function isPlaceholderApplication(app: { uuid?: string } | null | undefined): boolean {
  return String(app?.uuid || '').startsWith('placeholder-');
}

type Translate = (key: string, options?: { defaultValue?: string }) => string;

/** 生成专业版占位卡片（无后端记录时注入） */
export function buildProPlaceholders(t: Translate): Array<Record<string, unknown>> {
  return PRO_APP_CODES.map((code) => {
    const meta = PRO_PLACEHOLDER_META[code];
    return {
      uuid: `placeholder-${code}`,
      code,
      name: t(meta.nameKey, { defaultValue: meta.nameDefault }),
      description: t(meta.descKey, { defaultValue: meta.descDefault }),
      is_pro: true,
      can_access: false,
      is_installed: false,
      is_active: false,
      is_system: false,
      is_placeholder: true,
      sort_order: meta.sort_order,
      version: meta.version,
    };
  });
}

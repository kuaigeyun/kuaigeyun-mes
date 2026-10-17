import { isProIndustryAppCode } from './industryAppCatalog';

/**
 * 专业版应用清单与前端占位（未 compose / 未入库时展示于应用中心「专业」）。
 * 与 core/config/pro_app_catalog.py 的 PRO_APP_CODES 保持一致。
 *
 * 应用排序唯一真源：各应用 manifest.json → core_applications.sort_order（API 返回）。
 * 未入库占位使用同一 PRO 段编号，KU-AI 固定末位 350。
 */

export const PRO_APP_CODES = [
  'kuaiplm',
  'kuaipd',
  'kuaioa',
  'kuaicaiwu',
  'kuaiiot',
  'kuaivision',
  'kuaireport',
  'kuaiconnect',
  'kuaiai',
] as const;

export type ProAppCode = (typeof PRO_APP_CODES)[number];

/** 侧栏 PRO 徽标：专业版应用 + 付费行业包（与 License 适用范围一致） */
export function isSidebarProAppCode(code: string | null | undefined): boolean {
  const normalized = String(code ?? '').trim();
  if (!normalized) return false;
  if ((PRO_APP_CODES as readonly string[]).includes(normalized)) return true;
  return isProIndustryAppCode(normalized);
}

/** 专业版应用 sort_order（与 manifest / 迁移一致；KU-AI 末位） */
export const PRO_APP_SORT_ORDER: Record<ProAppCode, number> = {
  kuaiplm: 300,
  kuaipd: 305,
  kuaioa: 310,
  kuaicaiwu: 315,
  kuaiiot: 320,
  kuaivision: 322,
  kuaireport: 325,
  kuaiconnect: 330,
  kuaiai: 350,
};

type ProPlaceholderMeta = {
  nameKey: string;
  descKey: string;
  nameDefault: string;
  descDefault: string;
  version: string;
};

/** 与应用中心 PRO 展示文案键一致 */
export const PRO_PLACEHOLDER_META: Record<ProAppCode, ProPlaceholderMeta> = {
  kuaipd: {
    nameKey: 'sys.app.kuaipd.name',
    descKey: 'sys.app.kuaipd.desc',
    nameDefault: '快交付',
    descDefault: '交付项目、物流与售后履约',
    version: 'PRO',
  },
  kuaiplm: {
    nameKey: 'sys.app.kuaiplm.name',
    descKey: 'sys.app.kuaiplm.desc',
    nameDefault: '快研发',
    descDefault: '研发项目 / NPI 阶段门、设计变更与知识中心协同平台',
    version: 'PRO',
  },
  kuaicaiwu: {
    nameKey: 'sys.app.kuaicaiwu.name',
    descKey: 'sys.app.kuaicaiwu.desc',
    nameDefault: '轻财务',
    descDefault: '管理会计与经营分析协同平台',
    version: 'PRO',
  },
  kuaioa: {
    nameKey: 'sys.app.kuaioa.name',
    descKey: 'sys.app.kuaioa.desc',
    nameDefault: '轻办公',
    descDefault: '轻量办公与协同',
    version: 'PRO',
  },
  kuaireport: {
    nameKey: 'sys.app.kuaireport.name',
    descKey: 'sys.app.kuaireport.desc',
    nameDefault: '快报表',
    descDefault: '多源数据聚合与经营分析决策中心',
    version: 'PRO',
  },
  kuaiiot: {
    nameKey: 'sys.app.kuaiiot.name',
    descKey: 'sys.app.kuaiiot.desc',
    nameDefault: '快数采',
    descDefault: '工业物联网设备数采集成平台',
    version: 'PRO',
  },
  kuaivision: {
    nameKey: 'sys.app.kuaivision.name',
    descKey: 'sys.app.kuaivision.desc',
    nameDefault: '快视觉',
    descDefault: '工业视觉检测：方案、入站结果、原图留痕与复核',
    version: 'PRO',
  },
  kuaiai: {
    nameKey: 'sys.app.kuaiai.name',
    descKey: 'sys.app.kuaiai.desc',
    nameDefault: 'KU-AI',
    descDefault: '嵌入业务场景的 AI 智能辅助引擎',
    version: 'PRO',
  },
  kuaiconnect: {
    nameKey: 'sys.app.kuaiconnect.name',
    descKey: 'sys.app.kuaiconnect.desc',
    nameDefault: '快连接',
    descDefault: '应用连接器、接口、数据源与数据集管理',
    version: 'PRO',
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
      sort_order: PRO_APP_SORT_ORDER[code],
      version: meta.version,
    };
  });
}

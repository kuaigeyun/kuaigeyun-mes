/**
 * 行业应用清单（免费版 / 付费版）。
 *
 * - 免费版：主仓发布，应用中心「行业」分类展示，无需 License Key
 * - 付费版：私仓 kuaigeyun-pro compose 后入库展示，启用需 License Key（无占位卡片）
 *
 * 与 core/config/industry_app_catalog.py 保持一致。
 */

export const FREE_INDUSTRY_APP_CODES = ['spoke-wheel'] as const;

export type FreeIndustryAppCode = (typeof FREE_INDUSTRY_APP_CODES)[number];

/** 付费行业应用 code（私仓实装后入库；用于分类与 License 判定） */
export const PRO_INDUSTRY_APP_CODES = [
  'kuaimachinery',
  'kuaimolding',
  'kuaielectronics',
  'kuaiautoparts',
  'kuaimedical',
  'kuaifood',
  'kuaipackaging',
  'kuaihardware',
  'kuaidiecasting',
  'kuaiwiring',
  'kuaimotor',
  'kuaibattery',
  'kuainewequipment',
  'kuaisheetmetal',
  'kuaimold',
  'kuaisemiconductor',
] as const;

export type ProIndustryAppCode = (typeof PRO_INDUSTRY_APP_CODES)[number];

export const ALL_INDUSTRY_APP_CODES = [
  ...FREE_INDUSTRY_APP_CODES,
  ...PRO_INDUSTRY_APP_CODES,
] as const;

export const FREE_INDUSTRY_SORT_ORDER: Record<FreeIndustryAppCode, number> = {
  'spoke-wheel': 300,
};

/** 侧栏行业包容器（不在应用中心展示） */
export const INDUSTRY_PACK_APP_CODE = 'industry-pack';

export function isIndustryPackShellCode(code: string | undefined | null): boolean {
  return String(code || '') === INDUSTRY_PACK_APP_CODE;
}

export function shouldHideFromApplicationCenter(code: string | undefined | null): boolean {
  return isIndustryPackShellCode(code);
}

/** 行业免费版原作者 GitHub ID（与 manifest author / author_github 一致） */
export const FREE_INDUSTRY_AUTHOR_GITHUB: Record<FreeIndustryAppCode, string> = {
  'spoke-wheel': 'xyt123lyq',
};

export function isFreeIndustryAppCode(code: string | undefined | null): boolean {
  return (FREE_INDUSTRY_APP_CODES as readonly string[]).includes(String(code || ''));
}

export function isProIndustryAppCode(code: string | undefined | null): boolean {
  return (PRO_INDUSTRY_APP_CODES as readonly string[]).includes(String(code || ''));
}

export function isIndustryAppCode(code: string | undefined | null): boolean {
  return isFreeIndustryAppCode(code) || isProIndustryAppCode(code);
}

/** 启用前是否需要 License Key（专业版或付费行业） */
export function requiresProLicense(app: {
  code?: string;
  is_pro?: boolean;
}): boolean {
  if (app?.is_pro) return true;
  return isProIndustryAppCode(app?.code);
}

/** 行业免费包原作者 GitHub 用户名（应用中心编码行展示） */
export function resolveFreeIndustryAuthorUsername(
  code: string | undefined | null,
): string | undefined {
  if (!isFreeIndustryAppCode(code)) return undefined;
  return FREE_INDUSTRY_AUTHOR_GITHUB[code as FreeIndustryAppCode];
}

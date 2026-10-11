/**
 * 行业应用清单（付费 PRO 行业包）。
 *
 * 源码在 kuaigeyun-pro compose 后入库；应用中心「行业」Tab 展示，启用需 License Key。
 *
 * 与 core/config/industry_app_catalog.py 保持一致。
 */

/** @deprecated 开源主仓不再含免费行业源码；保留空数组供类型兼容 */
export const FREE_INDUSTRY_APP_CODES = [] as const;

/** 改编码合并完成前 DB 可能暂留旧 code（见 app_code_renames）；分类仍须归行业 */
export const LEGACY_INDUSTRY_APP_CODES = ['kuaielectronics', 'industry-mold'] as const;

export type FreeIndustryAppCode = never;

/** 付费行业应用 code（私仓实装后入库；用于分类与 License 判定） */
export const PRO_INDUSTRY_APP_CODES = [
  'spoke-wheel',
  'ind-electronics',
  'ind-mold',
  'ind-relay',
  'ind-foreign-trade',
  'kuaimachinery',
  'kuaimolding',
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

export const ALL_INDUSTRY_APP_CODES = [...PRO_INDUSTRY_APP_CODES] as const;

/** 侧栏行业包容器（不在应用中心展示） */
export const INDUSTRY_PACK_APP_CODE = 'industry-pack';

export function isIndustryPackShellCode(code: string | undefined | null): boolean {
  return String(code || '') === INDUSTRY_PACK_APP_CODE;
}

export function shouldHideFromApplicationCenter(code: string | undefined | null): boolean {
  return isIndustryPackShellCode(code);
}

/** @deprecated 无免费行业包 */
export const FREE_INDUSTRY_AUTHOR_GITHUB: Record<string, string> = {};

export function isFreeIndustryAppCode(_code: string | undefined | null): boolean {
  return false;
}

export function isProIndustryAppCode(code: string | undefined | null): boolean {
  return (PRO_INDUSTRY_APP_CODES as readonly string[]).includes(String(code || ''));
}

export function isIndustryAppCode(code: string | undefined | null): boolean {
  const normalized = String(code || '');
  return (
    isProIndustryAppCode(normalized) ||
    (LEGACY_INDUSTRY_APP_CODES as readonly string[]).includes(normalized)
  );
}

/** 启用前是否需要 License Key（专业版或付费行业） */
export function requiresProLicense(app: {
  code?: string;
  is_pro?: boolean;
}): boolean {
  if (app?.is_pro) return true;
  return isProIndustryAppCode(app?.code);
}

/** @deprecated 无免费行业包 */
export function resolveFreeIndustryAuthorUsername(
  _code: string | undefined | null,
): string | undefined {
  return undefined;
}

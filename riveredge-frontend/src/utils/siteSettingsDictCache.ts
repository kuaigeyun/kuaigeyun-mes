/**
 * 站点设置相关字典选项的本地缓存
 * 用于站点设置、初始化向导等页面首帧展示与后端一致的选项文案，避免「先显示后备文案再变成接口文案」的闪烁。
 *
 * 其他可能存在「选项异步加载导致 Select 先显示 value/后备再变接口 label」的页面（按需可复用或扩展缓存）：
 * - 采购订单/销售订单/报价单等：ORDER_TYPE、CURRENCY、SHIPPING_METHOD、PAYMENT_TERMS 等字典
 * - 物料/BOM：MATERIAL_TYPE、MATERIAL_UNIT 等
 * - 质检：DISPOSAL_METHOD、INSPECTION_PLAN_TYPE 等
 * - 字典选择组件 DictionarySelect：按字典 code 缓存可统一避免多处闪烁
 */

const SITE_SETTINGS_DICT_CACHE_KEY = 'site-settings-dict-cache';

/** 与 DictionaryItem 兼容（至少含 label、value），便于站点设置等直接存取 */
export type SiteSettingsDictCache = {
  timezone?: Array<{ label: string; value: string; [key: string]: any }>;
  currency?: Array<{ label: string; value: string; [key: string]: any }>;
  language?: { label: string; value: string; key?: string }[];
};

export function getSiteSettingsDictCache(): SiteSettingsDictCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SITE_SETTINGS_DICT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SiteSettingsDictCache;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function setSiteSettingsDictCache(partial: Partial<SiteSettingsDictCache>): void {
  if (typeof window === 'undefined') return;
  try {
    const prev = getSiteSettingsDictCache() || {};
    const next = { ...prev, ...partial };
    localStorage.setItem(SITE_SETTINGS_DICT_CACHE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

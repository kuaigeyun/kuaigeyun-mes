/**
 * 编码规则功能页面工具函数
 * 
 * 提供获取功能页面配置的工具函数，支持从 localStorage 读取配置。
 */

import { CodeRulePageConfig, getCodeRulePageConfig } from '@/config/codeRulePages';

/**
 * 获取功能页面配置（包含 localStorage 中的配置）
 * 
 * @param pageCode - 页面代码
 * @returns 功能页面配置或 undefined
 */
export function getPageConfig(pageCode: string): CodeRulePageConfig | undefined {
  // 先从默认配置获取
  const defaultConfig = getCodeRulePageConfig(pageCode);
  if (!defaultConfig) {
    return undefined;
  }

  // 从 localStorage 读取保存的配置
  try {
    const savedConfigs = localStorage.getItem('codeRulePageConfigs');
    if (savedConfigs) {
      const parsed = JSON.parse(savedConfigs) as CodeRulePageConfig[];
      const savedConfig = parsed.find(p => p.pageCode === pageCode);
      if (savedConfig) {
        // 合并默认配置和保存的配置
        return { ...defaultConfig, ...savedConfig };
      }
    }
  } catch (error) {
    console.error('读取功能页面配置失败:', error);
  }

  return defaultConfig;
}

/**
 * 检查功能页面是否启用自动编码
 * 
 * @param pageCode - 页面代码
 * @returns 是否启用自动编码
 */
export function isAutoGenerateEnabled(pageCode: string): boolean {
  const config = getPageConfig(pageCode);
  return !!(config?.autoGenerate && config?.ruleCode);
}

/**
 * 获取功能页面的编码规则代码
 * 
 * @param pageCode - 页面代码
 * @returns 编码规则代码或 undefined
 */
export function getPageRuleCode(pageCode: string): string | undefined {
  const config = getPageConfig(pageCode);
  return config?.ruleCode;
}


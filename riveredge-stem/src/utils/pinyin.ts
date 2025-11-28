/**
 * 拼音工具函数
 * 
 * 提供中文拼音首字母转换和匹配功能，支持拼音首字母模糊搜索
 */

/**
 * 判断文本是否为拼音首字母格式
 * 
 * @param text - 要判断的文本
 * @returns 是否为拼音首字母格式（全字母，1-10个字符）
 * 
 * @example
 * ```typescript
 * isPinyinKeyword("ZS") // true
 * isPinyinKeyword("张三") // false
 * isPinyinKeyword("test123") // false
 * ```
 */
export function isPinyinKeyword(text: string): boolean {
  if (!text) return false;
  // 判断是否为全字母且长度合理（1-10 个字符）
  return /^[a-zA-Z]{1,10}$/.test(text);
}

// 拼音库（可选依赖，全局缓存，避免重复加载）
let pinyinLib: any = null;
let pinyinLibLoaded = false;

/**
 * 初始化拼音库（延迟加载，只加载一次）
 */
function initPinyinLib() {
  if (!pinyinLibLoaded) {
    pinyinLibLoaded = true;
    try {
      // 动态导入 pinyin-pro（如果可用）
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pinyinPro = require('pinyin-pro');
      pinyinLib = pinyinPro; // 保存整个模块
    } catch (error) {
      // 静默失败，不输出警告（避免控制台噪音）
      pinyinLib = false; // 标记为不可用
    }
  }
  return pinyinLib;
}

/**
 * 获取中文文本的拼音首字母
 * 
 * 注意：此函数需要 pinyin-pro 库支持
 * 如果未安装 pinyin-pro，将返回空字符串
 * 
 * @param text - 中文文本
 * @returns 拼音首字母字符串（如："张三" -> "ZS"）
 * 
 * @example
 * ```typescript
 * getPinyinInitials("张三") // "ZS"
 * getPinyinInitials("测试组织") // "CSZZ"
 * ```
 */
export function getPinyinInitials(text: string): string {
  if (!text) return "";
  
  const pinyin = initPinyinLib();
  if (!pinyin) {
    // 如果 pinyin-pro 不可用，返回空字符串
    return "";
  }
  
  try {
    // 提取拼音首字母，统一转换为大写
    // pinyin-pro 的 API: pinyin(text, { pattern: 'first', toneType: 'none' })
    const initials = pinyin.pinyin(text, { pattern: 'first', toneType: 'none' });
    return initials.replace(/\s+/g, '').toUpperCase();
  } catch (error) {
    return "";
  }
}

/**
 * 检查文本的拼音首字母是否匹配关键词
 * 
 * @param text - 要匹配的文本
 * @param keyword - 搜索关键词（拼音首字母）
 * @returns 是否匹配
 * 
 * @example
 * ```typescript
 * matchPinyinInitials("张三", "ZS") // true
 * matchPinyinInitials("李四", "LS") // true
 * matchPinyinInitials("王五", "WW") // true
 * ```
 */
export function matchPinyinInitials(text: string, keyword: string): boolean {
  if (!text || !keyword) return false;
  
  // 获取文本的拼音首字母
  const textInitials = getPinyinInitials(text);
  if (!textInitials) return false;
  
  const keywordUpper = keyword.toUpperCase();
  
  // 检查拼音首字母是否包含关键词
  return textInitials.includes(keywordUpper);
}

/**
 * 根据拼音首字母过滤选项数组
 * 
 * @param options - 选项数组
 * @param keyword - 搜索关键词
 * @returns 过滤后的选项数组
 * 
 * @example
 * ```typescript
 * const options = [
 *   { label: "张三", value: "zhangsan" },
 *   { label: "李四", value: "lisi" }
 * ];
 * filterByPinyinInitials(options, "ZS")
 * // 返回: [{ label: "张三", value: "zhangsan" }]
 * ```
 */
export function filterByPinyinInitials<T extends { label: string; value: string }>(
  options: T[],
  keyword: string
): T[] {
  if (!keyword || !options.length) return options;
  
  const keywordUpper = keyword.toUpperCase();
  
  return options.filter((option) => {
    // 1. 文本匹配
    const textMatch = 
      option.label.toLowerCase().includes(keyword.toLowerCase()) ||
      option.value.toLowerCase().includes(keyword.toLowerCase());
    
    // 2. 拼音首字母匹配
    const pinyinMatch = matchPinyinInitials(option.label, keywordUpper) ||
                        matchPinyinInitials(option.value, keywordUpper);
    
    return textMatch || pinyinMatch;
  });
}


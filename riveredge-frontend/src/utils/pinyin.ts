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
let pinyinLibLoading = false;
let pinyinLibInitPromise: Promise<any> | null = null;

/**
 * 初始化拼音库（延迟加载，只加载一次）
 */
async function initPinyinLib(): Promise<any> {
  if (pinyinLibLoaded) {
    return pinyinLib;
  }
  
  // 如果已经有初始化 Promise，等待它完成
  if (pinyinLibInitPromise) {
    return await pinyinLibInitPromise;
  }
  
  // 创建初始化 Promise
  pinyinLibInitPromise = (async () => {
    if (pinyinLibLoading) {
      // 如果正在加载，等待加载完成
      while (pinyinLibLoading) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      return pinyinLib;
    }
    
    pinyinLibLoading = true;
    try {
      // 使用动态导入（ES6 import）
      const pinyinPro = await import('pinyin-pro');
      pinyinLib = pinyinPro; // 保存整个模块
      pinyinLibLoaded = true;
    } catch (error) {
      // 输出警告，方便调试
      console.warn('pinyin-pro 库加载失败，拼音搜索功能将不可用:', error);
      pinyinLib = false; // 标记为不可用
      pinyinLibLoaded = true;
    } finally {
      pinyinLibLoading = false;
    }
    return pinyinLib;
  })();
  
  return await pinyinLibInitPromise;
}

/**
 * 预加载拼音库（在应用启动时调用）
 */
export async function preloadPinyinLib(): Promise<void> {
  await initPinyinLib();
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
  
  // 同步版本：如果库已加载，直接使用；否则返回空字符串
  if (!pinyinLibLoaded || !pinyinLib) {
    // 如果库未加载，尝试同步初始化（仅当库已加载时）
    return "";
  }
  
  try {
    // 提取拼音首字母，统一转换为大写
    // pinyin-pro 的 API: pinyin(text, { pattern: 'first', toneType: 'none' })
    // 返回格式：'z s' (空格分隔的拼音首字母)
    const pinyinFunc = pinyinLib.pinyin;
    if (typeof pinyinFunc === 'function') {
      const result = pinyinFunc(text, { pattern: 'first', toneType: 'none' });
      // 移除空格并转换为大写
      return result.replace(/\s+/g, '').toUpperCase();
    } else {
      console.warn('pinyin-pro 库的 pinyin 方法不可用', { pinyinLib, hasPinyin: !!pinyinLib.pinyin });
      return "";
    }
  } catch (error) {
    console.warn('获取拼音首字母失败:', error);
    return "";
  }
}

/**
 * 异步获取拼音首字母（推荐使用）
 */
export async function getPinyinInitialsAsync(text: string): Promise<string> {
  if (!text) return "";
  
  const pinyin = await initPinyinLib();
  if (!pinyin) {
    // 如果 pinyin-pro 不可用，返回空字符串
    return "";
  }
  
  try {
    // 提取拼音首字母，统一转换为大写
    // pinyin-pro 的 API: pinyin(text, { pattern: 'first', toneType: 'none' })
    // 返回格式：'z s' (空格分隔的拼音首字母)
    const pinyinFunc = pinyin.pinyin;
    if (typeof pinyinFunc === 'function') {
      const result = pinyinFunc(text, { pattern: 'first', toneType: 'none' });
      // 移除空格并转换为大写
      return result.replace(/\s+/g, '').toUpperCase();
    } else {
      console.warn('pinyin-pro 库的 pinyin 方法不可用（异步版本）', { pinyin, hasPinyin: !!pinyin.pinyin });
      return "";
    }
  } catch (error) {
    console.warn('获取拼音首字母失败:', error);
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
  if (!textInitials) {
    // 如果同步获取失败，尝试异步获取（但这是同步函数，所以先返回 false）
    // 实际使用中应该使用异步版本
    return false;
  }
  
  const keywordUpper = keyword.toUpperCase();
  
  // 检查拼音首字母是否包含关键词
  return textInitials.includes(keywordUpper);
}

/**
 * 异步匹配拼音首字母（推荐使用）
 */
export async function matchPinyinInitialsAsync(text: string, keyword: string): Promise<boolean> {
  if (!text || !keyword) return false;
  
  // 获取文本的拼音首字母
  const textInitials = await getPinyinInitialsAsync(text);
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


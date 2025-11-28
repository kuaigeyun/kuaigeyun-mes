/**
 * 本地存储工具函数
 * 
 * 提供统一的本地存储操作接口
 */

/**
 * 设置本地存储
 * 
 * @param key - 存储键名
 * @param value - 存储值
 */
export function setStorage(key: string, value: any): void {
  try {
    const serializedValue = JSON.stringify(value);
    localStorage.setItem(key, serializedValue);
  } catch (error) {
    // 静默处理错误
  }
}

/**
 * 获取本地存储
 * 
 * @param key - 存储键名
 * @returns 存储值
 */
export function getStorage<T = any>(key: string): T | null {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    return null;
  }
}

/**
 * 移除本地存储
 * 
 * @param key - 存储键名
 */
export function removeStorage(key: string): void {
  localStorage.removeItem(key);
}

/**
 * 清空本地存储
 */
export function clearStorage(): void {
  localStorage.clear();
}


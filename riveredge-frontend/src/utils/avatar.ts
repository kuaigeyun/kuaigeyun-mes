/**
 * 头像工具函数
 *
 * 提供统一的头像显示逻辑：
 * - 如果用户上传过头像，显示图片头像
 * - 如果未上传过，显示文字头像（首字母）
 * - 支持 URL 缓存，减少重复请求和首屏闪烁
 */

import { getFilePreview } from '../services/file';

const AVATAR_CACHE_PREFIX = 'avatarUrlCache_';

/** 将 127.0.0.1/localhost 绝对 URL 转为相对路径，便于局域网访问 */
function toRelativeIfLocalhost(url: string): string {
  if (!url || typeof url !== 'string') return url;
  try {
    const u = new URL(url, 'http://dummy');
    if (u.hostname === '127.0.0.1' || u.hostname === 'localhost') {
      return u.pathname + u.search;
    }
  } catch {
    /* ignore */
  }
  return url;
}
const AVATAR_CACHE_TTL_MS = 30 * 60 * 1000; // 30 分钟

function getAvatarCacheKey(avatarUuid: string): string {
  return `${AVATAR_CACHE_PREFIX}${avatarUuid}`;
}

/** 从缓存读取头像 URL（含 TTL 校验），自动将 localhost 绝对 URL 转为相对路径 */
export function getCachedAvatarUrl(avatarUuid: string | undefined): string | undefined {
  if (!avatarUuid || typeof window === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem(getAvatarCacheKey(avatarUuid));
    if (!raw) return undefined;
    const { url, ts } = JSON.parse(raw);
    if (!url || typeof ts !== 'number') return undefined;
    if (Date.now() - ts > AVATAR_CACHE_TTL_MS) return undefined;
    return toRelativeIfLocalhost(url);
  } catch {
    return undefined;
  }
}

/** 写入头像 URL 缓存 */
export function setCachedAvatarUrl(avatarUuid: string | undefined, url: string | undefined): void {
  if (!avatarUuid || typeof window === 'undefined') return;
  try {
    if (!url) {
      localStorage.removeItem(getAvatarCacheKey(avatarUuid));
      return;
    }
    localStorage.setItem(getAvatarCacheKey(avatarUuid), JSON.stringify({ url, ts: Date.now() }));
  } catch (_) {}
}

/** 进行中的请求，避免同一 UUID 重复拉取 */
const inFlightMap = new Map<string, Promise<string | undefined>>();

/**
 * 获取头像预览 URL
 *
 * 优先使用缓存；同 UUID 并发请求会复用同一 Promise，避免重复拉取
 *
 * @param avatarUuid - 头像文件 UUID
 * @returns 预览 URL 或 undefined
 */
export async function getAvatarUrl(avatarUuid: string | undefined): Promise<string | undefined> {
  if (!avatarUuid) return undefined;

  const cached = getCachedAvatarUrl(avatarUuid);
  if (cached) return cached;

  let promise = inFlightMap.get(avatarUuid);
  if (!promise) {
    promise = (async () => {
      try {
        const previewInfo = await getFilePreview(avatarUuid);
        const previewUrl = previewInfo.preview_url;
        if (previewUrl) {
          const normalized = toRelativeIfLocalhost(previewUrl);
          setCachedAvatarUrl(avatarUuid, normalized);
          return normalized;
        }
        return undefined;
      } catch (error) {
        console.error('获取头像预览 URL 失败:', error);
        return undefined;
      } finally {
        inFlightMap.delete(avatarUuid);
      }
    })();
    inFlightMap.set(avatarUuid, promise);
  }
  return promise;
}

/** 预取头像 URL，供应用启动时尽早调用以缩短首屏显示延迟 */
export function prefetchAvatarUrl(avatarUuid: string | undefined): void {
  if (!avatarUuid) return;
  if (getCachedAvatarUrl(avatarUuid)) return;
  getAvatarUrl(avatarUuid).catch(() => {});
}

/**
 * 获取用户头像显示文本（首字母）
 * 
 * @param fullName - 用户全名
 * @param username - 用户名
 * @returns 首字母（大写）
 */
export function getAvatarText(fullName?: string, username?: string): string {
  // 优先使用全名的第一个字，如果全名为空则使用用户名的第一个字符
  const displayName = fullName || username || '';
  return displayName[0]?.toUpperCase() || 'U';
}

/**
 * 根据头像大小计算合适的字体大小
 * 
 * @param avatarSize - 头像大小（像素）
 * @returns 字体大小（像素）
 */
export function getAvatarFontSize(avatarSize: number): number {
  // 字体大小约为头像大小的 50-60%，确保文字在头像中居中且清晰可见
  // 对于小头像（< 40px），使用 50%
  // 对于中等头像（40-80px），使用 55%
  // 对于大头像（> 80px），使用 60%
  if (avatarSize < 40) {
    return Math.round(avatarSize * 0.5);
  } else if (avatarSize <= 80) {
    return Math.round(avatarSize * 0.55);
  } else {
    return Math.round(avatarSize * 0.6);
  }
}


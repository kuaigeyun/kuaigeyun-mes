/**
 * 头像工具函数
 * 
 * 提供统一的头像显示逻辑：
 * - 如果用户上传过头像，显示图片头像
 * - 如果未上传过，显示文字头像（首字母）
 */

import { getFilePreview, getFileDownloadUrl } from '../services/file';

/**
 * 获取头像预览 URL
 * 
 * 优先使用预览 API，如果失败则回退到下载 URL
 * 
 * @param avatarUuid - 头像文件 UUID
 * @returns 预览 URL 或下载 URL，如果获取失败返回 undefined
 */
export async function getAvatarUrl(avatarUuid: string | undefined): Promise<string | undefined> {
  if (!avatarUuid) {
    return undefined;
  }
  
  try {
    const previewInfo = await getFilePreview(avatarUuid);
    const previewUrl = previewInfo.preview_url;
    
    // 验证预览 URL 格式（应该是包含 token 的下载 URL）
    if (previewUrl && previewUrl.includes('/download?token=')) {
      return previewUrl;
    } else {
      return previewUrl; // 仍然返回，让浏览器尝试加载
    }
  } catch (error) {
    console.error('获取头像预览 URL 失败:', error);
    
    // 如果预览 API 失败（通常是组织上下文问题），尝试获取文件信息后构造下载 URL
    // 但这种方式需要 token，而预览 API 失败通常意味着权限问题
    // 所以这里直接返回 undefined，让前端显示文字头像
    return undefined;
  }
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


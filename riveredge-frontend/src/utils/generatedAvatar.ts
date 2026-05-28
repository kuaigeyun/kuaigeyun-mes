/**
 * DiceBear Notionists 生成头像（B 端商务插画风，HTTP API，无前端打包依赖）。
 *
 * 回退：将 PROFILE_AVATAR_USE_NOTIONISTS 设为 false，或删除本文件及 ProfileNotionistsAvatar 引用。
 */

/** 设为 false 时个人资料页回退为纯色底 + 首字母 */
export const PROFILE_AVATAR_USE_NOTIONISTS = true;

const NOTIONISTS_STYLE = 'notionists';
const NOTIONISTS_VERSION = '9.x';
const B2B_BACKGROUND = 'e8eef4,dfe6ee,d4dce6,c9d4e3';

export function resolveProfileAvatarSeed(input: {
  uuid?: string | null;
  username?: string | null;
  email?: string | null;
}): string {
  const seed =
    (input.uuid && String(input.uuid).trim()) ||
    (input.username && String(input.username).trim()) ||
    (input.email && String(input.email).trim()) ||
    'riveredge-user';
  return seed;
}

/** 生成 Notionists SVG 地址（稳定 seed → 稳定头像） */
export function buildNotionistsAvatarUrl(seed: string, size = 128): string {
  const params = new URLSearchParams({
    seed,
    size: String(Math.max(32, Math.round(size))),
    backgroundColor: B2B_BACKGROUND,
    radius: '50',
  });
  return `https://api.dicebear.com/${NOTIONISTS_VERSION}/${NOTIONISTS_STYLE}/svg?${params.toString()}`;
}

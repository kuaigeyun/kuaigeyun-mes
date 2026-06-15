/**
 * DiceBear Notionists 生成头像（B 端商务插画风，浏览器本地生成）。
 *
 * 不在 API 上单独传「性别」参数；仅根据用户资料性别写入 seed 前缀，
 * 由 Notionists 随机出不同形象。未设置资料性别时按男性处理。
 *
 * 回退：将 PROFILE_AVATAR_USE_NOTIONISTS 设为 false。
 */

import { createAvatar } from '@dicebear/core';
import { create as createNotionists, meta as notionistsMeta, schema as notionistsSchema } from '@dicebear/notionists';

/** 设为 false 时个人资料页无生成头像，仅首字母 */
export const PROFILE_AVATAR_USE_NOTIONISTS = true;

const B2B_BACKGROUND = ['e8eef4', 'dfe6ee', 'd4dce6', 'c9d4e3'] as const;

const notionistsStyle = {
  meta: notionistsMeta,
  create: createNotionists,
  schema: notionistsSchema,
} as const;

export type ProfileAvatarGender = 'male' | 'female';

/** 用户资料性别：仅 female 为女性，其余（含未设置）为男性 */
export function normalizeProfileGender(gender?: string | null): ProfileAvatarGender {
  return gender === 'female' ? 'female' : 'male';
}

/** 将资料性别编入 seed，供 DiceBear 区分随机结果 */
export function buildGenderedAvatarSeed(
  seed: string,
  gender?: string | null,
): string {
  const g = normalizeProfileGender(gender);
  return `${g}:${seed}`;
}

export function resolveStableAvatarSeed(input: {
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

export function createRandomAvatarSeed(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** 「换一换」一次展示的备选数量 */
export const AVATAR_SHUFFLE_CANDIDATE_COUNT = 5;

export type AvatarCandidate = {
  seed: string;
  /** SVG data URI，用于 img 预览 */
  url: string;
};

type GeneratedAvatarOptions = {
  seed: string;
  gender?: string | null;
  size?: number;
};

function createNotionistsAvatar(options: GeneratedAvatarOptions) {
  const size = Math.max(32, Math.round(options.size ?? 128));
  return createAvatar(notionistsStyle, {
    seed: buildGenderedAvatarSeed(options.seed, options.gender),
    size,
    backgroundColor: [...B2B_BACKGROUND],
    radius: 50,
  });
}

/**
 * @param options.gender 用户资料中的性别（male/female）
 * @returns SVG data URI，可直接用于 img src
 */
export function buildGeneratedAvatarUrl(options: GeneratedAvatarOptions): string {
  return createNotionistsAvatar(options).toDataUri();
}

export function buildAvatarCandidateBatch(
  gender?: string | null,
  count: number = AVATAR_SHUFFLE_CANDIDATE_COUNT,
): AvatarCandidate[] {
  return Array.from({ length: count }, () => {
    const seed = createRandomAvatarSeed();
    return {
      seed,
      url: buildGeneratedAvatarUrl({ seed, gender, size: 128 }),
    };
  });
}

async function dataUriToPngBlob(dataUri: string, size: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('canvas context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, size, size);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('canvas toBlob failed'))),
        'image/png',
      );
    };
    img.onerror = () => reject(new Error('avatar image load failed'));
    img.src = dataUri;
  });
}

/** 将生成头像转为 PNG Blob，供上传保存 */
export async function generatedAvatarToPngBlob(
  options: GeneratedAvatarOptions,
): Promise<Blob> {
  const size = Math.max(32, Math.round(options.size ?? 128));
  const dataUri = createNotionistsAvatar({ ...options, size }).toDataUri();
  return dataUriToPngBlob(dataUri, size);
}

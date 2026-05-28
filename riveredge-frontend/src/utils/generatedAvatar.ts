/**
 * DiceBear Notionists 生成头像（B 端商务插画风，HTTP API）。
 *
 * 不在 API 上单独传「性别」参数；仅根据用户资料性别写入 seed 前缀，
 * 由 Notionists 随机出不同形象。未设置资料性别时按男性处理。
 *
 * 回退：将 PROFILE_AVATAR_USE_NOTIONISTS 设为 false。
 */

/** 设为 false 时个人资料页无生成头像，仅首字母 */
export const PROFILE_AVATAR_USE_NOTIONISTS = true;

const DICEBEAR_VERSION = '9.x';
const NOTIONISTS_STYLE = 'notionists';
const B2B_BACKGROUND = 'e8eef4,dfe6ee,d4dce6,c9d4e3';

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
  url: string;
};

export function buildAvatarCandidateBatch(
  gender?: string | null,
  count: number = AVATAR_SHUFFLE_CANDIDATE_COUNT,
): AvatarCandidate[] {
  return Array.from({ length: count }, () => {
    const seed = createRandomAvatarSeed();
    return {
      seed,
      url: buildGeneratedAvatarUrl({ seed, gender, size: 128, format: 'png' }),
    };
  });
}

/**
 * @param options.gender 用户资料中的性别（male/female）
 */
export function buildGeneratedAvatarUrl(options: {
  seed: string;
  gender?: string | null;
  size?: number;
  /** 上传保存用 png（服务端缩略图与 img 兼容更好），展示默认 svg */
  format?: 'svg' | 'png';
}): string {
  const size = Math.max(32, Math.round(options.size ?? 128));
  const format = options.format ?? 'svg';
  const params = new URLSearchParams({
    seed: buildGenderedAvatarSeed(options.seed, options.gender),
    size: String(size),
    backgroundColor: B2B_BACKGROUND,
    radius: '50',
  });
  return `https://api.dicebear.com/${DICEBEAR_VERSION}/${NOTIONISTS_STYLE}/${format}?${params.toString()}`;
}

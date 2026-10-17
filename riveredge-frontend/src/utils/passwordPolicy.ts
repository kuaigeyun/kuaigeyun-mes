/**
 * 租户登录密码策略（与 GET /site-settings/password-policy 对齐）
 */

import type { TFunction } from 'i18next';

export type PasswordMode = 'simple' | 'strengthened';

export interface PublicPasswordPolicy {
  mode: PasswordMode;
  min_length: number;
  min_char_classes: number;
  check_personal_weak: boolean;
  max_age_days: number;
  reset_help: string;
}

export function countPasswordCharClasses(password: string): number {
  let n = 0;
  if (/[a-z]/.test(password)) n += 1;
  if (/[A-Z]/.test(password)) n += 1;
  if (/\d/.test(password)) n += 1;
  if (/[^A-Za-z0-9]/.test(password)) n += 1;
  return n;
}

function normalizeToken(value: string | undefined | null): string {
  return (value ?? '').trim().toLowerCase();
}

export function passwordContainsPersonalToken(password: string, token: string | undefined | null): boolean {
  const p = normalizeToken(password);
  const t = normalizeToken(token);
  if (!p || !t || t.length < 2) return false;
  return p.includes(t);
}

export type PasswordPersonalContext = {
  username?: string | null;
  full_name?: string | null;
  phone?: string | null;
};

export function validatePasswordAgainstPolicy(
  password: string,
  policy: PublicPasswordPolicy,
  personal?: PasswordPersonalContext,
): string | null {
  if (!password || password.length < policy.min_length) {
    return 'min_length';
  }
  if (password.length > 128) {
    return 'max_length';
  }
  if (policy.mode !== 'strengthened') {
    return null;
  }
  if (policy.min_char_classes > 0 && countPasswordCharClasses(password) < policy.min_char_classes) {
    return 'char_classes';
  }
  if (policy.check_personal_weak && personal) {
    const tokens = [personal.username, personal.full_name, personal.phone];
    if (personal.phone && personal.phone.length >= 4) {
      tokens.push(personal.phone.slice(-4));
    }
    for (const token of tokens) {
      if (passwordContainsPersonalToken(password, token)) {
        return 'personal_weak';
      }
    }
  }
  return null;
}

export function buildAntdPasswordRules(
  policy: PublicPasswordPolicy | null | undefined,
  t: TFunction,
  personal?: PasswordPersonalContext,
) {
  const minLen = policy?.min_length ?? 8;
  return [
    { required: true, message: t('pages.personal.profile.newPassword') },
    { max: 128, message: t('pages.login.passwordLenMax') },
    {
      validator: async (_: unknown, value: string) => {
        if (!value) return;
        if (!policy) {
          if (value.length < minLen) {
            throw new Error(t('pages.login.passwordLenDynamic', { min: minLen }));
          }
          return;
        }
        const code = validatePasswordAgainstPolicy(value, policy, personal);
        if (code === 'min_length') {
          throw new Error(t('pages.login.passwordLenDynamic', { min: policy.min_length }));
        }
        if (code === 'max_length') {
          throw new Error(t('pages.login.passwordLenMax'));
        }
        if (code === 'char_classes') {
          throw new Error(
            t('pages.login.passwordCharClassesDynamic', { count: policy.min_char_classes }),
          );
        }
        if (code === 'personal_weak') {
          throw new Error(t('pages.login.passwordPersonalWeak'));
        }
      },
    },
  ];
}

export function passwordPolicyHintLines(
  policy: PublicPasswordPolicy | null | undefined,
  t: TFunction,
): string[] {
  if (!policy) return [];
  const lines: string[] = [
    t('pages.login.passwordLenDynamic', { min: policy.min_length }),
  ];
  if (policy.mode === 'strengthened') {
    if (policy.min_char_classes > 0) {
      lines.push(t('pages.login.passwordCharClassesDynamic', { count: policy.min_char_classes }));
    }
    if (policy.check_personal_weak) {
      lines.push(t('pages.login.passwordPersonalWeakHint'));
    }
    if (policy.max_age_days > 0) {
      lines.push(t('pages.login.passwordMaxAgeDynamic', { days: policy.max_age_days }));
    }
  }
  return lines;
}

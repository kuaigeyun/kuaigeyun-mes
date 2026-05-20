/**
 * 注册用户名保留字（与后端 infra.domain.security.reserved_username 保持一致）
 */

const RESERVED_USERNAME_EXACT = new Set([
  'admin',
  'administrator',
  'adm',
  'root',
  'superadmin',
  'super',
  'sysadmin',
  'system',
  'sys',
  'manager',
  'operator',
  'webmaster',
  'master',
  'support',
  'service',
  'test',
  'demo',
  'guest',
  'superuser',
  'moderator',
  'owner',
  'boss',
  'sa',
  'dba',
  'devops',
  'postmaster',
  'nginx',
  'apache',
  'tomcat',
  'mysql',
  'postgres',
  'oracle',
  'redis',
  'nacos',
  'console',
  'dashboard',
  'api',
  'www',
  'mail',
  'ftp',
  'null',
  'undefined',
  'anonymous',
  'nobody',
]);

const RESERVED_USERNAME_PREFIXES = [
  'admin',
  'administrator',
  'root',
  'superadmin',
  'sysadmin',
  'system',
] as const;

function normalizeUsernameKey(username: string): string {
  return username.trim().toLowerCase().replace(/[_-]/g, '');
}

export function isReservedUsername(username: string): boolean {
  if (!username?.trim()) return false;
  const key = normalizeUsernameKey(username);
  if (!key) return false;
  if (RESERVED_USERNAME_EXACT.has(key)) return true;
  for (const prefix of RESERVED_USERNAME_PREFIXES) {
    if (key === prefix) return true;
    if (key.startsWith(prefix)) {
      const suffix = key.slice(prefix.length);
      if (/^\d+$/.test(suffix)) return true;
    }
  }
  return false;
}

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
  'infraadmin',
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

const RESERVED_USERNAME_PREFIXES = ['admin', 'administrator', 'root', 'superadmin', 'sysadmin', 'system', 'infraadmin'];

export function normalizeUsernameKey(username: string): string {
  return username.trim().toLowerCase().replace(/[_-]/g, '');
}

export function isPlatformSuperadminUsername(username: string): boolean {
  const raw = username.trim().toLowerCase();
  return raw === 'infra_admin' || normalizeUsernameKey(username) === 'infraadmin';
}

export function isReservedUsername(username: string): boolean {
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

export function validateTenantUsernameInput(username: string): string | null {
  const cleaned = username.trim();
  if (!cleaned) return null;
  if (isPlatformSuperadminUsername(cleaned)) {
    return 'platformSuperadminReserved';
  }
  if (isReservedUsername(cleaned)) {
    return 'reserved';
  }
  return null;
}

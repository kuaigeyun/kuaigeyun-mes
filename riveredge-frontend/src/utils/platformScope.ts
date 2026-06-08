/**
 * 平台级路由作用域（/infra/*）。
 * 此类页面不走租户 manifest permission_code，由平台会话 + 后端 infra API 鉴权。
 */
export function isPlatformInfraPath(pathname: string): boolean {
  return pathname === '/infra' || pathname.startsWith('/infra/');
}

/**
 * 组织入口路由：/{tenantDomain} → 登录页（地址栏保持字面路径）
 */
import React from 'react';
import { useParams } from 'react-router-dom';
import {
  isStaticLikePathSegment,
  TENANT_PATH_RESERVED_SEGMENTS,
} from '../utils/tenantDomainAccess';
import { isReservedTenantDomain } from '../utils/reservedTenantDomain';

const LoginPage = React.lazy(() => import('../pages/login'));

/**
 * 单段路径组织入口。静态样 / 保留字不渲染登录（由 Caddy 或其它路由处理）。
 */
export default function TenantDomainLoginRoute() {
  const { tenantDomain } = useParams<{ tenantDomain: string }>();
  const segment = (tenantDomain || '').trim().toLowerCase();

  if (
    !segment ||
    isStaticLikePathSegment(segment) ||
    TENANT_PATH_RESERVED_SEGMENTS.has(segment) ||
    isReservedTenantDomain(segment)
  ) {
    return null;
  }

  return (
    <React.Suspense fallback={null}>
      <LoginPage />
    </React.Suspense>
  );
}

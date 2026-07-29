/**
 * 将 /INFRA、/Infra/login 等大小写变体规范化为小写 /infra/*，并在入口 /infra 跳转到登录页。
 * 须在 React Router 子树内挂载（BrowserRouter 之下）。
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import {
  canonicalizePlatformInfraPathname,
  isPlatformAdminEntryPathname,
} from '../utils/platformScope';

const PlatformInfraPathNormalizer: React.FC = () => {
  const location = useLocation();
  const { pathname, search, hash } = location;

  if (isPlatformAdminEntryPathname(pathname)) {
    return <Navigate to={`/infra/login${search}${hash}`} replace />;
  }

  const canonical = canonicalizePlatformInfraPathname(pathname);
  if (!canonical) {
    return null;
  }

  const normalizedInput = (pathname || '').replace(/\/+$/, '') || '/';
  if (normalizedInput !== canonical) {
    return <Navigate to={`${canonical}${search}${hash}`} replace />;
  }

  return null;
};

export default PlatformInfraPathNormalizer;

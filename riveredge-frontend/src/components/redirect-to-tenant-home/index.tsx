import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageSkeleton from '../page-skeleton';
import { resolvePostLoginHomePath } from '../../utils/tenantHomePath';

/** 拉取租户有效首页后跳转（自定义首页优先，避免同步落应用中心触发权限弹窗） */
export default function RedirectToTenantHome() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    void resolvePostLoginHomePath().then((path) => {
      if (!cancelled) navigate(path, { replace: true });
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return <PageSkeleton />;
}

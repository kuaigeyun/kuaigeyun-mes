import { Navigate } from 'react-router-dom';
import { getDefaultTenantHomePath } from '../../stores/configStore';

/** 已登录访问 /login：立刻跳到本地默认首页（自定义首页由 refinePostLoginHomeInBackground 后台修正） */
export default function RedirectToTenantHome() {
  return <Navigate to={getDefaultTenantHomePath()} replace />;
}

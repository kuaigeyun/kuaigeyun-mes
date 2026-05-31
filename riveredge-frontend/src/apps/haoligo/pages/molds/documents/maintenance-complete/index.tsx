/** 旧路径保留：跳转至模具保养完成单 */
import { Navigate } from 'react-router-dom';

export default function MoldMaintenanceCompleteLegacyRedirect() {
  return <Navigate to="/apps/haoligo/molds/documents/upkeep-complete" replace />;
}

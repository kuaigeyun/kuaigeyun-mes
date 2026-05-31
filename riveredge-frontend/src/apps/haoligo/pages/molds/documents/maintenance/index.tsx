/** 旧路径保留：跳转至模具保养单 */
import { Navigate } from 'react-router-dom';

export default function MoldMaintenanceLegacyRedirect() {
  return <Navigate to="/apps/haoligo/molds/documents/upkeep" replace />;
}

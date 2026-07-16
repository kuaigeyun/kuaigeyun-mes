/**
 * 全局准备：API 登录生成 storageState，并刷新账号可见路由清单。
 */
import { buildStorageState, fetchLeafRoutes } from './helpers/session';

export default async function globalSetup() {
  const token = await buildStorageState();
  const routes = await fetchLeafRoutes(token);
  console.log(`[e2e setup] storageState 就绪，菜单叶子路由 ${routes.length} 条`);
}

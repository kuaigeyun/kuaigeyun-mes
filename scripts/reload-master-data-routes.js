/**
 * 重新加载 master-data 应用路由脚本
 * 
 * 使用方法：
 * 1. 在浏览器中打开任意页面（确保已登录）
 * 2. 打开浏览器控制台（F12）
 * 3. 复制此文件内容到控制台执行
 * 或者
 * 在浏览器控制台中直接执行以下代码：
 */

(async function reloadMasterDataRoutes() {
  try {
    // 获取Token和Tenant ID
    const token = localStorage.getItem('token');
    const tenantId = localStorage.getItem('tenant_id');
    
    if (!token) {
      console.error('❌ 未找到Token，请先登录系统');
      alert('❌ 未找到Token，请先登录系统');
      return;
    }
    
    if (!tenantId) {
      console.error('❌ 未找到组织ID，请先选择组织');
      alert('❌ 未找到组织ID，请先选择组织');
      return;
    }
    
    console.log('🔄 开始重新加载 master-data 应用路由...');
    console.log('Token:', token.substring(0, 20) + '...');
    console.log('Tenant ID:', tenantId);
    
    // 调用热重载API
    const response = await fetch('/api/v1/applications/master-data/reload-routes', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Tenant-ID': tenantId,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    console.log('📋 API响应:', result);
    
    if (result.success) {
      console.log('✅ 路由重新加载成功！');
      alert('✅ 路由重新加载成功！\n\n请刷新页面测试物料选择器功能。');
      
      // 可选：自动刷新页面
      // window.location.reload();
    } else {
      console.error('❌ 路由重新加载失败:', result);
      alert('❌ 路由重新加载失败:\n' + (result.detail || result.message || '未知错误') + '\n\n请查看后端日志了解详情。');
    }
  } catch (error) {
    console.error('❌ 请求失败:', error);
    alert('❌ 请求失败: ' + error.message + '\n\n请检查网络连接和后端服务状态。');
  }
})();

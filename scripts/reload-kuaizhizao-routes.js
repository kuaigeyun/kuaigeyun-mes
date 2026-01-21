// 一键重新加载 kuaizhizao 应用路由
// 直接在浏览器控制台（F12）中复制粘贴执行

(async () => {
  const token = localStorage.getItem('token');
  const tenantId = localStorage.getItem('tenant_id');
  
  if (!token || !tenantId) {
    console.error('❌ 请先登录系统');
    alert('❌ 请先登录系统');
    return;
  }
  
  console.log('🔄 正在重新加载 kuaizhizao 应用路由...');
  
  try {
    const response = await fetch('/api/v1/applications/kuaizhizao/reload-routes', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Tenant-ID': tenantId,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('📋 结果:', result);
    
    if (result.success) {
      console.log('✅ 成功！');
      alert('✅ 路由重新加载成功！\n\n请刷新页面测试销售订单功能。');
      window.location.reload();
    } else {
      console.error('❌ 失败:', result);
      alert('❌ 失败: ' + (result.detail || result.message));
    }
  } catch (error) {
    console.error('❌ 错误:', error);
    alert('❌ 错误: ' + error.message);
  }
})();

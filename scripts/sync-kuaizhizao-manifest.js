// 同步 kuaizhizao 应用清单（包括菜单配置）
// 直接在浏览器控制台（F12）中复制粘贴执行

(async () => {
    const token = localStorage.getItem('token');
    const tenantId = localStorage.getItem('tenant_id');

    if (!token || !tenantId) {
        console.error('❌ 请先登录系统');
        alert('❌ 请先登录系统');
        return;
    }

    console.log('🔄 正在同步 kuaizhizao 应用清单...');

    try {
        const response = await fetch('/api/v1/applications/sync-manifest/kuaizhizao', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Tenant-ID': tenantId,
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();
        console.log('📋 结果:', result);

        if (response.ok) {
            console.log('✅ 成功！');
            alert('✅ 应用清单同步成功！\n\n菜单结构已更新，请刷新页面查看。');
            window.location.reload();
        } else {
            console.error('❌ 失败:', result);
            alert('❌ 失败: ' + (result.detail || result.message || '未知错误'));
        }
    } catch (error) {
        console.error('❌ 错误:', error);
        alert('❌ 错误: ' + error.message);
    }
})();

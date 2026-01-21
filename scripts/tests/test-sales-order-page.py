"""
销售订单页面API测试工具

专门测试销售订单页面相关的所有API端点。

Author: Auto (AI Assistant)
Date: 2026-01-19
"""

import sys
import asyncio
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime
import json

# 添加src目录到Python路径
backend_path = Path(__file__).parent.parent / "riveredge-backend"
src_path = backend_path / "src"
sys.path.insert(0, str(src_path))

from fastapi import FastAPI
from httpx import AsyncClient
from server.main import app
import asyncio

# 确保应用路由已注册（执行lifespan）
async def ensure_app_initialized():
    """确保应用已初始化（执行lifespan）"""
    from server.main import lifespan
    async with lifespan(app):
        pass  # lifespan会自动注册路由


# 销售订单页面相关的API端点列表
SALES_ORDER_ENDPOINTS = [
    # 列表和基础操作
    {"path": "/api/v1/apps/kuaizhizao/sales-orders", "method": "GET", "name": "获取销售订单列表"},
    {"path": "/api/v1/apps/kuaizhizao/sales-orders", "method": "POST", "name": "创建销售订单"},
    {"path": "/api/v1/apps/kuaizhizao/sales-orders/1", "method": "GET", "name": "获取销售订单详情"},
    {"path": "/api/v1/apps/kuaizhizao/sales-orders/1", "method": "PUT", "name": "更新销售订单"},
    # 状态流转
    {"path": "/api/v1/apps/kuaizhizao/sales-orders/1/submit", "method": "POST", "name": "提交销售订单"},
    {"path": "/api/v1/apps/kuaizhizao/sales-orders/1/approve", "method": "POST", "name": "审核通过销售订单"},
    {"path": "/api/v1/apps/kuaizhizao/sales-orders/1/reject", "method": "POST", "name": "驳回销售订单"},
    # 业务操作
    {"path": "/api/v1/apps/kuaizhizao/sales-orders/1/push-to-computation", "method": "POST", "name": "下推到需求计算"},
]


async def test_endpoint(
    client: AsyncClient,
    endpoint: Dict[str, Any],
    base_url: str = "http://test",
    token: Optional[str] = None,
    tenant_id: int = 1
) -> Dict[str, Any]:
    """
    测试单个API端点
    
    Returns:
        Dict: 测试结果
    """
    path = endpoint['path']
    method = endpoint['method']
    name = endpoint['name']
    
    headers = {'Content-Type': 'application/json', 'x-tenant-id': str(tenant_id)}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    
    try:
        if method == 'GET':
            response = await client.get(path, headers=headers, timeout=5.0)
        elif method == 'POST':
            response = await client.post(path, headers=headers, json={}, timeout=5.0)
        elif method == 'PUT':
            response = await client.put(path, headers=headers, json={}, timeout=5.0)
        elif method == 'DELETE':
            response = await client.delete(path, headers=headers, timeout=5.0)
        else:
            response = await client.request(method, path, headers=headers, timeout=5.0)
        
        is_accessible = response.status_code != 404
        return {
            'name': name,
            'path': path,
            'method': method,
            'status_code': response.status_code,
            'is_accessible': is_accessible,
            'status': 'success' if is_accessible else 'not_found',
            'response_preview': response.text[:200] if hasattr(response, 'text') else None,
        }
    except Exception as e:
        return {
            'name': name,
            'path': path,
            'method': method,
            'status': 'error',
            'error': str(e),
            'is_accessible': False,
        }


async def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='销售订单页面API测试工具')
    parser.add_argument('--base-url', type=str, default='http://test', help='基础URL')
    parser.add_argument('--token', type=str, default=None, help='认证Token')
    parser.add_argument('--tenant-id', type=int, default=1, help='租户ID')
    parser.add_argument('--output', type=str, default='sales-order-test-results.json', help='输出文件')
    
    args = parser.parse_args()
    
    print("=" * 80)
    print("销售订单页面API测试")
    print("=" * 80)
    print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"基础URL: {args.base_url}")
    print(f"租户ID: {args.tenant_id}")
    print("")
    
    # 确保应用已初始化（执行lifespan以注册路由）
    print("🔄 初始化应用（注册路由）...")
    await ensure_app_initialized()
    print("✅ 应用初始化完成")
    print("")
    
    # 测试所有端点
    print(f"📋 测试 {len(SALES_ORDER_ENDPOINTS)} 个API端点...")
    print("")
    
    results = []
    async with AsyncClient(app=app, base_url=args.base_url) as client:
        for endpoint in SALES_ORDER_ENDPOINTS:
            result = await test_endpoint(client, endpoint, args.base_url, args.token, args.tenant_id)
            results.append(result)
            
            # 实时显示结果
            status_icon = "✅" if result['is_accessible'] else "❌"
            status_text = f"状态码: {result.get('status_code', 'N/A')}" if result.get('status_code') else f"错误: {result.get('error', 'Unknown')}"
            print(f"{status_icon} {result['name']}: {status_text}")
    
    # 统计结果
    print("")
    print("=" * 80)
    print("测试总结")
    print("=" * 80)
    
    total = len(results)
    accessible = sum(1 for r in results if r.get('is_accessible', False))
    not_found = sum(1 for r in results if r.get('status') == 'not_found')
    errors = sum(1 for r in results if r.get('status') == 'error')
    
    print(f"总端点数: {total}")
    print(f"✅ 可访问: {accessible} ({accessible/total*100:.1f}%)")
    print(f"❌ 404: {not_found} ({not_found/total*100:.1f}%)")
    print(f"⚠️  错误: {errors} ({errors/total*100:.1f}%)")
    print("")
    
    # 显示404的端点
    not_found_endpoints = [r for r in results if r.get('status') == 'not_found']
    if not_found_endpoints:
        print("❌ 404 Not Found 的端点:")
        for r in not_found_endpoints:
            print(f"  - {r['method']} {r['path']} ({r['name']})")
        print("")
    
    # 显示错误的端点
    error_endpoints = [r for r in results if r.get('status') == 'error']
    if error_endpoints:
        print("⚠️  错误的端点:")
        for r in error_endpoints:
            print(f"  - {r['method']} {r['path']} ({r['name']}): {r.get('error', 'Unknown')}")
        print("")
    
    # 保存结果
    output_path = Path(args.output)
    save_data = {
        'test_time': datetime.now().isoformat(),
        'page': '销售订单页面',
        'summary': {
            'total': total,
            'accessible': accessible,
            'not_found': not_found,
            'errors': errors,
        },
        'results': results
    }
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(save_data, f, ensure_ascii=False, indent=2)
    
    print(f"💾 测试结果已保存到: {output_path.absolute()}")
    
    return 0 if not_found == 0 and errors == 0 else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)

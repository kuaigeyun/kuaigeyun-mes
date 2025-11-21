"""
组织 API 测试脚本

测试组织管理 API 的各个接口
"""

import sys
import asyncio
from pathlib import Path

# 添加 src 目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

import httpx
from loguru import logger


BASE_URL = "http://localhost:8000"
API_PREFIX = "/api/v1"


async def test_tenant_api():
    """
    测试组织 API
    
    测试所有组织管理接口
    """
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        logger.info("=" * 60)
        logger.info("开始测试组织管理 API")
        logger.info("=" * 60)
        
        # 1. 测试创建组织
        logger.info("\n1. 测试创建组织")
        create_data = {
            "name": "测试组织",
            "domain": "test-tenant",
            "status": "active",
            "plan": "basic",
            "max_users": 50,
            "max_storage": 2048,
        }
        try:
            response = await client.post(
                f"{API_PREFIX}/tenants",
                json=create_data
            )
            logger.info(f"状态码: {response.status_code}")
            logger.info(f"响应: {response.json()}")
            if response.status_code == 201:
                tenant_data = response.json()
                tenant_id = tenant_data.get("id")
                logger.success(f"✅ 组织创建成功，ID: {tenant_id}")
            else:
                logger.error(f"❌ 组织创建失败: {response.text}")
                return
        except Exception as e:
            logger.error(f"❌ 创建组织时出错: {e}")
            return
        
        # 2. 测试获取组织列表
        logger.info("\n2. 测试获取组织列表")
        try:
            response = await client.get(
                f"{API_PREFIX}/tenants",
                params={"page": 1, "page_size": 10}
            )
            logger.info(f"状态码: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                logger.success(f"✅ 获取组织列表成功")
                logger.info(f"   总数: {data.get('total')}")
                logger.info(f"   当前页: {data.get('page')}")
                logger.info(f"   每页数量: {data.get('page_size')}")
                logger.info(f"   组织数量: {len(data.get('items', []))}")
            else:
                logger.error(f"❌ 获取组织列表失败: {response.text}")
        except Exception as e:
            logger.error(f"❌ 获取组织列表时出错: {e}")
        
        # 3. 测试获取组织详情
        logger.info(f"\n3. 测试获取组织详情 (ID: {tenant_id})")
        try:
            response = await client.get(f"{API_PREFIX}/tenants/{tenant_id}")
            logger.info(f"状态码: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                logger.success(f"✅ 获取组织详情成功")
                logger.info(f"   组织名称: {data.get('name')}")
                logger.info(f"   组织域名: {data.get('domain')}")
                logger.info(f"   组织状态: {data.get('status')}")
                logger.info(f"   组织套餐: {data.get('plan')}")
            else:
                logger.error(f"❌ 获取组织详情失败: {response.text}")
        except Exception as e:
            logger.error(f"❌ 获取组织详情时出错: {e}")
        
        # 4. 测试更新组织
        logger.info(f"\n4. 测试更新组织 (ID: {tenant_id})")
        update_data = {
            "name": "更新后的组织名称",
            "max_users": 100,
        }
        try:
            response = await client.put(
                f"{API_PREFIX}/tenants/{tenant_id}",
                json=update_data
            )
            logger.info(f"状态码: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                logger.success(f"✅ 更新组织成功")
                logger.info(f"   更新后名称: {data.get('name')}")
                logger.info(f"   更新后最大用户数: {data.get('max_users')}")
            else:
                logger.error(f"❌ 更新组织失败: {response.text}")
        except Exception as e:
            logger.error(f"❌ 更新组织时出错: {e}")
        
        # 5. 测试停用组织
        logger.info(f"\n5. 测试停用组织 (ID: {tenant_id})")
        try:
            response = await client.post(f"{API_PREFIX}/tenants/{tenant_id}/deactivate")
            logger.info(f"状态码: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                logger.success(f"✅ 停用组织成功")
                logger.info(f"   组织状态: {data.get('status')}")
            else:
                logger.error(f"❌ 停用组织失败: {response.text}")
        except Exception as e:
            logger.error(f"❌ 停用组织时出错: {e}")
        
        # 6. 测试激活组织
        logger.info(f"\n6. 测试激活组织 (ID: {tenant_id})")
        try:
            response = await client.post(f"{API_PREFIX}/tenants/{tenant_id}/activate")
            logger.info(f"状态码: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                logger.success(f"✅ 激活组织成功")
                logger.info(f"   组织状态: {data.get('status')}")
            else:
                logger.error(f"❌ 激活组织失败: {response.text}")
        except Exception as e:
            logger.error(f"❌ 激活组织时出错: {e}")
        
        # 7. 测试删除组织（软删除）
        logger.info(f"\n7. 测试删除组织 (ID: {tenant_id})")
        try:
            response = await client.delete(f"{API_PREFIX}/tenants/{tenant_id}")
            logger.info(f"状态码: {response.status_code}")
            if response.status_code == 204:
                logger.success(f"✅ 删除组织成功（软删除）")
            else:
                logger.error(f"❌ 删除组织失败: {response.text}")
        except Exception as e:
            logger.error(f"❌ 删除组织时出错: {e}")
        
        # 8. 测试组织列表筛选
        logger.info("\n8. 测试组织列表筛选（按状态）")
        try:
            response = await client.get(
                f"{API_PREFIX}/tenants",
                params={"page": 1, "page_size": 10, "status": "active"}
            )
            logger.info(f"状态码: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                logger.success(f"✅ 筛选组织列表成功")
                logger.info(f"   筛选后的总数: {data.get('total')}")
            else:
                logger.error(f"❌ 筛选组织列表失败: {response.text}")
        except Exception as e:
            logger.error(f"❌ 筛选组织列表时出错: {e}")
        
        logger.info("\n" + "=" * 60)
        logger.info("组织 API 测试完成")
        logger.info("=" * 60)


if __name__ == "__main__":
    asyncio.run(test_tenant_api())


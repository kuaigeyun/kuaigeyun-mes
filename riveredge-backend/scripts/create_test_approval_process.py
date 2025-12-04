"""
创建测试审批流程脚本

用于创建测试用的审批流程数据，包含基本的节点和边配置。
"""

import asyncio
import sys
import os
from pathlib import Path

# 添加项目路径
project_root = Path(__file__).parent.parent
src_path = project_root / "src"
sys.path.insert(0, str(src_path))

from tortoise import Tortoise
from platform.infrastructure.database.database import TORTOISE_ORM
from core.models.approval_process import ApprovalProcess
from datetime import datetime


async def create_test_approval_process():
    """创建测试审批流程"""
    
    # 初始化数据库连接
    await Tortoise.init(config=TORTOISE_ORM)
    
    try:
        # 测试数据：使用 tenant_id = 1（假设这是测试组织）
        tenant_id = 1
        
        # 检查是否已存在测试流程
        existing = await ApprovalProcess.filter(
            tenant_id=tenant_id,
            code="test_approval_process",
            deleted_at__isnull=True
        ).first()
        
        if existing:
            print(f"测试流程已存在，UUID: {existing.uuid}")
            print(f"流程名称: {existing.name}")
            return existing
        
        # 创建测试流程的节点配置（ProFlow 格式）
        nodes_config = {
            "nodes": [
                {
                    "id": "start",
                    "type": "start",
                    "position": {"x": 100, "y": 100},
                    "data": {
                        "label": "开始"
                    }
                },
                {
                    "id": "approval_1",
                    "type": "approval",
                    "position": {"x": 300, "y": 100},
                    "data": {
                        "label": "部门经理审批",
                        "approverType": "role",
                        "approverId": 1,  # 假设角色ID为1
                        "condition": None
                    }
                },
                {
                    "id": "approval_2",
                    "type": "approval",
                    "position": {"x": 500, "y": 100},
                    "data": {
                        "label": "总经理审批",
                        "approverType": "role",
                        "approverId": 2,  # 假设角色ID为2
                        "condition": None
                    }
                },
                {
                    "id": "end",
                    "type": "end",
                    "position": {"x": 700, "y": 100},
                    "data": {
                        "label": "结束"
                    }
                }
            ],
            "edges": [
                {
                    "id": "edge_start_approval1",
                    "source": "start",
                    "target": "approval_1",
                    "type": "smoothstep"
                },
                {
                    "id": "edge_approval1_approval2",
                    "source": "approval_1",
                    "target": "approval_2",
                    "type": "smoothstep"
                },
                {
                    "id": "edge_approval2_end",
                    "source": "approval_2",
                    "target": "end",
                    "type": "smoothstep"
                }
            ]
        }
        
        # 创建流程配置
        process_config = {
            "timeout": 7 * 24 * 60 * 60,  # 7天超时（秒）
            "notifyOnSubmit": True,
            "notifyOnApprove": True,
            "notifyOnReject": True
        }
        
        # 创建审批流程
        approval_process = ApprovalProcess(
            tenant_id=tenant_id,
            name="测试审批流程",
            code="test_approval_process",
            description="这是一个测试用的审批流程，包含开始节点、两个审批节点和结束节点",
            nodes=nodes_config,
            config=process_config,
            is_active=True
        )
        
        await approval_process.save()
        
        print("=" * 60)
        print("测试审批流程创建成功！")
        print("=" * 60)
        print(f"流程UUID: {approval_process.uuid}")
        print(f"流程名称: {approval_process.name}")
        print(f"流程代码: {approval_process.code}")
        print(f"组织ID: {approval_process.tenant_id}")
        print(f"是否启用: {approval_process.is_active}")
        print(f"节点数量: {len(nodes_config['nodes'])}")
        print(f"边数量: {len(nodes_config['edges'])}")
        print("=" * 60)
        print("\n流程节点结构：")
        print("  开始 -> 部门经理审批 -> 总经理审批 -> 结束")
        print("\n可以在前端审批流程列表页面查看和编辑此流程。")
        print(f"设计器链接: /system/approval-processes/designer?uuid={approval_process.uuid}")
        
        return approval_process
        
    except Exception as e:
        print(f"创建测试流程失败: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    print("开始创建测试审批流程...")
    asyncio.run(create_test_approval_process())


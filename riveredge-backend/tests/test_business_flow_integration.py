"""
业务单据全流程集成测试（可选）

需配置测试数据库后运行：
    TEST_DATABASE_URL=postgres://user:pass@host:5432/testdb uv run pytest tests/ -m integration
或
    RUN_INTEGRATION_TESTS=1 uv run pytest tests/ -m integration

完整流程验证需创建最小主数据后，按以下顺序调用服务：
1. 销售订单创建 → 审核
2. 下推需求计算 → 需求计算完成
3. 生成工单/采购单
4. 领料 → 确认领料
5. 成品入库 → 确认入库
6. 销售出库 → 确认出库
7. 断言：DocumentRelation、库存变动、应收单创建

Author: RiverEdge Team
Date: 2026-03-01
"""

import os
from pathlib import Path

import pytest

# 加载 .env（若存在）
_backend_root = Path(__file__).resolve().parent.parent
_env_file = _backend_root / ".env"
if _env_file.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(_env_file)
    except ImportError:
        pass


@pytest.mark.integration
class TestBusinessFlowIntegration:
    """业务单据全流程集成测试（需测试数据库）"""

    @pytest.mark.asyncio
    async def test_integration_db_connection(self, integration_db_available):
        """
        验证测试数据库连接可用。
        当 TEST_DATABASE_URL 或 RUN_INTEGRATION_TESTS 设置时，初始化 Tortoise 并执行简单查询。
        """
        from tortoise import Tortoise
        from infra.infrastructure.database.database import TORTOISE_ORM

        await Tortoise.init(config=TORTOISE_ORM)
        try:
            # 简单验证：查询租户表是否存在且可访问
            from infra.models.tenant import Tenant
            count = await Tenant.all().count()
            assert count >= 0, "租户表应可查询"
        finally:
            await Tortoise.close_connections()

    @pytest.mark.asyncio
    async def test_document_relation_service_available(self, integration_db_available):
        """
        验证 DocumentRelationService 在数据库可用时可正常调用。
        需要至少存在一个有效的 tenant_id 和 document。
        """
        from tortoise import Tortoise
        from infra.infrastructure.database.database import TORTOISE_ORM
        from apps.kuaizhizao.services.document_relation_service import DocumentRelationService
        from infra.models.tenant import Tenant

        await Tortoise.init(config=TORTOISE_ORM)
        try:
            tenant = await Tenant.filter().first()
            if not tenant:
                pytest.skip("无租户数据，跳过 DocumentRelation 集成测试")

            svc = DocumentRelationService()
            # 调用 get_document_relations 验证不抛错（可能返回空上下游）
            result = await svc.get_document_relations(
                tenant_id=tenant.id,
                document_type="work_order",
                document_id=1,  # 可能不存在，但应能执行查询
            )
            assert "upstream_documents" in result
            assert "downstream_documents" in result
        except Exception as e:
            # 若 work_order 1 不存在可能抛 ValidationError，可接受
            from infra.exceptions.exceptions import ValidationError, NotFoundError
            if isinstance(e, (ValidationError, NotFoundError)):
                pytest.skip(f"无测试数据: {e}")
            raise
        finally:
            await Tortoise.close_connections()

"""
单据状态引擎模块

提供统一的单据正向推进/反向撤回入口，按业务蓝图检查下游依赖后委托各领域服务执行。

Author: Luigi Lu
Date: 2026-02-20
"""

from typing import Dict, Any, Optional
from loguru import logger

from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError


class DocumentStateEngine:
    """
    单据状态引擎

    统一 reverse_document 入口，根据 document_type 和 reverse_type 委托对应领域服务执行。
    支持：withdraw_submit（提交撤回）、withdraw_push（下推撤回）、revoke_state（状态撤回）
    """

    async def reverse_document(
        self,
        tenant_id: int,
        document_type: str,
        document_id: int,
        reverse_type: str,
        operator_id: int,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        统一反向操作入口

        Args:
            tenant_id: 租户ID
            document_type: 单据类型（demand, sales_order, work_order 等）
            document_id: 单据ID
            reverse_type: 撤回类型
                - withdraw_submit: 提交撤回（待审核→草稿）
                - withdraw_push: 下推撤回（撤销本次下推，如需求计算）
                - revoke_state: 状态撤回（如工单 已下达→草稿）
            operator_id: 操作人ID
            reason: 撤回原因（可选）

        Returns:
            Dict: 包含更新后的单据信息

        Raises:
            ValidationError: 不支持的单据类型或撤回类型
            BusinessLogicError: 业务规则不允许撤回
        """
        handlers = {
            ("demand", "withdraw_submit"): self._reverse_demand_submit,
            ("demand", "withdraw_push"): self._reverse_demand_push,
            ("sales_order", "withdraw_submit"): self._reverse_sales_order_submit,
            ("sales_order", "withdraw_push"): self._reverse_sales_order_push,
            ("work_order", "revoke_state"): self._reverse_work_order_state,
        }
        key = (document_type, reverse_type)
        handler = handlers.get(key)
        if not handler:
            raise ValidationError(
                f"不支持的撤回组合: document_type={document_type}, reverse_type={reverse_type}. "
                f"支持: demand/sales_order+withdraw_submit/withdraw_push, work_order+revoke_state"
            )

        result = await handler(tenant_id, document_id, operator_id, reason)
        logger.info(f"单据撤回: {document_type}#{document_id} type={reverse_type} by={operator_id}")
        return result

    def _to_dict(self, obj: Any) -> dict:
        """Pydantic/ORM 转 dict"""
        if hasattr(obj, "model_dump"):
            return obj.model_dump()
        if hasattr(obj, "dict"):
            return obj.dict()
        return dict(obj) if hasattr(obj, "__iter__") and not isinstance(obj, (str, bytes)) else {"id": getattr(obj, "id", None)}

    async def _reverse_demand_submit(
        self, tenant_id: int, document_id: int, operator_id: int, reason: Optional[str]
    ) -> Dict[str, Any]:
        """需求：提交撤回"""
        from apps.kuaizhizao.services.demand_service import DemandService

        svc = DemandService()
        demand = await svc.withdraw_demand(tenant_id, document_id, withdrawn_by=operator_id)
        return {"document_type": "demand", "document": self._to_dict(demand)}

    async def _reverse_demand_push(
        self, tenant_id: int, document_id: int, operator_id: int, reason: Optional[str]
    ) -> Dict[str, Any]:
        """需求：下推撤回（撤回需求计算）"""
        from apps.kuaizhizao.services.demand_service import DemandService

        svc = DemandService()
        demand = await svc.withdraw_from_computation(tenant_id, document_id)
        return {"document_type": "demand", "document": self._to_dict(demand)}

    async def _reverse_sales_order_submit(
        self, tenant_id: int, document_id: int, operator_id: int, reason: Optional[str]
    ) -> Dict[str, Any]:
        """销售订单：提交撤回"""
        from apps.kuaizhizao.services.sales_order_service import SalesOrderService

        svc = SalesOrderService()
        order = await svc.withdraw_sales_order(tenant_id, document_id, withdrawn_by=operator_id)
        return {"document_type": "sales_order", "document": self._to_dict(order)}

    async def _reverse_sales_order_push(
        self, tenant_id: int, document_id: int, operator_id: int, reason: Optional[str]
    ) -> Dict[str, Any]:
        """销售订单：下推撤回（撤回需求计算）"""
        from apps.kuaizhizao.services.sales_order_service import SalesOrderService

        svc = SalesOrderService()
        order = await svc.withdraw_sales_order_from_computation(tenant_id, document_id)
        return {"document_type": "sales_order", "document": self._to_dict(order)}

    async def _reverse_work_order_state(
        self, tenant_id: int, document_id: int, operator_id: int, reason: Optional[str]
    ) -> Dict[str, Any]:
        """工单：状态撤回（已下达/指定结束→草稿）"""
        from apps.kuaizhizao.services.work_order_service import WorkOrderService

        svc = WorkOrderService()
        wo = await svc.revoke_work_order(tenant_id, document_id, revoked_by=operator_id)
        return {"document_type": "work_order", "document": self._to_dict(wo)}

    def get_supported_reverses(self) -> Dict[str, list]:
        """
        返回支持的反向操作配置，供前端展示可用按钮

        Returns:
            Dict: { document_type: [reverse_type, ...] }
        """
        return {
            "demand": ["withdraw_submit", "withdraw_push"],
            "sales_order": ["withdraw_submit", "withdraw_push"],
            "work_order": ["revoke_state"],
        }

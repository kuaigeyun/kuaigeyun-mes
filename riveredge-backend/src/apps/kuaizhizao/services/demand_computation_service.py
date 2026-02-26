"""
统一需求计算服务模块

提供统一需求计算相关的业务逻辑处理，合并MRP和LRP运算逻辑。

根据《☆ 用户使用全场景推演.md》的设计理念，将MRP和LRP合并为统一的需求计算模型。

Author: Luigi Lu
Date: 2025-01-14
"""

import asyncio
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta, date
from decimal import Decimal
from tortoise.transactions import in_transaction
from loguru import logger

from apps.kuaizhizao.constants import DemandStatus, ReviewStatus
from apps.kuaizhizao.models.demand import Demand
from apps.kuaizhizao.models.demand_computation import DemandComputation
from apps.kuaizhizao.models.demand_computation_item import DemandComputationItem
from apps.kuaizhizao.models.demand_computation_snapshot import DemandComputationSnapshot
from apps.kuaizhizao.models.demand_computation_recalc_history import DemandComputationRecalcHistory
from apps.kuaizhizao.schemas.demand_computation import (
    DemandComputationCreate,
    DemandComputationUpdate,
    DemandComputationResponse,
    DemandComputationItemResponse,
)
from apps.kuaizhizao.utils.material_source_helper import (
    get_material_source_type,
    validate_material_source_config,
    get_material_source_config,
    expand_bom_with_source_control,
    SOURCE_TYPE_MAKE,
    SOURCE_TYPE_BUY,
    SOURCE_TYPE_PHANTOM,
    SOURCE_TYPE_OUTSOURCE,
    SOURCE_TYPE_CONFIGURE,
)
from apps.kuaizhizao.utils.inventory_helper import get_material_inventory_info
from core.services.business.code_generation_service import CodeGenerationService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from infra.services.business_config_service import BusinessConfigService


class _PreviewResultCarrier(Exception):
    """用于预览时携带结果并触发事务回滚（不持久化）"""
    def __init__(self, preview_data: Dict[str, Any]):
        self.preview_data = preview_data


async def _fetch_config_via_raw_conn(
    conn: Any,
    tenant_id: int,
    material_id: Optional[int],
    warehouse_id: Optional[int],
) -> Dict[str, Any]:
    """在独立连接上查询 ComputationConfig，表不存在时由调用方捕获。"""
    import json
    merged: Dict[str, Any] = {}
    tbl = "apps_kuaizhizao_computation_configs"
    # 按优先级查询：global, warehouse, material, material_warehouse
    scopes = [
        ("global", None, None),
        ("warehouse", None, warehouse_id),
        ("material", material_id, None),
        ("material_warehouse", material_id, warehouse_id),
    ]
    for scope, mid, wid in scopes:
        if scope == "material_warehouse" and (not mid or not wid):
            continue
        if scope == "material" and not mid:
            continue
        if scope == "warehouse" and not wid:
            continue
        if scope == "global":
            row = await conn.fetchrow(
                f"SELECT computation_params FROM {tbl} WHERE tenant_id=$1 AND config_scope=$2 AND is_active=true ORDER BY priority DESC LIMIT 1",
                tenant_id, scope
            )
        elif scope == "material":
            row = await conn.fetchrow(
                f"SELECT computation_params FROM {tbl} WHERE tenant_id=$1 AND config_scope=$2 AND material_id=$3 AND is_active=true ORDER BY priority DESC LIMIT 1",
                tenant_id, scope, mid
            )
        elif scope == "warehouse":
            row = await conn.fetchrow(
                f"SELECT computation_params FROM {tbl} WHERE tenant_id=$1 AND config_scope=$2 AND warehouse_id=$3 AND is_active=true ORDER BY priority DESC LIMIT 1",
                tenant_id, scope, wid
            )
        else:
            row = await conn.fetchrow(
                f"SELECT computation_params FROM {tbl} WHERE tenant_id=$1 AND config_scope=$2 AND material_id=$3 AND warehouse_id=$4 AND is_active=true ORDER BY priority DESC LIMIT 1",
                tenant_id, scope, mid, wid
            )
        if row and row.get("computation_params"):
            params = row["computation_params"]
            merged.update(params if isinstance(params, dict) else (json.loads(params) if params else {}))
    return merged


async def _get_material_safety_reorder(
    tenant_id: int,
    material: Any,
    material_id: int,
    computation_params: Dict[str, Any],
) -> tuple[float, float]:
    """
    从物料主数据、ComputationConfig 或计算参数获取安全库存、再订货点。
    优先级：computation_params > material.defaults > ComputationConfig > 0
    """
    safety = 0.0
    reorder = 0.0

    # 1. 从 ComputationConfig 获取（物料/全局），表不存在时跳过
    # 使用独立连接查询，表不存在时失败不影响主事务，避免 TransactionManagementError
    try:
        from infra.infrastructure.database.database import get_db_connection
        conn = await get_db_connection()
        try:
            config_params = await _fetch_config_via_raw_conn(
                conn, tenant_id, material_id, warehouse_id=None
            )
            if config_params:
                safety = float(config_params.get("safety_stock", 0))
                reorder = float(config_params.get("reorder_point", 0))
        finally:
            await conn.close()
    except Exception:
        pass  # 表不存在或查询失败时跳过，使用 material.defaults / computation_params

    # 2. 从物料 defaults 覆盖
    if material.defaults:
        inv = material.defaults.get("inventory") or material.defaults
        if isinstance(inv, dict):
            if inv.get("safety_stock") is not None or inv.get("safety_stock_level") is not None:
                safety = float(inv.get("safety_stock") or inv.get("safety_stock_level") or 0)
            if inv.get("reorder_point") is not None:
                reorder = float(inv.get("reorder_point", 0))

    # 3. 从本次计算的 computation_params 覆盖
    if computation_params:
        if "safety_stock" in computation_params:
            safety = float(computation_params.get("safety_stock", safety))
        if "reorder_point" in computation_params:
            reorder = float(computation_params.get("reorder_point", reorder))

    return safety, reorder


def _compute_supply_and_net(
    inventory_info: Dict[str, Any],
    safety_stock: float,
    reorder_point: float,
    gross_requirement: float,
    computation_params: Dict[str, Any],
) -> tuple[float, float]:
    """
    按可配置参数计算可供应量与净需求。
    公式：可供应量 = 可用库存 + [在途] - [安全库存]
    净需求 = max(0, 毛需求 - 可供应量)
    若 include_reorder_point：当可供应量 < 再订货点时，净需求至少补足到再订货点
    """
    include_safety = computation_params.get("include_safety_stock", True)
    include_in_transit = computation_params.get("include_in_transit", False)
    include_reserved = computation_params.get("include_reserved", False)
    include_reorder = computation_params.get("include_reorder_point", False)

    # available = 在库 - 预留；include_reserved 为 true 时用 available（考虑预留），否则用 on_hand（在库）
    if include_reserved:
        available = float(inventory_info.get("available_quantity", 0))
    else:
        available = float(inventory_info.get("on_hand", inventory_info.get("available_quantity", 0)))
    in_transit = float(inventory_info.get("in_transit_quantity", 0))

    supply = available
    if include_in_transit:
        supply += in_transit
    if include_safety:
        supply -= safety_stock

    net_base = max(0.0, gross_requirement - supply)
    if include_reorder and reorder_point > 0 and supply < reorder_point:
        net_reorder = max(0.0, reorder_point - supply)
        net_requirement = max(net_base, net_reorder)
    else:
        net_requirement = net_base

    return supply, net_requirement


class DemandComputationService:
    """统一需求计算服务"""
    
    async def create_computation(
        self,
        tenant_id: int,
        computation_data: DemandComputationCreate,
        created_by: int
    ) -> DemandComputationResponse:
        """
        创建需求计算
        
        Args:
            tenant_id: 租户ID
            computation_data: 计算数据
            created_by: 创建人ID
            
        Returns:
            DemandComputationResponse: 创建的计算响应
        """
        async with in_transaction():
            # 解析需求列表（支持 demand_id 或 demand_ids）
            demand_id_list = (
                computation_data.demand_ids
                if computation_data.demand_ids
                else ([computation_data.demand_id] if computation_data.demand_id else [])
            )
            if not demand_id_list:
                raise BusinessLogicError("必须提供 demand_id 或 demand_ids")

            # 验证需求存在且已审核
            demands = []
            for did in demand_id_list:
                d = await Demand.get_or_none(tenant_id=tenant_id, id=did)
                if not d:
                    raise NotFoundError(f"需求不存在: {did}")
                if d.status != DemandStatus.AUDITED or d.review_status != ReviewStatus.APPROVED:
                    raise BusinessLogicError(f"只能对已审核通过的需求进行计算，需求 {d.demand_code} 状态: {d.status}")
                demands.append(d)

            # 使用第一个需求作为主需求（向后兼容）
            demand = demands[0]
            demand_codes = ",".join(d.demand_code for d in demands[:3])
            if len(demands) > 3:
                demand_codes += f"等{len(demands)}个"

            # 推断计算类型（多需求时：有订单则 LRP，全预测则 MRP）
            computation_type = computation_data.computation_type
            if len(demands) > 1:
                has_mto = any(getattr(d, "business_mode", None) == "MTO" for d in demands)
                computation_type = "LRP" if has_mto else "MRP"

            # 生成计算编码
            computation_code = await self._generate_computation_code(tenant_id, computation_type)

            # 创建需求计算
            computation = await DemandComputation.create(
                tenant_id=tenant_id,
                computation_code=computation_code,
                demand_id=demand.id,
                demand_ids=demand_id_list,
                demand_code=demand_codes,
                demand_type=demand.demand_type,
                business_mode=demand.business_mode,
                computation_type=computation_data.computation_type,
                computation_params=computation_data.computation_params,
                computation_status="进行中",
                computation_start_time=datetime.now(),
                notes=computation_data.notes,
                created_by=created_by,
            )
            
            # 创建计算结果明细
            items = []
            for item_data in computation_data.items or []:
                item = await DemandComputationItem.create(
                    tenant_id=tenant_id,
                    computation_id=computation.id,
                    **item_data.model_dump()
                )
                items.append(item)
            
            return await self._build_computation_response(computation, items)
    
    async def _generate_computation_code(
        self,
        tenant_id: int,
        computation_type: str
    ) -> str:
        """
        生成需求计算编码
        
        Args:
            tenant_id: 租户ID
            computation_type: 计算类型（MRP/LRP）
            
        Returns:
            str: 计算编码
        """
        try:
            # 使用编码生成服务生成编码
            code = await CodeGenerationService.generate_code(
                tenant_id=tenant_id,
                rule_code="DEMAND_COMPUTATION",
                context={"computation_type": computation_type}
            )
            return code
        except Exception as e:
            logger.warning(f"使用编码规则生成失败: {e}，使用简单编码")
            # 回退到简单编码格式
            now = datetime.now()
            prefix = "MRP" if computation_type == "MRP" else "LRP"
            return f"{prefix}-{now.strftime('%Y%m%d')}-NEW"
    
    async def _build_computation_response(
        self,
        computation: DemandComputation,
        items: List[DemandComputationItem]
    ) -> DemandComputationResponse:
        """构建计算响应对象"""
        item_responses = [
            DemandComputationItemResponse.model_validate(item) for item in items
        ]
        
        return DemandComputationResponse(
            id=computation.id,
            uuid=str(computation.uuid),
            tenant_id=computation.tenant_id,
            computation_code=computation.computation_code,
            demand_id=computation.demand_id,
            demand_code=computation.demand_code,
            demand_type=computation.demand_type,
            business_mode=computation.business_mode,
            computation_type=computation.computation_type,
            computation_params=computation.computation_params,
            computation_status=computation.computation_status,
            computation_start_time=computation.computation_start_time,
            computation_end_time=computation.computation_end_time,
            computation_summary=computation.computation_summary,
            error_message=computation.error_message,
            notes=computation.notes,
            created_at=computation.created_at,
            updated_at=computation.updated_at,
            created_by=computation.created_by,
            updated_by=computation.updated_by,
            items=item_responses
        )
    
    async def get_computation_by_id(
        self,
        tenant_id: int,
        computation_id: int,
        include_items: bool = True
    ) -> DemandComputationResponse:
        """
        根据ID获取需求计算
        
        Args:
            tenant_id: 租户ID
            computation_id: 计算ID
            include_items: 是否包含明细
            
        Returns:
            DemandComputationResponse: 计算响应
        """
        computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
        if not computation:
            raise NotFoundError(f"需求计算不存在: {computation_id}")
        
        items = []
        if include_items:
            items = await DemandComputationItem.filter(
                tenant_id=tenant_id,
                computation_id=computation_id
            ).all()
        
        return await self._build_computation_response(computation, items)
    
    async def list_computations(
        self,
        tenant_id: int,
        demand_id: Optional[int] = None,
        demand_code: Optional[str] = None,
        computation_code: Optional[str] = None,
        computation_type: Optional[str] = None,
        computation_status: Optional[str] = None,
        business_mode: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        skip: int = 0,
        limit: int = 20
    ) -> Dict[str, Any]:
        """
        获取需求计算列表
        
        Args:
            tenant_id: 租户ID
            demand_id: 需求ID（可选）
            demand_code: 需求编码（可选，支持模糊查询）
            computation_code: 计算编码（可选，支持模糊查询）
            computation_type: 计算类型（可选）
            computation_status: 计算状态（可选）
            business_mode: 业务模式（可选）
            start_date: 开始日期（可选，YYYY-MM-DD格式）
            end_date: 结束日期（可选，YYYY-MM-DD格式）
            skip: 跳过数量
            limit: 限制数量
            
        Returns:
            Dict: 包含计算列表和总数的字典
        """
        from tortoise.expressions import Q
        from datetime import datetime
        
        query = DemandComputation.filter(tenant_id=tenant_id)
        
        if demand_id:
            query = query.filter(demand_id=demand_id)
        if demand_code:
            query = query.filter(demand_code__icontains=demand_code)
        if computation_code:
            query = query.filter(computation_code__icontains=computation_code)
        if computation_type:
            query = query.filter(computation_type=computation_type)
        if computation_status:
            query = query.filter(computation_status=computation_status)
        if business_mode:
            query = query.filter(business_mode=business_mode)
        if start_date:
            try:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d")
                query = query.filter(computation_start_time__gte=start_dt)
            except ValueError:
                pass  # 忽略无效的日期格式
        if end_date:
            try:
                end_dt = datetime.strptime(end_date, "%Y-%m-%d")
                # 结束日期需要包含整天，所以设置为当天的23:59:59
                from datetime import timedelta
                end_dt = end_dt + timedelta(days=1) - timedelta(seconds=1)
                query = query.filter(computation_start_time__lte=end_dt)
            except ValueError:
                pass  # 忽略无效的日期格式
        
        total = await query.count()
        computations = await query.offset(skip).limit(limit).order_by('-computation_start_time')
        
        result = []
        for computation in computations:
            items = await DemandComputationItem.filter(
                tenant_id=tenant_id,
                computation_id=computation.id
            ).all()
            result.append(await self._build_computation_response(computation, items))
        
        return {
            "data": [r.model_dump() for r in result],
            "total": total,
            "success": True
        }
    
    async def execute_computation(
        self,
        tenant_id: int,
        computation_id: int,
        computation_params_override: Optional[Dict[str, Any]] = None,
    ) -> DemandComputationResponse:
        """
        执行需求计算
        
        Args:
            tenant_id: 租户ID
            computation_id: 计算ID
            computation_params_override: 临时覆盖的计算参数，仅本次执行生效，不持久化
            
        Returns:
            DemandComputationResponse: 计算响应
        """
        computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
        if not computation:
            raise NotFoundError(f"需求计算不存在: {computation_id}")

        # 允许执行：进行中（待执行）或 失败（重试）
        if computation.computation_status not in ("进行中", "失败"):
            raise BusinessLogicError(
                f"只能执行进行中或失败状态的计算，当前状态: {computation.computation_status}"
            )

        # 合并临时覆盖参数到 computation_params（仅本次执行生效，不持久化）
        if computation_params_override:
            base_params = computation.computation_params or {}
            computation.computation_params = {**base_params, **computation_params_override}

        try:
            async with in_transaction():
                # 失败重试时清理旧明细：理论上事务回滚已清理，此处为防御性保证重试从干净状态开始
                if computation.computation_status == "失败":
                    await DemandComputationItem.filter(
                        tenant_id=tenant_id,
                        computation_id=computation_id
                    ).delete()

                # 更新计算状态为计算中
                await DemandComputation.filter(tenant_id=tenant_id, id=computation_id).update(
                    computation_status="计算中",
                    computation_start_time=datetime.now()
                )

                # 根据计算类型执行不同的计算逻辑
                if computation.computation_type == "MRP":
                    await self._execute_mrp_computation(tenant_id, computation)
                elif computation.computation_type == "LRP":
                    await self._execute_lrp_computation(tenant_id, computation)
                else:
                    raise ValidationError(f"不支持的计算类型: {computation.computation_type}")

                # 更新计算状态为完成，清除失败时的错误信息
                await DemandComputation.filter(tenant_id=tenant_id, id=computation_id).update(
                    computation_status="完成",
                    computation_end_time=datetime.now(),
                    error_message=None,
                )

            return await self.get_computation_by_id(tenant_id, computation_id)

        except Exception as e:
            logger.error(f"执行需求计算失败: {e}")
            # 更新为失败状态：使用独立连接避免复用已终止事务的连接导致 TransactionManagementError
            try:
                await asyncio.sleep(0)  # 让出控制权，确保连接池有机会回收/重置连接
                from infra.infrastructure.database.database import get_db_connection
                conn = await get_db_connection()
                try:
                    now = datetime.now()
                    err_msg = str(e).replace("'", "''")[:2000]  # 转义并截断
                    await conn.execute(
                        """UPDATE apps_kuaizhizao_demand_computations
                           SET computation_status=$1, computation_end_time=$2, error_message=$3
                           WHERE tenant_id=$4 AND id=$5""",
                        "失败", now, err_msg, tenant_id, computation_id
                    )
                finally:
                    await conn.close()
            except Exception as update_err:
                logger.warning(f"更新失败状态时出错: {update_err}")
            raise

    async def preview_execute_computation(
        self,
        tenant_id: int,
        computation_id: int,
        computation_params_override: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        预览执行结果：运行计算逻辑但不持久化，返回计算结果预览供二次确认。
        通过事务回滚实现，不写入数据库。
        """
        computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
        if not computation:
            raise NotFoundError(f"需求计算不存在: {computation_id}")
        if computation.computation_status not in ("进行中", "失败"):
            raise BusinessLogicError(
                f"只能预览进行中或失败状态的计算，当前状态: {computation.computation_status}"
            )

        if computation_params_override:
            base_params = computation.computation_params or {}
            computation.computation_params = {**base_params, **computation_params_override}

        try:
            async with in_transaction():
                if computation.computation_status == "失败":
                    await DemandComputationItem.filter(
                        tenant_id=tenant_id,
                        computation_id=computation_id
                    ).delete()

                await DemandComputation.filter(tenant_id=tenant_id, id=computation_id).update(
                    computation_status="计算中",
                    computation_start_time=datetime.now()
                )

                if computation.computation_type == "MRP":
                    await self._execute_mrp_computation(tenant_id, computation)
                elif computation.computation_type == "LRP":
                    await self._execute_lrp_computation(tenant_id, computation)
                else:
                    raise ValidationError(f"不支持的计算类型: {computation.computation_type}")

                items = await DemandComputationItem.filter(
                    tenant_id=tenant_id,
                    computation_id=computation_id
                ).all()

                preview_items = []
                for item in items:
                    preview_items.append({
                        "material_code": item.material_code,
                        "material_name": item.material_name,
                        "material_unit": item.material_unit or "",
                        "required_quantity": float(item.required_quantity or 0),
                        "available_inventory": float(item.available_inventory or 0),
                        "net_requirement": float(item.net_requirement or 0),
                        "suggested_work_order_quantity": float(item.suggested_work_order_quantity or 0),
                        "suggested_purchase_order_quantity": float(item.suggested_purchase_order_quantity or 0),
                        "material_source_type": item.material_source_type,
                    })

                preview_data = {
                    "computation_code": computation.computation_code,
                    "computation_type": computation.computation_type,
                    "item_count": len(preview_items),
                    "items": preview_items,
                }
                raise _PreviewResultCarrier(preview_data)

        except _PreviewResultCarrier as e:
            return e.preview_data
        except Exception:
            raise

    async def recompute_computation(
        self,
        tenant_id: int,
        computation_id: int,
        operator_id: Optional[int] = None,
    ) -> DemandComputationResponse:
        """
        重新计算：仅允许对「完成」或「失败」的计算重新执行。
        重算前写入需求计算快照与重算历史；再删除原明细、重置状态并执行计算。
        """
        snapshot_id_saved: Optional[int] = None
        async with in_transaction():
            computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
            if not computation:
                raise NotFoundError(f"需求计算不存在: {computation_id}")
            if computation.computation_status not in ("完成", "失败"):
                raise BusinessLogicError(
                    f"只能对已完成或失败的计算执行重新计算，当前状态: {computation.computation_status}"
                )
            # 重算前快照：当前汇总 + 明细
            items_before = await DemandComputationItem.filter(
                tenant_id=tenant_id, computation_id=computation_id
            ).all()
            summary_snapshot = computation.computation_summary
            items_snapshot = [
                {
                    "material_code": getattr(i, "material_code", None),
                    "material_name": getattr(i, "material_name", None),
                    "suggested_work_order_quantity": str(getattr(i, "suggested_work_order_quantity", 0)),
                    "suggested_purchase_order_quantity": str(getattr(i, "suggested_purchase_order_quantity", 0)),
                }
                for i in items_before
            ]
            snapshot = await DemandComputationSnapshot.create(
                tenant_id=tenant_id,
                computation_id=computation_id,
                snapshot_at=datetime.now(),
                trigger="manual",
                computation_summary_snapshot=summary_snapshot,
                items_snapshot=items_snapshot,
            )
            snapshot_id_saved = snapshot.id
            # 删除原计算结果明细
            await DemandComputationItem.filter(
                tenant_id=tenant_id,
                computation_id=computation_id
            ).delete()
            # 重置状态与错误信息，便于走执行逻辑
            await DemandComputation.filter(tenant_id=tenant_id, id=computation_id).update(
                computation_status="进行中",
                computation_end_time=None,
                error_message=None,
                computation_summary=None,
            )
        # 在事务外调用 execute，避免嵌套事务导致 TransactionManagementError
        try:
            result = await self.execute_computation(tenant_id=tenant_id, computation_id=computation_id)
            await DemandComputationRecalcHistory.create(
                tenant_id=tenant_id,
                computation_id=computation_id,
                recalc_at=datetime.now(),
                trigger="manual",
                operator_id=operator_id,
                result="success",
                snapshot_id=snapshot_id_saved,
                message="重算完成",
            )
            return result
        except Exception as e:
            await DemandComputationRecalcHistory.create(
                tenant_id=tenant_id,
                computation_id=computation_id,
                recalc_at=datetime.now(),
                trigger="manual",
                operator_id=operator_id,
                result="failed",
                snapshot_id=snapshot_id_saved,
                message=str(e)[:500],
            )
            raise

    async def list_computation_recalc_history(
        self, tenant_id: int, computation_id: int, limit: int = 50
    ) -> List[Dict[str, Any]]:
        """获取需求计算重算历史列表。"""
        computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
        if not computation:
            raise NotFoundError("需求计算", str(computation_id))
        rows = await DemandComputationRecalcHistory.filter(
            tenant_id=tenant_id, computation_id=computation_id
        ).order_by("-recalc_at").limit(limit)
        return [
            {
                "id": r.id,
                "recalc_at": r.recalc_at.isoformat() if r.recalc_at else None,
                "trigger": r.trigger,
                "operator_id": r.operator_id,
                "result": r.result,
                "snapshot_id": r.snapshot_id,
                "message": r.message,
            }
            for r in rows
        ]

    async def list_computation_snapshots(
        self, tenant_id: int, computation_id: int, limit: int = 20
    ) -> List[Dict[str, Any]]:
        """获取需求计算快照列表。"""
        computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
        if not computation:
            raise NotFoundError("需求计算", str(computation_id))
        rows = await DemandComputationSnapshot.filter(
            tenant_id=tenant_id, computation_id=computation_id
        ).order_by("-snapshot_at").limit(limit)
        return [
            {
                "id": r.id,
                "snapshot_at": r.snapshot_at.isoformat() if r.snapshot_at else None,
                "trigger": r.trigger,
                "computation_summary_snapshot": r.computation_summary_snapshot,
                "items_snapshot": r.items_snapshot,
            }
            for r in rows
        ]

    async def compare_computations(
        self,
        tenant_id: int,
        computation_id1: int,
        computation_id2: int
    ) -> Dict[str, Any]:
        """
        对比两个需求计算结果
        
        Args:
            tenant_id: 租户ID
            computation_id1: 第一个计算ID
            computation_id2: 第二个计算ID
            
        Returns:
            Dict: 对比结果，包含差异分析
        """
        computation1 = await self.get_computation_by_id(tenant_id, computation_id1, include_items=True)
        computation2 = await self.get_computation_by_id(tenant_id, computation_id2, include_items=True)
        
        # 对比基本信息
        basic_diff = {
            "computation_type": {
                "value1": computation1.computation_type,
                "value2": computation2.computation_type,
                "same": computation1.computation_type == computation2.computation_type
            },
            "computation_params": {
                "value1": computation1.computation_params,
                "value2": computation2.computation_params,
                "same": computation1.computation_params == computation2.computation_params
            },
            "computation_summary": {
                "value1": computation1.computation_summary,
                "value2": computation2.computation_summary,
                "same": computation1.computation_summary == computation2.computation_summary
            }
        }
        
        # 对比明细项
        items1 = {item.material_id: item for item in computation1.items or []}
        items2 = {item.material_id: item for item in computation2.items or []}
        
        all_material_ids = set(items1.keys()) | set(items2.keys())
        
        items_diff = []
        for material_id in all_material_ids:
            item1 = items1.get(material_id)
            item2 = items2.get(material_id)
            
            if item1 and item2:
                # 两个计算都有该物料，对比差异
                item_diff = {
                    "material_id": material_id,
                    "material_code": item1.material_code,
                    "material_name": item1.material_name,
                    "exists_in_both": True,
                    "differences": {}
                }
                
                # 对比关键字段
                key_fields = [
                    "required_quantity", "available_inventory", "net_requirement",
                    "suggested_work_order_quantity", "suggested_purchase_order_quantity"
                ]
                
                for field in key_fields:
                    val1 = getattr(item1, field, None)
                    val2 = getattr(item2, field, None)
                    if val1 != val2:
                        item_diff["differences"][field] = {
                            "value1": float(val1) if val1 else None,
                            "value2": float(val2) if val2 else None,
                            "diff": float(val2) - float(val1) if val1 and val2 else None
                        }
                
                if item_diff["differences"]:
                    items_diff.append(item_diff)
            elif item1:
                # 只在第一个计算中存在
                items_diff.append({
                    "material_id": material_id,
                    "material_code": item1.material_code,
                    "material_name": item1.material_name,
                    "exists_in_both": False,
                    "only_in": "computation1"
                })
            elif item2:
                # 只在第二个计算中存在
                items_diff.append({
                    "material_id": material_id,
                    "material_code": item2.material_code,
                    "material_name": item2.material_name,
                    "exists_in_both": False,
                    "only_in": "computation2"
                })
        
        return {
            "computation1": {
                "id": computation1.id,
                "computation_code": computation1.computation_code,
                "computation_start_time": computation1.computation_start_time,
                "computation_end_time": computation1.computation_end_time,
            },
            "computation2": {
                "id": computation2.id,
                "computation_code": computation2.computation_code,
                "computation_start_time": computation2.computation_start_time,
                "computation_end_time": computation2.computation_end_time,
            },
            "basic_diff": basic_diff,
            "items_diff": items_diff,
            "total_differences": len(items_diff)
        }
    
    async def _execute_mrp_computation(
        self,
        tenant_id: int,
        computation: DemandComputation
    ) -> None:
        """
        执行MRP计算（物料需求计划）
        
        应用物料来源控制逻辑：
        - 自制件：生成生产工单需求
        - 采购件：生成采购订单需求
        - 虚拟件：自动跳过，直接展开下层物料
        - 委外件：生成委外工单需求
        - 配置件：按变体展开BOM
        
        Args:
            tenant_id: 租户ID
            computation: 计算对象
        """
        from apps.kuaizhizao.models.demand_item import DemandItem
        from apps.master_data.models.material import Material
        
        logger.info(f"执行MRP计算: {computation.computation_code}")
        # 1. 获取需求明细（支持多需求合并）
        demand_id_list = computation.demand_ids if computation.demand_ids else [computation.demand_id]
        demand_items = []
        for demand_id in demand_id_list:
            items = await DemandItem.filter(
                tenant_id=tenant_id,
                demand_id=demand_id
            ).all()
            demand_items.extend(items)
        
        if not demand_items:
            logger.warning(f"需求明细为空，计算ID: {computation.id}")
            return
        
        # 2. 计算参数（库存相关开关、BOM版本）
        computation_params = computation.computation_params or {}
        include_safety_stock = computation_params.get("include_safety_stock", True)
        # BOM 版本：根据 bom_multi_version_allowed 决定使用指定版本或默认版本
        biz_config = BusinessConfigService()
        bom_multi_allowed = await biz_config.get_bom_multi_version_allowed(tenant_id)
        if bom_multi_allowed:
            bom_version = computation_params.get("bom_version")
            material_bom_versions = computation_params.get("material_bom_versions")
            use_default_bom = False
        else:
            bom_version = None
            material_bom_versions = None
            use_default_bom = True

        # 3. 存储所有物料需求（用于汇总）
        all_material_requirements = {}  # material_id -> requirement info
        
        # 4. 处理每个需求明细
        for demand_item in demand_items:
            material_id = demand_item.material_id
            required_quantity = float(demand_item.required_quantity or 0)
            
            if required_quantity <= 0:
                continue
            
            # 获取物料信息
            material = await Material.get_or_none(tenant_id=tenant_id, id=material_id)
            if not material:
                logger.warning(f"物料不存在，物料ID: {material_id}")
                continue
            
            # 获取物料来源类型
            source_type = await get_material_source_type(tenant_id, material_id)
            
            # 验证物料来源配置
            validation_passed, validation_errors = await validate_material_source_config(
                tenant_id=tenant_id,
                material_id=material_id,
                source_type=source_type or "Make"  # 默认自制件
            )
            
            # 获取物料来源配置
            source_config = await get_material_source_config(tenant_id, material_id) or {}
            
            # 处理不同来源类型的物料
            if source_type == SOURCE_TYPE_PHANTOM:
                # 虚拟件：自动跳过，直接展开下层物料
                logger.debug(f"处理虚拟件，物料ID: {material_id}, 物料编码: {material.main_code}")
                
                # 使用物料来源控制的BOM展开逻辑
                expanded_requirements = await expand_bom_with_source_control(
                    tenant_id=tenant_id,
                    material_id=material_id,
                    required_quantity=required_quantity,
                    only_approved=True,
                    bom_version=bom_version,
                    use_default_bom=use_default_bom,
                    material_bom_versions=material_bom_versions,
                )
                
                # 合并到总需求中
                for req in expanded_requirements:
                    req_material_id = req["material_id"]
                    if req_material_id not in all_material_requirements:
                        all_material_requirements[req_material_id] = {
                            "material_id": req_material_id,
                            "material_code": req["material_code"],
                            "material_name": req["material_name"],
                            "material_type": req.get("material_type"),
                            "source_type": req.get("source_type"),
                            "required_quantity": 0.0,
                            "unit": req.get("unit"),
                        }
                    all_material_requirements[req_material_id]["required_quantity"] += req["required_quantity"]
                    
            elif source_type == SOURCE_TYPE_CONFIGURE:
                # 配置件：按变体展开BOM（TODO: 需要从需求中获取配置信息）
                logger.debug(f"处理配置件，物料ID: {material_id}, 物料编码: {material.main_code}")
                
                # 暂时按标准BOM展开处理（后续需要支持变体选择）
                expanded_requirements = await expand_bom_with_source_control(
                    tenant_id=tenant_id,
                    material_id=material_id,
                    required_quantity=required_quantity,
                    only_approved=True,
                    bom_version=bom_version,
                    use_default_bom=use_default_bom,
                    material_bom_versions=material_bom_versions,
                )
                
                # 合并到总需求中
                for req in expanded_requirements:
                    req_material_id = req["material_id"]
                    if req_material_id not in all_material_requirements:
                        all_material_requirements[req_material_id] = {
                            "material_id": req_material_id,
                            "material_code": req["material_code"],
                            "material_name": req["material_name"],
                            "material_type": req.get("material_type"),
                            "source_type": req.get("source_type"),
                            "required_quantity": 0.0,
                            "unit": req.get("unit"),
                        }
                    all_material_requirements[req_material_id]["required_quantity"] += req["required_quantity"]
                
            else:
                # 其他类型（自制件、采购件、委外件）：正常处理
                if material_id not in all_material_requirements:
                    all_material_requirements[material_id] = {
                        "material_id": material_id,
                        "material_code": material.main_code or material.code,
                        "material_name": material.name,
                        "material_type": material.material_type,
                        "source_type": source_type,
                        "required_quantity": 0.0,
                        "unit": material.base_unit,
                    }
                all_material_requirements[material_id]["required_quantity"] += required_quantity
                
                # 如果有BOM，展开BOM（顶层物料优先从 material_bom_versions 取版本）
                from apps.kuaizhizao.utils.bom_helper import get_bom_items_by_material_id
                top_version = bom_version
                top_use_default = use_default_bom
                if material_bom_versions:
                    v = material_bom_versions.get(material_id) or material_bom_versions.get(str(material_id))
                    if v:
                        top_version = v
                        top_use_default = False
                    elif not bom_version:
                        top_use_default = True
                bom_items = await get_bom_items_by_material_id(
                    tenant_id=tenant_id,
                    material_id=material_id,
                    only_approved=True,
                    version=top_version,
                    use_default=top_use_default,
                )

                if bom_items:
                    # 展开BOM（使用物料来源控制逻辑）
                    expanded_requirements = await expand_bom_with_source_control(
                        tenant_id=tenant_id,
                        material_id=material_id,
                        required_quantity=required_quantity,
                        only_approved=True,
                        bom_version=bom_version,
                        use_default_bom=use_default_bom,
                        material_bom_versions=material_bom_versions,
                    )

                    # 合并到总需求中
                    for req in expanded_requirements:
                        req_material_id = req["material_id"]
                        if req_material_id not in all_material_requirements:
                            all_material_requirements[req_material_id] = {
                                "material_id": req_material_id,
                                "material_code": req["material_code"],
                                "material_name": req["material_name"],
                                "material_type": req.get("material_type"),
                                "source_type": req.get("source_type"),
                                "required_quantity": 0.0,
                                "unit": req.get("unit"),
                            }
                        all_material_requirements[req_material_id]["required_quantity"] += req["required_quantity"]
                        # 记录需求明细ID用于追溯
                        if "demand_item_ids" not in all_material_requirements[req_material_id]:
                            all_material_requirements[req_material_id]["demand_item_ids"] = []
                        if demand_item.id not in all_material_requirements[req_material_id]["demand_item_ids"]:
                            all_material_requirements[req_material_id]["demand_item_ids"].append(demand_item.id)
        
        # 5. 生成计算结果明细
        for material_id, req_info in all_material_requirements.items():
            # 获取物料信息
            material = await Material.get_or_none(tenant_id=tenant_id, id=material_id)
            if not material:
                continue
            
            source_type = req_info.get("source_type") or material.source_type
            
            # 验证物料来源配置
            validation_passed, validation_errors = await validate_material_source_config(
                tenant_id=tenant_id,
                material_id=material_id,
                source_type=source_type or "Make"
            )
            
            # 获取物料来源配置
            source_config = await get_material_source_config(tenant_id, material_id) or {}
            
            # 获取库存信息与安全库存/再订货点
            inventory_info = await get_material_inventory_info(
                tenant_id=tenant_id,
                material_id=material_id,
                warehouse_id=None,
            )
            safety_stock, reorder_point = await _get_material_safety_reorder(
                tenant_id=tenant_id,
                material=material,
                material_id=material_id,
                computation_params=computation_params,
            )
            supply_qty, net_requirement = _compute_supply_and_net(
                inventory_info=inventory_info,
                safety_stock=safety_stock,
                reorder_point=reorder_point,
                gross_requirement=req_info["required_quantity"],
                computation_params=computation_params,
            )
            available_inventory = float(inventory_info.get("available_quantity", 0))
            in_transit_qty = float(inventory_info.get("in_transit_quantity", 0))
            reserved_qty = float(inventory_info.get("reserved_quantity", 0))
            gross_requirement = req_info["required_quantity"]

            # 根据物料来源类型确定建议行动
            suggested_work_order_quantity = Decimal(0)
            suggested_purchase_order_quantity = Decimal(0)
            
            if source_type == SOURCE_TYPE_MAKE:
                # 自制件：建议生成生产工单
                if net_requirement > 0 and validation_passed:
                    suggested_work_order_quantity = Decimal(str(net_requirement))
            elif source_type == SOURCE_TYPE_BUY:
                # 采购件：建议生成采购订单
                if net_requirement > 0:
                    suggested_purchase_order_quantity = Decimal(str(net_requirement))
            elif source_type == SOURCE_TYPE_OUTSOURCE:
                # 委外件：建议生成委外工单（有净需求即显示建议数量，与采购件一致；验证失败时生成工单会拦截）
                if net_requirement > 0:
                    suggested_work_order_quantity = Decimal(str(net_requirement))
            # Phantom和Configure已经在BOM展开时处理，不需要单独生成工单或采购单
            
            # 创建计算结果明细（包含需求明细追溯）
            await DemandComputationItem.create(
                tenant_id=tenant_id,
                computation_id=computation.id,
                material_id=material_id,
                material_code=req_info["material_code"],
                material_name=req_info["material_name"],
                material_spec=material.specification,
                material_unit=req_info["unit"],
                required_quantity=Decimal(str(gross_requirement)),
                available_inventory=Decimal(str(available_inventory)),
                net_requirement=Decimal(str(net_requirement)),
                gross_requirement=Decimal(str(gross_requirement)),
                safety_stock=Decimal(str(safety_stock)) if include_safety_stock else None,
                reorder_point=Decimal(str(reorder_point)) if computation_params.get("include_reorder_point", False) else None,
                suggested_work_order_quantity=suggested_work_order_quantity if suggested_work_order_quantity > 0 else None,
                suggested_purchase_order_quantity=suggested_purchase_order_quantity if suggested_purchase_order_quantity > 0 else None,
                material_source_type=source_type,
                material_source_config=source_config,
                source_validation_passed=validation_passed,
                source_validation_errors=validation_errors if not validation_passed else None,
                demand_item_ids=req_info.get("demand_item_ids"),  # 多需求追溯
                detail_results={"in_transit_quantity": in_transit_qty, "reserved_quantity": reserved_qty},  # 库存追溯
            )
    
    async def _execute_lrp_computation(
        self,
        tenant_id: int,
        computation: DemandComputation
    ) -> None:
        """
        执行LRP计算（物流需求计划）
        
        应用物料来源控制逻辑：
        - 自制件：生成生产计划（需要BOM和工艺路线）
        - 采购件：生成采购计划（自动填充默认供应商）
        - 虚拟件：自动跳过，直接展开下层物料
        - 委外件：生成委外计划
        - 配置件：按变体展开BOM
        
        Args:
            tenant_id: 租户ID
            computation: 计算对象
        """
        from apps.kuaizhizao.models.demand_item import DemandItem
        from apps.master_data.models.material import Material
        
        logger.info(f"执行LRP计算: {computation.computation_code}")
        
        # 1. 获取需求明细（支持多需求合并）
        demand_id_list = computation.demand_ids if computation.demand_ids else [computation.demand_id]
        demand_items = []
        for demand_id in demand_id_list:
            items = await DemandItem.filter(
                tenant_id=tenant_id,
                demand_id=demand_id
            ).all()
            demand_items.extend(items)
        
        if not demand_items:
            logger.warning(f"需求明细为空，计算ID: {computation.id}")
            return
        
        # 2. 计算参数（含 BOM 版本、4M 人机料法开关）
        computation_params = computation.computation_params or {}
        consider_capacity = computation_params.get("consider_capacity", True)
        consider_material_readiness = computation_params.get("consider_material_readiness", True)
        consider_equipment_availability = computation_params.get("consider_equipment_availability", False)
        consider_mold_tool_availability = computation_params.get("consider_mold_tool_availability", False)
        logger.debug(
            f"LRP 4M 约束: capacity={consider_capacity}, material={consider_material_readiness}, "
            f"equipment={consider_equipment_availability}, mold_tool={consider_mold_tool_availability}"
        )
        biz_config = BusinessConfigService()
        bom_multi_allowed = await biz_config.get_bom_multi_version_allowed(tenant_id)
        if bom_multi_allowed:
            bom_version = computation_params.get("bom_version")
            material_bom_versions = computation_params.get("material_bom_versions")
            use_default_bom = False
        else:
            bom_version = None
            material_bom_versions = None
            use_default_bom = True

        # 3. 存储所有物料需求（用于汇总）
        all_material_requirements = {}  # material_id -> requirement info
        
        # 4. 处理每个需求明细
        for demand_item in demand_items:
            material_id = demand_item.material_id
            required_quantity = float(demand_item.required_quantity or 0)
            delivery_date = getattr(demand_item, 'delivery_date', None)  # 销售订单的交货日期
            
            if required_quantity <= 0:
                continue
            
            # 获取物料信息
            material = await Material.get_or_none(tenant_id=tenant_id, id=material_id)
            if not material:
                logger.warning(f"物料不存在，物料ID: {material_id}")
                continue
            
            # 获取物料来源类型
            source_type = await get_material_source_type(tenant_id, material_id)
            
            # 验证物料来源配置
            validation_passed, validation_errors = await validate_material_source_config(
                tenant_id=tenant_id,
                material_id=material_id,
                source_type=source_type or "Make"
            )
            
            # 获取物料来源配置
            source_config = await get_material_source_config(tenant_id, material_id) or {}
            
            # 处理不同来源类型的物料（类似MRP逻辑）
            if source_type == SOURCE_TYPE_PHANTOM:
                # 虚拟件：自动跳过，直接展开下层物料
                expanded_requirements = await expand_bom_with_source_control(
                    tenant_id=tenant_id,
                    material_id=material_id,
                    required_quantity=required_quantity,
                    only_approved=True,
                    bom_version=bom_version,
                    use_default_bom=use_default_bom,
                    material_bom_versions=material_bom_versions,
                )
                
                for req in expanded_requirements:
                    req_material_id = req["material_id"]
                    if req_material_id not in all_material_requirements:
                        all_material_requirements[req_material_id] = {
                            "material_id": req_material_id,
                            "material_code": req["material_code"],
                            "material_name": req["material_name"],
                            "material_type": req.get("material_type"),
                            "source_type": req.get("source_type"),
                            "required_quantity": 0.0,
                            "unit": req.get("unit"),
                            "delivery_date": delivery_date,
                        }
                    all_material_requirements[req_material_id]["required_quantity"] += req["required_quantity"]
                    
            elif source_type == SOURCE_TYPE_CONFIGURE:
                # 配置件：按变体展开BOM（TODO: 需要从需求中获取配置信息）
                expanded_requirements = await expand_bom_with_source_control(
                    tenant_id=tenant_id,
                    material_id=material_id,
                    required_quantity=required_quantity,
                    only_approved=True,
                    bom_version=bom_version,
                    use_default_bom=use_default_bom,
                    material_bom_versions=material_bom_versions,
                )
                
                for req in expanded_requirements:
                    req_material_id = req["material_id"]
                    if req_material_id not in all_material_requirements:
                        all_material_requirements[req_material_id] = {
                            "material_id": req_material_id,
                            "material_code": req["material_code"],
                            "material_name": req["material_name"],
                            "material_type": req.get("material_type"),
                            "source_type": req.get("source_type"),
                            "required_quantity": 0.0,
                            "unit": req.get("unit"),
                            "delivery_date": delivery_date,
                        }
                    all_material_requirements[req_material_id]["required_quantity"] += req["required_quantity"]
            else:
                # 其他类型（自制件、采购件、委外件）：正常处理
                if material_id not in all_material_requirements:
                    all_material_requirements[material_id] = {
                        "material_id": material_id,
                        "material_code": material.main_code or material.code,
                        "material_name": material.name,
                        "material_type": material.material_type,
                        "source_type": source_type,
                        "required_quantity": 0.0,
                        "unit": material.base_unit,
                        "delivery_date": delivery_date,
                    }
                all_material_requirements[material_id]["required_quantity"] += required_quantity
                
                # 如果有BOM，展开BOM（顶层物料优先从 material_bom_versions 取版本）
                from apps.kuaizhizao.utils.bom_helper import get_bom_items_by_material_id
                top_version = bom_version
                top_use_default = use_default_bom
                if material_bom_versions:
                    v = material_bom_versions.get(material_id) or material_bom_versions.get(str(material_id))
                    if v:
                        top_version = v
                        top_use_default = False
                    elif not bom_version:
                        top_use_default = True
                bom_items = await get_bom_items_by_material_id(
                    tenant_id=tenant_id,
                    material_id=material_id,
                    only_approved=True,
                    version=top_version,
                    use_default=top_use_default,
                )

                if bom_items:
                    expanded_requirements = await expand_bom_with_source_control(
                        tenant_id=tenant_id,
                        material_id=material_id,
                        required_quantity=required_quantity,
                        only_approved=True,
                        bom_version=bom_version,
                        use_default_bom=use_default_bom,
                        material_bom_versions=material_bom_versions,
                    )

                    for req in expanded_requirements:
                        req_material_id = req["material_id"]
                        if req_material_id not in all_material_requirements:
                            all_material_requirements[req_material_id] = {
                                "material_id": req_material_id,
                                "material_code": req["material_code"],
                                "material_name": req["material_name"],
                                "material_type": req.get("material_type"),
                                "source_type": req.get("source_type"),
                                "required_quantity": 0.0,
                                "unit": req.get("unit"),
                                "delivery_date": delivery_date,
                            }
                        all_material_requirements[req_material_id]["required_quantity"] += req["required_quantity"]
        
        # 5. 生成计算结果明细（包含时间安排）
        for material_id, req_info in all_material_requirements.items():
            material = await Material.get_or_none(tenant_id=tenant_id, id=material_id)
            if not material:
                continue
            
            source_type = req_info.get("source_type") or material.source_type
            
            # 验证物料来源配置
            validation_passed, validation_errors = await validate_material_source_config(
                tenant_id=tenant_id,
                material_id=material_id,
                source_type=source_type or "Make"
            )
            
            # 获取物料来源配置
            source_config = await get_material_source_config(tenant_id, material_id) or {}
            
            # 获取库存信息与安全库存/再订货点，计算净需求
            computation_params = computation.computation_params or {}
            inventory_info = await get_material_inventory_info(
                tenant_id=tenant_id,
                material_id=material_id,
                warehouse_id=None,
            )
            safety_stock, reorder_point = await _get_material_safety_reorder(
                tenant_id=tenant_id,
                material=material,
                material_id=material_id,
                computation_params=computation_params,
            )
            _, net_requirement = _compute_supply_and_net(
                inventory_info=inventory_info,
                safety_stock=safety_stock,
                reorder_point=reorder_point,
                gross_requirement=req_info["required_quantity"],
                computation_params=computation_params,
            )
            available_inventory = float(inventory_info.get("available_quantity", 0))
            in_transit_qty = float(inventory_info.get("in_transit_quantity", 0))
            reserved_qty = float(inventory_info.get("reserved_quantity", 0))
            gross_requirement = req_info["required_quantity"]

            # 计算时间安排
            delivery_date = req_info.get("delivery_date")
            production_start_date = None
            production_completion_date = None
            procurement_start_date = None
            procurement_completion_date = None
            
            # 根据物料来源类型确定建议行动和时间
            suggested_work_order_quantity = Decimal(0)
            suggested_purchase_order_quantity = Decimal(0)
            planned_production = Decimal(0)
            planned_procurement = Decimal(0)
            
            if source_type == SOURCE_TYPE_MAKE:
                # 自制件：生成生产计划
                if net_requirement > 0 and validation_passed:
                    suggested_work_order_quantity = Decimal(str(net_requirement))
                    planned_production = Decimal(str(net_requirement))
                    
                    # 计算生产时间（TODO: 从工艺路线获取提前期）
                    production_lead_time = source_config.get("source_config", {}).get("production_lead_time", 3)
                    if delivery_date:
                        production_completion_date = delivery_date
                        production_start_date = delivery_date - timedelta(days=production_lead_time)
            elif source_type == SOURCE_TYPE_BUY:
                # 采购件：生成采购计划
                if net_requirement > 0:
                    suggested_purchase_order_quantity = Decimal(str(net_requirement))
                    planned_procurement = Decimal(str(net_requirement))
                    
                    # 计算采购时间（TODO: 从物料主数据获取提前期）
                    purchase_lead_time = source_config.get("source_config", {}).get("purchase_lead_time", 7)
                    if delivery_date:
                        procurement_completion_date = delivery_date
                        procurement_start_date = delivery_date - timedelta(days=purchase_lead_time)
            elif source_type == SOURCE_TYPE_OUTSOURCE:
                # 委外件：生成委外计划（有净需求即显示建议数量；验证失败时生成工单会拦截）
                if net_requirement > 0:
                    suggested_work_order_quantity = Decimal(str(net_requirement))
                    planned_production = Decimal(str(net_requirement))
                    
                    # 计算委外时间
                    outsource_lead_time = source_config.get("source_config", {}).get("outsource_lead_time", 5)
                    if delivery_date:
                        production_completion_date = delivery_date
                        production_start_date = delivery_date - timedelta(days=outsource_lead_time)
            
            # 创建计算结果明细
            await DemandComputationItem.create(
                tenant_id=tenant_id,
                computation_id=computation.id,
                material_id=material_id,
                material_code=req_info["material_code"],
                material_name=req_info["material_name"],
                material_spec=material.specification,
                material_unit=req_info["unit"],
                required_quantity=Decimal(str(gross_requirement)),
                available_inventory=Decimal(str(available_inventory)),
                net_requirement=Decimal(str(net_requirement)),
                delivery_date=delivery_date,
                planned_production=planned_production if planned_production > 0 else None,
                planned_procurement=planned_procurement if planned_procurement > 0 else None,
                production_start_date=production_start_date,
                production_completion_date=production_completion_date,
                procurement_start_date=procurement_start_date,
                procurement_completion_date=procurement_completion_date,
                suggested_work_order_quantity=suggested_work_order_quantity if suggested_work_order_quantity > 0 else None,
                suggested_purchase_order_quantity=suggested_purchase_order_quantity if suggested_purchase_order_quantity > 0 else None,
                material_source_type=source_type,
                material_source_config=source_config,
                source_validation_passed=validation_passed,
                source_validation_errors=validation_errors if not validation_passed else None,
                demand_item_ids=req_info.get("demand_item_ids"),  # 多需求追溯
                detail_results={"in_transit_quantity": in_transit_qty, "reserved_quantity": reserved_qty},  # 库存追溯
            )
    
    async def update_computation(
        self,
        tenant_id: int,
        computation_id: int,
        computation_data: DemandComputationUpdate,
        updated_by: int
    ) -> DemandComputationResponse:
        """
        更新需求计算
        
        Args:
            tenant_id: 租户ID
            computation_id: 计算ID
            computation_data: 更新数据
            updated_by: 更新人ID
            
        Returns:
            DemandComputationResponse: 更新后的计算响应
        """
        async with in_transaction():
            computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
            if not computation:
                raise NotFoundError(f"需求计算不存在: {computation_id}")
            
            # 只能更新进行中或失败状态的计算
            if computation.computation_status not in ["进行中", "失败"]:
                raise BusinessLogicError(f"只能更新进行中或失败状态的计算，当前状态: {computation.computation_status}")
            
            # 准备更新数据
            update_data = computation_data.model_dump(exclude_unset=True)
            update_data['updated_by'] = updated_by
            
            # 更新计算
            await DemandComputation.filter(tenant_id=tenant_id, id=computation_id).update(**update_data)
            
            # 返回更新后的计算
            items = await DemandComputationItem.filter(
                tenant_id=tenant_id,
                computation_id=computation_id
            ).all()
            return await self._build_computation_response(
                await DemandComputation.get(tenant_id=tenant_id, id=computation_id),
                items
            )

    async def delete_computation(
        self,
        tenant_id: int,
        computation_id: int
    ) -> None:
        """
        删除需求计算

        若下游单据（工单/采购单/生产计划/采购申请）未执行，允许删除并级联删除；已执行则不允许删除。
        删除时会同步清除关联的需求计算明细、快照、重算历史及单据关联关系，并更新需求的 pushed_to_computation 状态。

        Args:
            tenant_id: 租户ID
            computation_id: 计算ID

        Raises:
            NotFoundError: 需求计算不存在
            BusinessLogicError: 已有已执行的下游单据，无法删除
        """
        from apps.kuaizhizao.models.document_relation import DocumentRelation
        from apps.kuaizhizao.services.demand_service import DemandService

        DOWNSTREAM_TYPES = ("work_order", "purchase_order", "purchase_requisition", "production_plan")

        async with in_transaction():
            computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
            if not computation:
                raise NotFoundError(f"需求计算不存在: {computation_id}")

            demand_svc = DemandService()
            downstream_rels = await DocumentRelation.filter(
                tenant_id=tenant_id,
                source_type="demand_computation",
                source_id=computation_id,
                target_type__in=DOWNSTREAM_TYPES
            ).all()

            for rel in downstream_rels:
                if await demand_svc._is_downstream_executed(tenant_id, rel.target_type, rel.target_id):
                    raise BusinessLogicError(
                        "需求计算已下推的工单/采购单等下游单据已执行，无法删除。请先处理已执行的下游单据。"
                    )

            if downstream_rels:
                await demand_svc._cascade_delete_unexecuted_downstream(tenant_id, computation_id)

            demand_ids_in_comp = computation.demand_ids if computation.demand_ids else [computation.demand_id]

            # 删除明细、快照、重算历史
            await DemandComputationItem.filter(
                tenant_id=tenant_id,
                computation_id=computation_id
            ).delete()
            await DemandComputationSnapshot.filter(
                tenant_id=tenant_id,
                computation_id=computation_id
            ).delete()
            await DemandComputationRecalcHistory.filter(
                tenant_id=tenant_id,
                computation_id=computation_id
            ).delete()

            # 删除单据关联（双向）
            await DocumentRelation.filter(
                tenant_id=tenant_id,
                source_type="demand_computation",
                source_id=computation_id
            ).delete()
            await DocumentRelation.filter(
                tenant_id=tenant_id,
                target_type="demand_computation",
                target_id=computation_id
            ).delete()

            # 更新关联需求的 pushed_to_computation 状态
            for rel_demand_id in demand_ids_in_comp:
                await Demand.filter(tenant_id=tenant_id, id=rel_demand_id).update(
                    pushed_to_computation=False,
                    computation_id=None,
                    computation_code=None,
                    updated_at=datetime.now()
                )

            # 删除需求计算主记录
            await DemandComputation.filter(tenant_id=tenant_id, id=computation_id).delete()

            logger.info(f"需求计算 {computation.computation_code} (id={computation_id}) 已删除")

    async def generate_work_orders_and_purchase_orders(
        self,
        tenant_id: int,
        computation_id: int,
        created_by: int,
        generate_mode: str = "all",
        allow_draft: bool = False
    ) -> Dict[str, Any]:
        """
        从需求计算结果一键生成工单和采购单
        
        Args:
            tenant_id: 租户ID
            computation_id: 计算ID
            created_by: 创建人ID
            generate_mode: 生成粒度，all=全部，work_order_only=仅工单，purchase_only=仅采购
            allow_draft: 验证失败时是否仍生成草稿单，由下游用户补全
            
        Returns:
            Dict: 包含生成的工单和采购单信息
        """
        # 不使用外层 in_transaction，避免与 create_work_order/create_purchase_order 内部事务嵌套，
        # 导致内层失败后 PostgreSQL 报「当前事务被终止, 事务块结束之前的查询被忽略」
        computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
        if not computation:
            raise NotFoundError(f"需求计算不存在: {computation_id}")
        
        # 只能从已完成的计算生成
        if computation.computation_status != "完成":
            raise BusinessLogicError(f"只能从已完成的计算生成工单和采购单，当前状态: {computation.computation_status}")
        
        # 按配置校验：若必须经生产计划，则不允许直连生成工单（委外工单单独下推不受此限制）
        needs_work_order = generate_mode in ("all", "work_order_only")
        if needs_work_order:
            from infra.services.business_config_service import BusinessConfigService
            biz_config = BusinessConfigService()
            can_direct = await biz_config.can_direct_generate_work_order_from_computation(tenant_id)
            if not can_direct:
                raise BusinessLogicError(
                    "当前配置要求经生产计划生成工单，请先「下推到生产计划」，再在生产计划中执行转工单。"
                )
        
        # 获取计算结果明细
        items = await DemandComputationItem.filter(
            tenant_id=tenant_id,
            computation_id=computation_id
        ).all()
        
        if not items:
            raise BusinessLogicError("计算结果明细为空，无法生成工单和采购单")

        # 获取已下推且仍存在的单据，用于排除重复下推
        exclusions = await self._get_already_pushed_exclusions(tenant_id, computation_id)
        already_pushed_wo_material_ids = exclusions["wo_material_ids"] | exclusions["outsource_material_ids"]
        already_pushed_po_material_ids = exclusions["po_material_ids"]
        
        # #region agent log
        try:
            import json as _json
            _log_path = r"f:\dev\riveredge\.cursor\debug.log"
            _items_debug = [{"material_code": i.material_code, "source_type": i.material_source_type, "suggested_wo_qty": getattr(i, "suggested_work_order_quantity", None), "suggested_po_qty": getattr(i, "suggested_purchase_order_quantity", None)} for i in items]
            with open(_log_path, "a", encoding="utf-8") as _f:
                _f.write(_json.dumps({"location": "demand_computation_service.py:generate_orders", "message": "items_before_loop", "data": {"computation_id": computation_id, "generate_mode": generate_mode, "items_count": len(items), "items": _items_debug}, "timestamp": __import__("time").time() * 1000, "hypothesisId": "A,B"}) + "\n")
        except Exception:
            pass
        # #endregion
        
        # 【第一阶段：预验证】先验证所有物料，如有错误且未允许草稿则立即失败
        validation_errors = []
        failed_validation_material_ids = set()  # 验证失败的物料ID，allow_draft 时用于创建草稿
        
        for item in items:
            source_type = item.material_source_type
            
            # 跳过虚拟件（虚拟件不生成工单和采购单）
            if source_type == SOURCE_TYPE_PHANTOM:
                continue
            
            # 验证物料来源配置（验证失败时收集错误）
            if source_type:
                validation_passed, errors = await validate_material_source_config(
                    tenant_id=tenant_id,
                    material_id=item.material_id,
                    source_type=source_type
                )
                
                if not validation_passed:
                    validation_errors.extend([f"物料 {item.material_code} ({item.material_name}): {err}" for err in errors])
                    failed_validation_material_ids.add(item.material_id)
        
        # 如果有验证错误且未允许草稿，立即抛出异常（此时还未创建任何工单）
        if validation_errors and not allow_draft:
            error_msg = "物料来源验证失败，无法生成工单和采购单：\n" + "\n".join(validation_errors)
            logger.error(f"预验证失败: {error_msg}")
            raise BusinessLogicError(error_msg)
        
        # 【第二阶段：创建工单和采购单】验证全部通过后，开始创建
        work_orders = []  # 生产工单（WorkOrder，在工单管理页展示）
        outsource_work_orders = []  # 委外工单（OutsourceWorkOrder，在委外管理页展示）
        purchase_orders = []
        
        # 按供应商分组采购件（物料来源控制增强）
        purchase_items_by_supplier: Dict[int, List[DemandComputationItem]] = {}
        
        # 按物料聚合生产类明细（同一物料多行合并为一行，避免重复生成工单）
        def _build_aggregated_item(group: List[DemandComputationItem]):
            first = group[0]
            if len(group) == 1:
                return first
            total_qty = sum(float(g.suggested_work_order_quantity or 0) for g in group)
            start_dates = [g.production_start_date for g in group if g.production_start_date]
            end_dates = [g.production_completion_date for g in group if g.production_completion_date]
            return type("_AggregatedItem", (), {
                "material_id": first.material_id,
                "material_code": first.material_code,
                "material_name": first.material_name,
                "material_spec": first.material_spec,
                "material_unit": first.material_unit,
                "material_source_type": first.material_source_type,
                "material_source_config": first.material_source_config,
                "suggested_work_order_quantity": Decimal(str(total_qty)),
                "production_start_date": min(start_dates) if start_dates else None,
                "production_completion_date": max(end_dates) if end_dates else None,
            })()

        created_wo_material_ids: set = set(already_pushed_wo_material_ids)  # 已创建/已下推工单的物料ID，避免重复

        for item in items:
            source_type = item.material_source_type
            
            # 跳过虚拟件（虚拟件不生成工单和采购单）
            if source_type == SOURCE_TYPE_PHANTOM:
                # #region agent log
                try:
                    with open(r"f:\dev\riveredge\.cursor\debug.log", "a", encoding="utf-8") as _f:
                        _f.write(__import__("json").dumps({"location": "demand_computation_service.py:loop", "message": "skip_phantom", "data": {"material_code": item.material_code}, "hypothesisId": "A"}) + "\n")
                except Exception:
                    pass
                # #endregion
                logger.debug(f"跳过虚拟件，不生成工单和采购单，物料ID: {item.material_id}")
                continue
            
            # 根据 generate_mode 决定是否生成
            if generate_mode == "purchase_only" and source_type in (SOURCE_TYPE_MAKE, SOURCE_TYPE_OUTSOURCE, SOURCE_TYPE_CONFIGURE):
                continue
            if generate_mode == "work_order_only" and source_type == SOURCE_TYPE_BUY:
                # #region agent log
                try:
                    with open(r"f:\dev\riveredge\.cursor\debug.log", "a", encoding="utf-8") as _f:
                        _f.write(__import__("json").dumps({"location": "demand_computation_service.py:loop", "message": "skip_buy_work_order_only", "data": {"material_code": item.material_code}, "hypothesisId": "A"}) + "\n")
                except Exception:
                    pass
                # #endregion
                continue
            if generate_mode == "outsource_only" and source_type != SOURCE_TYPE_OUTSOURCE:
                continue

            # 根据物料来源类型生成相应的单据
            if source_type == SOURCE_TYPE_MAKE:
                # 自制件：生成生产工单（按物料聚合，避免重复）
                if item.material_id in created_wo_material_ids:
                    continue
                sq = getattr(item, "suggested_work_order_quantity", None)
                if not (sq and sq > 0):
                    # #region agent log
                    try:
                        with open(r"f:\dev\riveredge\.cursor\debug.log", "a", encoding="utf-8") as _f:
                            _f.write(__import__("json").dumps({"location": "demand_computation_service.py:loop", "message": "skip_make_no_qty", "data": {"material_code": item.material_code, "suggested_work_order_quantity": sq}, "hypothesisId": "A"}) + "\n")
                    except Exception:
                        pass
                    # #endregion
                if item.suggested_work_order_quantity and item.suggested_work_order_quantity > 0:
                    same_material = [i for i in items if i.material_id == item.material_id and i.material_source_type == SOURCE_TYPE_MAKE and (float(i.suggested_work_order_quantity or 0) > 0)]
                    agg_item = _build_aggregated_item(same_material)
                    allow_draft_for_item = allow_draft and item.material_id in failed_validation_material_ids
                    work_order = await self._create_work_order_from_item(
                        tenant_id=tenant_id,
                        computation=computation,
                        item=agg_item,
                        created_by=created_by,
                        allow_draft=allow_draft_for_item,
                    )
                    work_orders.append(work_order)
                    created_wo_material_ids.add(item.material_id)
                    
            elif source_type == SOURCE_TYPE_BUY:
                # 采购件：仅当配置了默认供应商时直接生成采购单；未配置的需通过「下推到采购申请」
                # 排除已下推且仍存在的采购单中的物料，避免重复
                if item.material_id in already_pushed_po_material_ids:
                    continue
                if item.suggested_purchase_order_quantity and item.suggested_purchase_order_quantity > 0:
                    supplier_id = None
                    if item.material_source_config:
                        source_config = item.material_source_config.get("source_config", {})
                        supplier_id = source_config.get("default_supplier_id")
                    if supplier_id:
                        if supplier_id not in purchase_items_by_supplier:
                            purchase_items_by_supplier[supplier_id] = []
                        purchase_items_by_supplier[supplier_id].append(item)
                    
            elif source_type == SOURCE_TYPE_OUTSOURCE:
                # 委外件：生成委外工单（按物料聚合，避免重复）
                if item.material_id in created_wo_material_ids:
                    continue
                if item.suggested_work_order_quantity and item.suggested_work_order_quantity > 0:
                    same_material = [i for i in items if i.material_id == item.material_id and i.material_source_type == SOURCE_TYPE_OUTSOURCE and (float(i.suggested_work_order_quantity or 0) > 0)]
                    agg_item = _build_aggregated_item(same_material)
                    allow_draft_for_item = allow_draft and item.material_id in failed_validation_material_ids
                    work_order = await self._create_outsource_work_order_from_item(
                        tenant_id=tenant_id,
                        computation=computation,
                        item=agg_item,
                        created_by=created_by,
                        allow_draft=allow_draft_for_item,
                    )
                    outsource_work_orders.append(work_order)
                    created_wo_material_ids.add(item.material_id)
                    
            elif source_type == SOURCE_TYPE_CONFIGURE:
                # 配置件：按变体生成生产工单（按物料聚合，避免重复）
                if item.material_id in created_wo_material_ids:
                    continue
                if item.suggested_work_order_quantity and item.suggested_work_order_quantity > 0:
                    same_material = [i for i in items if i.material_id == item.material_id and i.material_source_type == SOURCE_TYPE_CONFIGURE and (float(i.suggested_work_order_quantity or 0) > 0)]
                    agg_item = _build_aggregated_item(same_material)
                    allow_draft_for_item = allow_draft and item.material_id in failed_validation_material_ids
                    work_order = await self._create_work_order_from_item(
                        tenant_id=tenant_id,
                        computation=computation,
                        item=agg_item,
                        created_by=created_by,
                        allow_draft=allow_draft_for_item,
                    )
                    work_orders.append(work_order)
                    created_wo_material_ids.add(item.material_id)
            
            # 兼容旧逻辑：如果没有物料来源类型，根据建议数量生成（向后兼容，按物料聚合）
            elif not source_type:
                # #region agent log
                try:
                    with open(r"f:\dev\riveredge\.cursor\debug.log", "a", encoding="utf-8") as _f:
                        _f.write(__import__("json").dumps({"location": "demand_computation_service.py:loop", "message": "no_source_type_legacy", "data": {"material_code": item.material_code, "suggested_wo_qty": getattr(item, "suggested_work_order_quantity", None)}, "hypothesisId": "B"}) + "\n")
                except Exception:
                    pass
                # #endregion
                # 如果有建议工单数量，生成工单（按物料聚合）
                if item.suggested_work_order_quantity and item.suggested_work_order_quantity > 0:
                    if item.material_id not in created_wo_material_ids:
                        same_material = [i for i in items if not i.material_source_type and i.material_id == item.material_id and (float(i.suggested_work_order_quantity or 0) > 0)]
                        agg_item = _build_aggregated_item(same_material) if len(same_material) > 1 else item
                        allow_draft_for_item = allow_draft and item.material_id in failed_validation_material_ids
                        work_order = await self._create_work_order_from_item(
                            tenant_id=tenant_id,
                            computation=computation,
                            item=agg_item,
                            created_by=created_by,
                            allow_draft=allow_draft_for_item,
                        )
                        work_orders.append(work_order)
                        created_wo_material_ids.add(item.material_id)
                
                # 如果有建议采购订单数量，仅当配置了默认供应商时生成采购单
                if item.material_id not in already_pushed_po_material_ids and item.suggested_purchase_order_quantity and item.suggested_purchase_order_quantity > 0:
                    supplier_id = None
                    if item.material_source_config:
                        source_config = item.material_source_config.get("source_config", {})
                        supplier_id = source_config.get("default_supplier_id")
                    if supplier_id:
                        if supplier_id not in purchase_items_by_supplier:
                            purchase_items_by_supplier[supplier_id] = []
                        purchase_items_by_supplier[supplier_id].append(item)
            
            else:
                # #region agent log
                try:
                    with open(r"f:\dev\riveredge\.cursor\debug.log", "a", encoding="utf-8") as _f:
                        _f.write(__import__("json").dumps({"location": "demand_computation_service.py:loop", "message": "unhandled_source_type", "data": {"material_code": item.material_code, "source_type": source_type}, "hypothesisId": "B"}) + "\n")
                except Exception:
                    pass
                # #endregion
        
        # 建立需求计算→工单的追溯关系（支持全链路追溯）
        from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
        from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate
        relation_service = DocumentRelationNewService()
        for wo in work_orders:
            wo_id = wo.get("id") if isinstance(wo, dict) else wo.id
            wo_code = wo.get("code") if isinstance(wo, dict) else wo.code
            wo_name = wo.get("name") if isinstance(wo, dict) else getattr(wo, "name", None)
            try:
                rel_data = DocumentRelationCreate(
                    source_type="demand_computation",
                    source_id=computation_id,
                    source_code=computation.computation_code,
                    source_name=None,
                    target_type="work_order",
                    target_id=wo_id,
                    target_code=wo_code,
                    target_name=wo_name,
                    relation_type="source",
                    relation_mode="push",
                    relation_desc="从需求计算直连生成工单",
                    business_mode=computation.business_mode,
                    demand_id=computation.demand_id,
                )
                await relation_service.create_relation(tenant_id=tenant_id, relation_data=rel_data, created_by=created_by)
            except BusinessLogicError as e:
                if "关联关系已存在" not in str(e):
                    raise
        for wo in outsource_work_orders:
            wo_id = wo.get("id") if isinstance(wo, dict) else wo.id
            wo_code = wo.get("code") if isinstance(wo, dict) else wo.code
            try:
                rel_data = DocumentRelationCreate(
                    source_type="demand_computation",
                    source_id=computation_id,
                    source_code=computation.computation_code,
                    source_name=None,
                    target_type="outsource_work_order",
                    target_id=wo_id,
                    target_code=wo_code,
                    target_name=None,
                    relation_type="source",
                    relation_mode="push",
                    relation_desc="从需求计算直连生成委外工单",
                    business_mode=computation.business_mode,
                    demand_id=computation.demand_id,
                )
                await relation_service.create_relation(tenant_id=tenant_id, relation_data=rel_data, created_by=created_by)
            except BusinessLogicError as e:
                if "关联关系已存在" not in str(e):
                    raise
        
        # 按供应商分组生成采购订单（物料来源控制增强）
        for supplier_id, items_for_supplier in purchase_items_by_supplier.items():
            if items_for_supplier:
                purchase_order = await self._create_purchase_order_from_items(
                    tenant_id=tenant_id,
                    computation=computation,
                    items=items_for_supplier,
                    supplier_id=supplier_id,
                    created_by=created_by
                )
                purchase_orders.append(purchase_order)
        
        # #region agent log
        try:
            with open(r"f:\dev\riveredge\.cursor\debug.log", "a", encoding="utf-8") as _f:
                _f.write(__import__("json").dumps({"location": "demand_computation_service.py:return", "message": "generate_orders_result", "data": {"work_order_count": len(work_orders), "outsource_work_order_count": len(outsource_work_orders), "purchase_order_count": len(purchase_orders)}, "hypothesisId": "A,C,E"}) + "\n")
        except Exception:
            pass
        # #endregion
        return {
            "computation_id": computation_id,
            "computation_code": computation.computation_code,
            "work_orders": work_orders,
            "outsource_work_orders": outsource_work_orders,
            "purchase_orders": purchase_orders,
            "work_order_count": len(work_orders),  # 生产工单数量（工单管理页）
            "outsource_work_order_count": len(outsource_work_orders),  # 委外工单数量（委外管理页）
            "purchase_order_count": len(purchase_orders),
        }

    async def get_push_records(
        self,
        tenant_id: int,
        computation_id: int
    ) -> Dict[str, Any]:
        """
        获取需求计算的下推记录，包含目标单据是否仍存在的标识。
        用于详情抽屉展示下推记录，已删除的单据会标识为 target_exists=False。
        """
        computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
        if not computation:
            raise NotFoundError(f"需求计算不存在: {computation_id}")

        from apps.kuaizhizao.models.document_relation import DocumentRelation
        from apps.kuaizhizao.models.work_order import WorkOrder
        from apps.kuaizhizao.models.purchase_order import PurchaseOrder
        from apps.kuaizhizao.models.production_plan import ProductionPlan
        from apps.kuaizhizao.models.purchase_requisition import PurchaseRequisition
        from apps.kuaizhizao.models.outsource_work_order import OutsourceWorkOrder

        rels = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="demand_computation",
            source_id=computation_id,
        ).order_by("created_at").all()

        records = []
        for rel in rels:
            target_exists = False
            tt, tid = rel.target_type, rel.target_id
            if tt == "work_order":
                wo = await WorkOrder.get_or_none(tenant_id=tenant_id, id=tid, deleted_at__isnull=True)
                target_exists = wo is not None
            elif tt == "outsource_work_order":
                owo = await OutsourceWorkOrder.get_or_none(tenant_id=tenant_id, id=tid, deleted_at__isnull=True)
                target_exists = owo is not None
            elif tt == "purchase_order":
                po = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=tid)
                target_exists = po is not None
            elif tt == "production_plan":
                plan = await ProductionPlan.get_or_none(tenant_id=tenant_id, id=tid, deleted_at__isnull=True)
                target_exists = plan is not None
            elif tt == "purchase_requisition":
                req = await PurchaseRequisition.get_or_none(tenant_id=tenant_id, id=tid, deleted_at__isnull=True)
                target_exists = req is not None
            else:
                target_exists = True  # 未知类型默认视为存在

            records.append({
                "target_type": tt,
                "target_id": tid,
                "target_code": rel.target_code,
                "target_name": rel.target_name,
                "relation_desc": rel.relation_desc,
                "created_at": rel.created_at.isoformat() if rel.created_at else None,
                "target_exists": target_exists,
            })

        return {"records": records}

    async def _get_already_pushed_exclusions(
        self, tenant_id: int, computation_id: int
    ) -> Dict[str, Any]:
        """
        获取需求计算已下推且仍存在的单据对应的物料ID等排除信息。
        用于重新下推时避免重复生成。
        返回: {
            wo_material_ids: set,  # 已有工单的物料ID
            outsource_material_ids: set,  # 已有委外工单的物料ID
            po_material_ids: set,  # 已有采购单包含的物料ID
            has_production_plan: bool,
            has_purchase_requisition: bool,
        }
        """
        from apps.kuaizhizao.models.document_relation import DocumentRelation
        from apps.kuaizhizao.models.work_order import WorkOrder
        from apps.kuaizhizao.models.purchase_order import PurchaseOrder, PurchaseOrderItem
        from apps.kuaizhizao.models.production_plan import ProductionPlan
        from apps.kuaizhizao.models.purchase_requisition import PurchaseRequisition
        from apps.kuaizhizao.models.outsource_work_order import OutsourceWorkOrder

        rels = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="demand_computation",
            source_id=computation_id,
        ).all()

        wo_material_ids = set()
        outsource_material_ids = set()
        po_material_ids = set()
        has_production_plan = False
        has_purchase_requisition = False

        for rel in rels:
            tt, tid = rel.target_type, rel.target_id
            if tt == "work_order":
                wo = await WorkOrder.get_or_none(tenant_id=tenant_id, id=tid, deleted_at__isnull=True)
                if wo:
                    wo_material_ids.add(wo.product_id)
            elif tt == "outsource_work_order":
                owo = await OutsourceWorkOrder.get_or_none(tenant_id=tenant_id, id=tid, deleted_at__isnull=True)
                if owo:
                    outsource_material_ids.add(owo.product_id)
            elif tt == "purchase_order":
                po = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=tid)
                if po:
                    items = await PurchaseOrderItem.filter(order_id=tid).all()
                    for poi in items:
                        po_material_ids.add(poi.material_id)
            elif tt == "production_plan":
                plan = await ProductionPlan.get_or_none(tenant_id=tenant_id, id=tid, deleted_at__isnull=True)
                if plan:
                    has_production_plan = True
            elif tt == "purchase_requisition":
                req = await PurchaseRequisition.get_or_none(tenant_id=tenant_id, id=tid, deleted_at__isnull=True)
                if req:
                    has_purchase_requisition = True

        return {
            "wo_material_ids": wo_material_ids,
            "outsource_material_ids": outsource_material_ids,
            "po_material_ids": po_material_ids,
            "has_production_plan": has_production_plan,
            "has_purchase_requisition": has_purchase_requisition,
        }

    async def get_push_options(
        self,
        tenant_id: int,
        computation_id: int
    ) -> Dict[str, Any]:
        """
        获取需求计算的下推能力与一键下推默认配置，供前端弹窗预填。
        """
        computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
        if not computation:
            raise NotFoundError(f"需求计算不存在: {computation_id}")
        if computation.computation_status != "完成":
            raise BusinessLogicError("只能对已完成的计算进行下推")

        items = await DemandComputationItem.filter(
            tenant_id=tenant_id,
            computation_id=computation_id
        ).all()

        make_count = 0
        outsource_count = 0
        purchase_items_with_supplier = 0
        purchase_items_without_supplier = 0

        for item in items:
            st = item.material_source_type
            if st == SOURCE_TYPE_PHANTOM:
                continue
            if st == SOURCE_TYPE_MAKE or st == SOURCE_TYPE_CONFIGURE:
                if item.suggested_work_order_quantity and item.suggested_work_order_quantity > 0:
                    make_count += 1
            elif st == SOURCE_TYPE_OUTSOURCE:
                if item.suggested_work_order_quantity and item.suggested_work_order_quantity > 0:
                    outsource_count += 1
            elif st == SOURCE_TYPE_BUY:
                if item.suggested_purchase_order_quantity and item.suggested_purchase_order_quantity > 0:
                    supplier_id = None
                    if item.material_source_config:
                        sc = item.material_source_config.get("source_config", {})
                        supplier_id = sc.get("default_supplier_id")
                    if supplier_id:
                        purchase_items_with_supplier += 1
                    else:
                        purchase_items_without_supplier += 1

        has_production_items = make_count > 0
        has_outsource_items = outsource_count > 0
        has_purchase_items = purchase_items_with_supplier > 0 or purchase_items_without_supplier > 0

        biz_config = BusinessConfigService()
        can_direct_wo = await biz_config.can_direct_generate_work_order_from_computation(tenant_id)

        default_production = "work_order" if can_direct_wo else "plan"
        default_purchase = "requisition" if purchase_items_without_supplier > 0 else "purchase_order"

        production_choices = []
        if has_production_items or has_outsource_items:
            production_choices = ["plan", "work_order"]

        purchase_choices = []
        if has_purchase_items:
            purchase_choices = ["requisition", "purchase_order"]

        return {
            "computation_id": computation_id,
            "has_production_items": has_production_items,
            "has_outsource_items": has_outsource_items,
            "has_purchase_items": has_purchase_items,
            "make_count": make_count,
            "outsource_count": outsource_count,
            "purchase_items_with_supplier": purchase_items_with_supplier,
            "purchase_items_without_supplier": purchase_items_without_supplier,
            "can_direct_work_order": can_direct_wo,
            "default_production": default_production,
            "default_purchase": default_purchase,
            "production_choices": production_choices,
            "purchase_choices": purchase_choices,
        }

    async def get_push_preview(
        self,
        tenant_id: int,
        computation_id: int,
        push_config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        获取下推预览（不实际执行），用于下推前展示将生成的单据数量。
        push_config: { "production": "plan"|"work_order", "purchase": "requisition"|"purchase_order" }
        """
        computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
        if not computation:
            raise NotFoundError(f"需求计算不存在: {computation_id}")
        if computation.computation_status != "完成":
            raise BusinessLogicError("只能对已完成的计算进行下推")

        items = await DemandComputationItem.filter(
            tenant_id=tenant_id,
            computation_id=computation_id
        ).all()

        production = (push_config or {}).get("production")
        purchase = (push_config or {}).get("purchase")
        outsource_only = (push_config or {}).get("outsource_only") is True

        production_plan_count = 0
        work_order_count = 0
        outsource_work_order_count = 0
        purchase_requisition_count = 0
        purchase_order_count = 0
        validation_failures = []

        make_count = 0
        outsource_count = 0
        purchase_items_with_supplier = 0
        purchase_items_without_supplier = 0

        for item in items:
            st = item.material_source_type
            if st == SOURCE_TYPE_PHANTOM:
                continue
            if st in (SOURCE_TYPE_MAKE, SOURCE_TYPE_CONFIGURE):
                if item.suggested_work_order_quantity and item.suggested_work_order_quantity > 0:
                    make_count += 1
            elif st == SOURCE_TYPE_OUTSOURCE:
                if item.suggested_work_order_quantity and item.suggested_work_order_quantity > 0:
                    outsource_count += 1
                    validation_passed, errors = await validate_material_source_config(
                        tenant_id=tenant_id,
                        material_id=item.material_id,
                        source_type=SOURCE_TYPE_OUTSOURCE
                    )
                    if not validation_passed:
                        validation_failures.append({
                            "material_code": item.material_code,
                            "material_name": item.material_name,
                            "errors": errors,
                        })
            elif st == SOURCE_TYPE_BUY:
                if item.suggested_purchase_order_quantity and item.suggested_purchase_order_quantity > 0:
                    sc = (item.material_source_config or {}).get("source_config", {})
                    if sc.get("default_supplier_id"):
                        purchase_items_with_supplier += 1
                    else:
                        purchase_items_without_supplier += 1

        if outsource_only:
            outsource_work_order_count = outsource_count
        elif production == "plan" and (make_count > 0 or outsource_count > 0):
            production_plan_count = 1
        elif production == "work_order":
            work_order_count = make_count
            outsource_work_order_count = outsource_count

        if purchase == "requisition" and (purchase_items_with_supplier > 0 or purchase_items_without_supplier > 0):
            purchase_requisition_count = 1
        elif purchase == "purchase_order" and purchase_items_with_supplier > 0:
            supplier_ids = set()
            for item in items:
                if item.material_source_type == SOURCE_TYPE_BUY and item.suggested_purchase_order_quantity and item.suggested_purchase_order_quantity > 0:
                    sc = (item.material_source_config or {}).get("source_config", {})
                    sid = sc.get("default_supplier_id")
                    if sid:
                        supplier_ids.add(sid)
            purchase_order_count = len(supplier_ids)

        biz_config = BusinessConfigService()
        can_direct_wo = await biz_config.can_direct_generate_work_order_from_computation(tenant_id)

        return {
            "computation_id": computation_id,
            "production_plan_count": production_plan_count,
            "work_order_count": work_order_count,
            "outsource_work_order_count": outsource_work_order_count,
            "purchase_requisition_count": purchase_requisition_count,
            "purchase_order_count": purchase_order_count,
            "validation_failures": validation_failures,
            "can_direct_work_order": can_direct_wo,
            "make_count": make_count,
            "outsource_count": outsource_count,
            "purchase_items_with_supplier": purchase_items_with_supplier,
            "purchase_items_without_supplier": purchase_items_without_supplier,
        }

    async def push_all(
        self,
        tenant_id: int,
        computation_id: int,
        created_by: int,
        production: Optional[str] = None,
        purchase: Optional[str] = None,
        include_outsource: bool = True
    ) -> Dict[str, Any]:
        """
        一键下推：按配置执行生产计划/工单、采购申请/采购单、委外工单。
        production: "plan"|"work_order"|null
        purchase: "requisition"|"purchase_order"|null
        include_outsource: 委外工单是否包含（生产计划已含委外明细，工单模式会生成委外工单）
        """
        computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
        if not computation:
            raise NotFoundError(f"需求计算不存在: {computation_id}")
        if computation.computation_status != "完成":
            raise BusinessLogicError("只能对已完成的计算进行下推")

        results = {
            "production_plan": None,
            "work_orders": [],
            "outsource_work_orders": [],
            "purchase_requisition": None,
            "purchase_orders": [],
        }

        from apps.kuaizhizao.services.document_push_pull_service import DocumentPushPullService
        push_service = DocumentPushPullService()
        exclusions = await self._get_already_pushed_exclusions(tenant_id, computation_id)

        if production == "plan":
            if not exclusions["has_production_plan"]:
                r = await push_service.push_document(
                    tenant_id=tenant_id,
                    source_type="demand_computation",
                    source_id=computation_id,
                    target_type="production_plan",
                    push_params=None,
                    created_by=created_by,
                )
                results["production_plan"] = r.get("target_document")

        elif production == "work_order":
            r = await self.generate_work_orders_and_purchase_orders(
                tenant_id=tenant_id,
                computation_id=computation_id,
                created_by=created_by,
                generate_mode="work_order_only",
                allow_draft=True,
            )
            results["work_orders"] = r.get("work_orders", [])
            results["outsource_work_orders"] = r.get("outsource_work_orders", [])

        if purchase == "requisition":
            if not exclusions["has_purchase_requisition"]:
                try:
                    r = await push_service.push_document(
                        tenant_id=tenant_id,
                        source_type="demand_computation",
                        source_id=computation_id,
                        target_type="purchase_requisition",
                        push_params=None,
                        created_by=created_by,
                    )
                    results["purchase_requisition"] = r.get("target_document")
                except BusinessLogicError as e:
                    if "无采购件" not in str(e):
                        raise

        elif purchase == "purchase_order":
            r = await self.generate_work_orders_and_purchase_orders(
                tenant_id=tenant_id,
                computation_id=computation_id,
                created_by=created_by,
                generate_mode="purchase_only",
                allow_draft=False,
            )
            results["purchase_orders"] = r.get("purchase_orders", [])

        return {
            "success": True,
            "message": "一键下推完成",
            "results": results,
        }

    async def _create_work_order_from_item(
        self,
        tenant_id: int,
        computation: DemandComputation,
        item: DemandComputationItem,
        created_by: int,
        is_outsource: bool = False,
        allow_draft: bool = False
    ) -> Dict[str, Any]:
        """
        从计算结果明细创建工单
        
        Args:
            tenant_id: 租户ID
            computation: 计算对象
            item: 计算结果明细
            created_by: 创建人ID
            
        Returns:
            Dict: 创建的工单信息
        """
        try:
            from apps.kuaizhizao.services.work_order_service import WorkOrderService
            from apps.kuaizhizao.schemas.work_order import WorkOrderCreate
            from datetime import datetime, timedelta
            
            work_order_service = WorkOrderService()
            
            # 确定生产模式
            production_mode = "MTO" if computation.business_mode == "MTO" else "MTS"
            
            # MTO 时解析销售订单ID：工单表外键指向 sales_orders，需用需求的 source_id（销售订单ID），而非 demand_id（需求ID）
            sales_order_id = None
            if production_mode == "MTO":
                demand = await Demand.get_or_none(tenant_id=tenant_id, id=computation.demand_id)
                if demand and getattr(demand, "demand_type", None) == "sales_order" and getattr(demand, "source_type", None) == "sales_order" and getattr(demand, "source_id", None):
                    sales_order_id = demand.source_id
            
            # 确定计划时间（如果有LRP的日期信息）
            planned_start_date = None
            planned_end_date = None
            if item.production_start_date:
                planned_start_date = item.production_start_date
            if item.production_completion_date:
                planned_end_date = item.production_completion_date
            
            # 创建工单（物料来源控制增强）
            remarks = f"从需求计算 {computation.computation_code} 自动生成"
            if is_outsource:
                remarks += "（委外工单）"
            
            work_order_data = WorkOrderCreate(
                code_rule="WORK_ORDER_CODE",
                product_id=item.material_id,
                quantity=float(item.suggested_work_order_quantity or 0),
                production_mode=production_mode,
                sales_order_id=sales_order_id,
                planned_start_date=planned_start_date,
                planned_end_date=planned_end_date,
                remarks=remarks,
            )
            
            work_order = await work_order_service.create_work_order(
                tenant_id=tenant_id,
                work_order_data=work_order_data,
                created_by=created_by,
                allow_draft=allow_draft,
            )
            # #region agent log
            try:
                with open(r"f:\dev\riveredge\.cursor\debug.log", "a", encoding="utf-8") as _f:
                    _f.write(__import__("json").dumps({"location": "demand_computation_service.py:_create_work_order", "message": "work_order_created", "data": {"id": work_order.id, "code": work_order.code, "material_code": item.material_code}, "hypothesisId": "C,E"}) + "\n")
            except Exception:
                pass
            # #endregion
            return {
                "id": work_order.id,
                "code": work_order.code,
                "product_code": item.material_code,
                "product_name": item.material_name,
                "quantity": float(item.suggested_work_order_quantity or 0),
            }
        except Exception as e:
            logger.error(f"创建工单失败: {e}")
            raise BusinessLogicError(f"创建工单失败: {str(e)}")
    
    async def _get_or_create_placeholder_supplier(self, tenant_id: int):
        """获取或创建占位供应商「待指定」，用于 allow_draft 时委外工单无供应商的场景"""
        from apps.master_data.models.supplier import Supplier
        code = "TBD"
        supplier = await Supplier.filter(
            tenant_id=tenant_id,
            code=code,
            deleted_at__isnull=True
        ).first()
        if supplier:
            return supplier
        supplier = await Supplier.create(
            tenant_id=tenant_id,
            code=code,
            name="待指定",
        )
        return supplier

    async def _create_outsource_work_order_from_item(
        self,
        tenant_id: int,
        computation: DemandComputation,
        item: DemandComputationItem,
        created_by: int,
        allow_draft: bool = False
    ) -> Dict[str, Any]:
        """
        从计算结果明细创建委外工单（OutsourceWorkOrder）
        
        委外件必须配置 outsource_supplier_id 和 outsource_operation。
        
        Args:
            tenant_id: 租户ID
            computation: 计算对象
            item: 计算结果明细（物料来源类型为 Outsource）
            created_by: 创建人ID
            
        Returns:
            Dict: 创建的委外工单信息
        """
        try:
            from apps.kuaizhizao.services.outsource_work_order_service import OutsourceWorkOrderService
            from apps.kuaizhizao.schemas.outsource_work_order import OutsourceWorkOrderCreate
            from apps.master_data.models.supplier import Supplier
            
            # 从物料来源配置获取委外供应商信息（get_material_source_config 返回的结构）
            mc = item.material_source_config or {}
            source_config = mc.get("source_config", mc)
            outsource_supplier_id = mc.get("outsource_supplier_id") or source_config.get("outsource_supplier_id")
            outsource_operation = mc.get("outsource_operation") or source_config.get("outsource_operation", "")
            
            # allow_draft 时允许无供应商，使用占位供应商
            if not outsource_supplier_id:
                if not allow_draft:
                    raise BusinessLogicError(
                        f"委外件 {item.material_code} ({item.material_name}) 未配置委外供应商，"
                        "请在物料主数据中配置 source_config.outsource_supplier_id"
                    )
                # 获取或创建占位供应商「待指定」
                supplier = await self._get_or_create_placeholder_supplier(tenant_id)
                outsource_supplier_id = supplier.id
            
            # 查询供应商信息
            supplier = await Supplier.get_or_none(tenant_id=tenant_id, id=outsource_supplier_id)
            if not supplier:
                if allow_draft:
                    supplier = await self._get_or_create_placeholder_supplier(tenant_id)
                else:
                    raise BusinessLogicError(
                        f"委外供应商 ID {outsource_supplier_id} 不存在，物料: {item.material_code}"
                    )
            
            supplier_code = getattr(supplier, "code", None) or str(outsource_supplier_id)
            supplier_name = getattr(supplier, "name", None) or source_config.get("outsource_supplier_name", "待指定")
            
            quantity = float(item.suggested_work_order_quantity or 0)
            unit_price = Decimal(str(mc.get("outsource_price") or source_config.get("outsource_price", 0)))
            total_amount = Decimal(str(quantity)) * unit_price
            
            planned_start_date = None
            planned_end_date = None
            if item.production_start_date:
                planned_start_date = datetime.combine(
                    item.production_start_date,
                    datetime.min.time()
                )
            if item.production_completion_date:
                planned_end_date = datetime.combine(
                    item.production_completion_date,
                    datetime.min.time()
                )
            
            work_order_data = OutsourceWorkOrderCreate(
                product_id=item.material_id,
                product_code=item.material_code,
                product_name=item.material_name,
                quantity=Decimal(str(quantity)),
                supplier_id=supplier.id,
                supplier_code=supplier_code,
                supplier_name=supplier_name,
                outsource_operation=outsource_operation or None,
                unit_price=unit_price,
                total_amount=total_amount,
                planned_start_date=planned_start_date,
                planned_end_date=planned_end_date,
                remarks=f"从需求计算 {computation.computation_code} 自动生成",
            )
            
            outsource_service = OutsourceWorkOrderService()
            wo = await outsource_service.create_outsource_work_order(
                tenant_id=tenant_id,
                work_order_data=work_order_data,
                created_by=created_by,
                allow_draft=allow_draft,
            )
            
            return {
                "id": wo.id,
                "code": wo.code,
                "product_code": item.material_code,
                "product_name": item.material_name,
                "quantity": float(quantity),
            }
        except BusinessLogicError:
            raise
        except Exception as e:
            logger.error(f"创建委外工单失败: {e}")
            raise BusinessLogicError(f"创建委外工单失败: {str(e)}")
    
    async def _create_purchase_order_from_item(
        self,
        tenant_id: int,
        computation: DemandComputation,
        item: DemandComputationItem,
        created_by: int
    ) -> Dict[str, Any]:
        """
        从计算结果明细创建采购单（物料来源控制增强）
        
        根据物料来源类型，自动填充默认供应商和采购价格。
        
        Args:
            tenant_id: 租户ID
            computation: 计算对象
            item: 计算结果明细
            created_by: 创建人ID
            
        Returns:
            Dict: 创建的采购单信息
        """
        try:
            from apps.kuaizhizao.models.purchase_order import PurchaseOrder, PurchaseOrderItem
            from core.services.business.code_generation_service import CodeGenerationService
            from datetime import datetime, date, timedelta
            from decimal import Decimal
            
            # 生成采购订单编码
            try:
                order_code = await CodeGenerationService.generate_code(
                    tenant_id=tenant_id,
                    rule_code="PURCHASE_ORDER",
                )
            except Exception:
                # 回退到简单编码
                now = datetime.now()
                order_code = f"PO-{now.strftime('%Y%m%d')}-{computation.id}"
            
            # 从物料来源配置获取默认供应商和采购价格（物料来源控制增强）
            supplier_id = None
            supplier_name = "待指定供应商"
            unit_price = Decimal(0)
            
            if item.material_source_type == "Buy" and item.material_source_config:
                source_config = item.material_source_config.get("source_config", {})
                supplier_id = source_config.get("default_supplier_id")
                supplier_name = source_config.get("default_supplier_name", "待指定供应商")
                unit_price = Decimal(str(source_config.get("purchase_price", 0)))
            
            # 如果没有配置，使用占位值
            if not supplier_id:
                supplier_id = 1  # 需要手动指定
            
            # 确定交货日期
            delivery_date = item.procurement_completion_date or item.delivery_date
            if not delivery_date:
                # 从物料来源配置获取采购提前期
                lead_time_days = 7  # 默认7天
                if item.material_source_config:
                    source_config = item.material_source_config.get("source_config", {})
                    lead_time_days = source_config.get("purchase_lead_time", 7)
                delivery_date = date.today() + timedelta(days=lead_time_days)
            
            # 创建采购订单
            purchase_order = await PurchaseOrder.create(
                tenant_id=tenant_id,
                order_code=order_code,
                supplier_id=supplier_id,
                supplier_name=supplier_name,
                order_date=date.today(),
                delivery_date=delivery_date,
                order_type="标准采购",
                status="草稿",
                source_type=computation.computation_type,
                source_id=computation.id,
                notes=f"从需求计算 {computation.computation_code} 自动生成",
            )
            
            # 计算总价
            quantity = float(item.suggested_purchase_order_quantity or 0)
            total_price = float(unit_price) * quantity
            
            # 创建采购订单行
            await PurchaseOrderItem.create(
                tenant_id=tenant_id,
                order_id=purchase_order.id,
                material_id=item.material_id,
                material_code=item.material_code,
                material_name=item.material_name,
                material_spec=item.material_spec,
                ordered_quantity=Decimal(str(quantity)),
                unit=item.material_unit,
                unit_price=unit_price,
                total_price=Decimal(str(total_price)),
                required_date=delivery_date,
                inspection_required=True,
                source_type=computation.computation_type,
                source_id=computation.id,
            )
            
            return {
                "id": purchase_order.id,
                "order_code": purchase_order.order_code,
                "material_code": item.material_code,
                "material_name": item.material_name,
                "quantity": quantity,
                "supplier_name": supplier_name,
                "unit_price": float(unit_price),
                "total_price": total_price,
            }
        except Exception as e:
            logger.error(f"创建采购单失败: {e}")
            raise BusinessLogicError(f"创建采购单失败: {str(e)}")
    
    async def _create_purchase_order_from_items(
        self,
        tenant_id: int,
        computation: DemandComputation,
        items: List[DemandComputationItem],
        supplier_id: int,
        created_by: int
    ) -> Dict[str, Any]:
        """
        从多个计算结果明细创建采购单（按供应商分组，物料来源控制增强）
        
        根据物料来源类型，自动填充默认供应商和采购价格，支持同一供应商多个物料合并到一个采购单。
        
        Args:
            tenant_id: 租户ID
            computation: 计算对象
            items: 计算结果明细列表（同一供应商的多个物料）
            supplier_id: 供应商ID
            created_by: 创建人ID
            
        Returns:
            Dict: 创建的采购单信息
        """
        try:
            from apps.kuaizhizao.models.purchase_order import PurchaseOrder, PurchaseOrderItem
            from apps.master_data.models import Supplier
            from core.services.business.code_generation_service import CodeGenerationService
            from datetime import datetime, date, timedelta
            from decimal import Decimal
            
            # 验证供应商
            supplier = await Supplier.get_or_none(tenant_id=tenant_id, id=supplier_id)
            if not supplier:
                # 如果供应商不存在，尝试从第一个物料的配置中获取供应商名称
                supplier_name = "待指定供应商"
                if items and items[0].material_source_config:
                    source_config = items[0].material_source_config.get("source_config", {})
                    supplier_name = source_config.get("default_supplier_name", "待指定供应商")
            else:
                supplier_name = supplier.name
            
            # 生成采购订单编码
            try:
                order_code = await CodeGenerationService.generate_code(
                    tenant_id=tenant_id,
                    rule_code="PURCHASE_ORDER",
                )
            except Exception:
                # 回退到简单编码
                now = datetime.now()
                order_code = f"PO-{now.strftime('%Y%m%d')}-{computation.id}-{supplier_id}"
            
            # 确定交货日期（取所有物料中最早的日期）
            delivery_date = None
            for item in items:
                item_delivery_date = item.procurement_completion_date or item.delivery_date
                if item_delivery_date:
                    if not delivery_date or item_delivery_date < delivery_date:
                        delivery_date = item_delivery_date
            
            if not delivery_date:
                # 从物料来源配置获取采购提前期
                lead_time_days = 7  # 默认7天
                if items and items[0].material_source_config:
                    source_config = items[0].material_source_config.get("source_config", {})
                    lead_time_days = source_config.get("purchase_lead_time", 7)
                delivery_date = date.today() + timedelta(days=lead_time_days)
            
            # 创建采购订单
            purchase_order = await PurchaseOrder.create(
                tenant_id=tenant_id,
                order_code=order_code,
                supplier_id=supplier_id,
                supplier_name=supplier_name,
                order_date=date.today(),
                delivery_date=delivery_date,
                order_type="标准采购",
                status="草稿",
                source_type=computation.computation_type,
                source_id=computation.id,
                notes=f"从需求计算 {computation.computation_code} 自动生成（按供应商分组）",
                created_by=created_by,
                updated_by=created_by
            )
            
            # 创建采购订单明细并计算总金额
            total_quantity = Decimal(0)
            total_amount = Decimal(0)
            
            for item in items:
                # 从物料来源配置获取采购价格（物料来源控制增强）
                unit_price = Decimal(0)
                if item.material_source_type == "Buy" and item.material_source_config:
                    source_config = item.material_source_config.get("source_config", {})
                    unit_price = Decimal(str(source_config.get("purchase_price", 0)))
                
                # 计算数量和总价
                quantity = Decimal(str(item.suggested_purchase_order_quantity or 0))
                total_price = unit_price * quantity
                
                # 创建采购订单行
                await PurchaseOrderItem.create(
                    tenant_id=tenant_id,
                    order_id=purchase_order.id,
                    material_id=item.material_id,
                    material_code=item.material_code,
                    material_name=item.material_name,
                    material_spec=item.material_spec,
                    ordered_quantity=quantity,
                    unit=item.material_unit,
                    unit_price=unit_price,
                    total_price=total_price,
                    required_date=delivery_date,
                    inspection_required=True,
                    source_type=computation.computation_type,
                    source_id=computation.id,
                    created_by=created_by,
                    updated_by=created_by
                )
                
                total_quantity += quantity
                total_amount += total_price
            
            # 更新订单头金额信息
            await purchase_order.update_from_dict({
                'total_quantity': total_quantity,
                'total_amount': total_amount,
                'tax_amount': Decimal(0),  # 默认税率为0
                'net_amount': total_amount,
                'updated_by': created_by
            }).save()
            
            return {
                "id": purchase_order.id,
                "order_code": purchase_order.order_code,
                "supplier_id": supplier_id,
                "supplier_name": supplier_name,
                "items_count": len(items),
                "total_quantity": float(total_quantity),
                "total_amount": float(total_amount),
            }
        except Exception as e:
            logger.error(f"创建采购单失败: {e}")
            raise BusinessLogicError(f"创建采购单失败: {str(e)}")
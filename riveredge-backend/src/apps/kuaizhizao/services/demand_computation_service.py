"""
统一需求计算服务模块

提供统一需求计算相关的业务逻辑处理，合并MRP和LRP运算逻辑。

根据《☆ 用户使用全场景推演.md》的设计理念，将MRP和LRP合并为统一的需求计算模型。

Author: Luigi Lu
Date: 2025-01-14
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta, date
from decimal import Decimal
from tortoise.transactions import in_transaction
from loguru import logger

from apps.kuaizhizao.models.demand import Demand
from apps.kuaizhizao.models.demand_computation import DemandComputation
from apps.kuaizhizao.models.demand_computation_item import DemandComputationItem
from apps.kuaizhizao.schemas.demand_computation import (
    DemandComputationCreate,
    DemandComputationUpdate,
    DemandComputationResponse,
    DemandComputationItemResponse,
)
from core.services.business.code_generation_service import CodeGenerationService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError


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
            # 验证需求存在
            demand = await Demand.get_or_none(tenant_id=tenant_id, id=computation_data.demand_id)
            if not demand:
                raise NotFoundError(f"需求不存在: {computation_data.demand_id}")
            
            # 验证需求状态（必须是已审核通过）
            if demand.status != "已审核" or demand.review_status != "通过":
                raise BusinessLogicError(f"只能对已审核通过的需求进行计算，当前状态: {demand.status}")
            
            # 生成计算编码
            computation_code = await self._generate_computation_code(tenant_id, computation_data.computation_type)
            
            # 创建需求计算
            computation = await DemandComputation.create(
                tenant_id=tenant_id,
                computation_code=computation_code,
                demand_id=computation_data.demand_id,
                demand_code=demand.demand_code,
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
        computation_type: Optional[str] = None,
        computation_status: Optional[str] = None,
        skip: int = 0,
        limit: int = 20
    ) -> Dict[str, Any]:
        """
        获取需求计算列表
        
        Args:
            tenant_id: 租户ID
            demand_id: 需求ID（可选）
            computation_type: 计算类型（可选）
            computation_status: 计算状态（可选）
            skip: 跳过数量
            limit: 限制数量
            
        Returns:
            Dict: 包含计算列表和总数的字典
        """
        query = DemandComputation.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        
        if demand_id:
            query = query.filter(demand_id=demand_id)
        if computation_type:
            query = query.filter(computation_type=computation_type)
        if computation_status:
            query = query.filter(computation_status=computation_status)
        
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
        computation_id: int
    ) -> DemandComputationResponse:
        """
        执行需求计算
        
        Args:
            tenant_id: 租户ID
            computation_id: 计算ID
            
        Returns:
            DemandComputationResponse: 计算响应
        """
        async with in_transaction():
            computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
            if not computation:
                raise NotFoundError(f"需求计算不存在: {computation_id}")
            
            # 只能执行"进行中"状态的计算
            if computation.computation_status != "进行中":
                raise BusinessLogicError(f"只能执行进行中状态的计算，当前状态: {computation.computation_status}")
            
            # 更新计算状态为计算中
            await DemandComputation.filter(tenant_id=tenant_id, id=computation_id).update(
                computation_status="计算中",
                computation_start_time=datetime.now()
            )
            
            try:
                # 根据计算类型执行不同的计算逻辑
                if computation.computation_type == "MRP":
                    await self._execute_mrp_computation(tenant_id, computation)
                elif computation.computation_type == "LRP":
                    await self._execute_lrp_computation(tenant_id, computation)
                else:
                    raise ValidationError(f"不支持的计算类型: {computation.computation_type}")
                
                # 更新计算状态为完成
                await DemandComputation.filter(tenant_id=tenant_id, id=computation_id).update(
                    computation_status="完成",
                    computation_end_time=datetime.now()
                )
                
            except Exception as e:
                logger.error(f"执行需求计算失败: {e}")
                # 更新计算状态为失败
                await DemandComputation.filter(tenant_id=tenant_id, id=computation_id).update(
                    computation_status="失败",
                    computation_end_time=datetime.now(),
                    error_message=str(e)
                )
                raise
            
            return await self.get_computation_by_id(tenant_id, computation_id)
    
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
        
        Args:
            tenant_id: 租户ID
            computation: 计算对象
        """
        # TODO: 实现MRP计算逻辑
        # 1. 获取需求明细
        # 2. 根据BOM展开物料需求
        # 3. 考虑库存、安全库存、提前期等参数
        # 4. 计算净需求和计划订单
        # 5. 生成计算结果明细
        
        logger.info(f"执行MRP计算: {computation.computation_code}")
        # 占位实现，后续完善
        pass
    
    async def _execute_lrp_computation(
        self,
        tenant_id: int,
        computation: DemandComputation
    ) -> None:
        """
        执行LRP计算（物流需求计划）
        
        Args:
            tenant_id: 租户ID
            computation: 计算对象
        """
        # TODO: 实现LRP计算逻辑
        # 1. 获取需求明细
        # 2. 根据BOM和工艺路线计算生产计划
        # 3. 计算采购计划
        # 4. 计算时间安排
        # 5. 生成计算结果明细
        
        logger.info(f"执行LRP计算: {computation.computation_code}")
        # 占位实现，后续完善
        pass
    
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
    
    async def generate_work_orders_and_purchase_orders(
        self,
        tenant_id: int,
        computation_id: int,
        created_by: int
    ) -> Dict[str, Any]:
        """
        从需求计算结果一键生成工单和采购单
        
        Args:
            tenant_id: 租户ID
            computation_id: 计算ID
            created_by: 创建人ID
            
        Returns:
            Dict: 包含生成的工单和采购单信息
        """
        async with in_transaction():
            # 获取计算详情
            computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
            if not computation:
                raise NotFoundError(f"需求计算不存在: {computation_id}")
            
            # 只能从已完成的计算生成
            if computation.computation_status != "完成":
                raise BusinessLogicError(f"只能从已完成的计算生成工单和采购单，当前状态: {computation.computation_status}")
            
            # 获取计算结果明细
            items = await DemandComputationItem.filter(
                tenant_id=tenant_id,
                computation_id=computation_id
            ).all()
            
            if not items:
                raise BusinessLogicError("计算结果明细为空，无法生成工单和采购单")
            
            # 生成工单和采购单
            work_orders = []
            purchase_orders = []
            
            for item in items:
                # 如果有建议工单数量，生成工单
                if item.suggested_work_order_quantity and item.suggested_work_order_quantity > 0:
                    work_order = await self._create_work_order_from_item(
                        tenant_id=tenant_id,
                        computation=computation,
                        item=item,
                        created_by=created_by
                    )
                    work_orders.append(work_order)
                
                # 如果有建议采购订单数量，生成采购单
                if item.suggested_purchase_order_quantity and item.suggested_purchase_order_quantity > 0:
                    purchase_order = await self._create_purchase_order_from_item(
                        tenant_id=tenant_id,
                        computation=computation,
                        item=item,
                        created_by=created_by
                    )
                    purchase_orders.append(purchase_order)
            
            return {
                "computation_id": computation_id,
                "computation_code": computation.computation_code,
                "work_orders": work_orders,
                "purchase_orders": purchase_orders,
                "work_order_count": len(work_orders),
                "purchase_order_count": len(purchase_orders),
            }
    
    async def _create_work_order_from_item(
        self,
        tenant_id: int,
        computation: DemandComputation,
        item: DemandComputationItem,
        created_by: int
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
            
            # 确定计划时间（如果有LRP的日期信息）
            planned_start_date = None
            planned_end_date = None
            if item.production_start_date:
                planned_start_date = item.production_start_date
            if item.production_completion_date:
                planned_end_date = item.production_completion_date
            
            # 创建工单
            work_order_data = WorkOrderCreate(
                product_id=item.material_id,
                quantity=float(item.suggested_work_order_quantity or 0),
                production_mode=production_mode,
                sales_order_id=computation.demand_id if production_mode == "MTO" else None,
                planned_start_date=planned_start_date,
                planned_end_date=planned_end_date,
                remarks=f"从需求计算 {computation.computation_code} 自动生成",
            )
            
            work_order = await work_order_service.create_work_order(
                tenant_id=tenant_id,
                work_order_data=work_order_data,
                created_by=created_by
            )
            
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
    
    async def _create_purchase_order_from_item(
        self,
        tenant_id: int,
        computation: DemandComputation,
        item: DemandComputationItem,
        created_by: int
    ) -> Dict[str, Any]:
        """
        从计算结果明细创建采购单
        
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
            from datetime import datetime, date
            
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
            
            # TODO: 需要获取供应商信息（这里简化处理，实际应该从物料主数据获取默认供应商）
            # 暂时使用占位值
            supplier_id = 1  # 需要从物料主数据获取
            supplier_name = "待指定供应商"
            
            # 确定交货日期
            delivery_date = item.procurement_completion_date or item.delivery_date
            if not delivery_date:
                delivery_date = date.today() + timedelta(days=7)  # 默认7天后
            
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
            
            # 创建采购订单行
            await PurchaseOrderItem.create(
                tenant_id=tenant_id,
                order_id=purchase_order.id,
                material_id=item.material_id,
                material_code=item.material_code,
                material_name=item.material_name,
                material_spec=item.material_spec,
                material_unit=item.material_unit,
                quantity=float(item.suggested_purchase_order_quantity or 0),
                unit_price=0,  # 需要从物料主数据或供应商报价获取
                amount=0,  # 需要计算
            )
            
            return {
                "id": purchase_order.id,
                "order_code": purchase_order.order_code,
                "material_code": item.material_code,
                "material_name": item.material_name,
                "quantity": float(item.suggested_purchase_order_quantity or 0),
            }
        except Exception as e:
            logger.error(f"创建采购单失败: {e}")
            raise BusinessLogicError(f"创建采购单失败: {str(e)}")
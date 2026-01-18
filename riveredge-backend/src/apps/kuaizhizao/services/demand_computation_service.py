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
        from apps.kuaizhizao.models.demand import DemandItem
        from apps.master_data.models.material import Material
        
        logger.info(f"执行MRP计算: {computation.computation_code}")
        
        # 1. 获取需求明细
        demand_items = await DemandItem.filter(
            tenant_id=tenant_id,
            demand_id=computation.demand_id
        ).all()
        
        if not demand_items:
            logger.warning(f"需求明细为空，计算ID: {computation.id}")
            return
        
        # 2. 计算参数
        computation_params = computation.computation_params or {}
        include_safety_stock = computation_params.get("include_safety_stock", True)
        
        # 3. 存储所有物料需求（用于汇总）
        all_material_requirements = {}  # material_id -> requirement info
        
        # 4. 处理每个需求明细
        for demand_item in demand_items:
            material_id = demand_item.material_id
            required_quantity = float(demand_item.quantity or 0)
            
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
                    only_approved=True
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
                    only_approved=True
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
                
                # 如果有BOM，展开BOM
                from apps.kuaizhizao.utils.bom_helper import get_bom_items_by_material_id
                bom_items = await get_bom_items_by_material_id(
                    tenant_id=tenant_id,
                    material_id=material_id,
                    only_approved=True
                )
                
                if bom_items:
                    # 展开BOM（使用物料来源控制逻辑）
                    expanded_requirements = await expand_bom_with_source_control(
                        tenant_id=tenant_id,
                        material_id=material_id,
                        required_quantity=required_quantity,
                        only_approved=True
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
            
            # 计算毛需求和净需求
            gross_requirement = req_info["required_quantity"]
            available_inventory = 0.0  # TODO: 从库存系统获取
            safety_stock = 0.0  # TODO: 从物料主数据获取
            net_requirement = max(0.0, gross_requirement - available_inventory)
            
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
                # 委外件：建议生成委外工单（TODO: 后续实现委外工单）
                if net_requirement > 0 and validation_passed:
                    suggested_work_order_quantity = Decimal(str(net_requirement))  # 暂时使用工单表示
            # Phantom和Configure已经在BOM展开时处理，不需要单独生成工单或采购单
            
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
                gross_requirement=Decimal(str(gross_requirement)),
                safety_stock=Decimal(str(safety_stock)) if include_safety_stock else None,
                suggested_work_order_quantity=suggested_work_order_quantity if suggested_work_order_quantity > 0 else None,
                suggested_purchase_order_quantity=suggested_purchase_order_quantity if suggested_purchase_order_quantity > 0 else None,
                material_source_type=source_type,
                material_source_config=source_config,
                source_validation_passed=validation_passed,
                source_validation_errors=validation_errors if not validation_passed else None,
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
        from apps.kuaizhizao.models.demand import DemandItem
        from apps.master_data.models.material import Material
        
        logger.info(f"执行LRP计算: {computation.computation_code}")
        
        # 1. 获取需求明细
        demand_items = await DemandItem.filter(
            tenant_id=tenant_id,
            demand_id=computation.demand_id
        ).all()
        
        if not demand_items:
            logger.warning(f"需求明细为空，计算ID: {computation.id}")
            return
        
        # 2. 计算参数
        computation_params = computation.computation_params or {}
        
        # 3. 存储所有物料需求（用于汇总）
        all_material_requirements = {}  # material_id -> requirement info
        
        # 4. 处理每个需求明细
        for demand_item in demand_items:
            material_id = demand_item.material_id
            required_quantity = float(demand_item.quantity or 0)
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
                    only_approved=True
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
                    only_approved=True
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
                
                # 如果有BOM，展开BOM
                from apps.kuaizhizao.utils.bom_helper import get_bom_items_by_material_id
                bom_items = await get_bom_items_by_material_id(
                    tenant_id=tenant_id,
                    material_id=material_id,
                    only_approved=True
                )
                
                if bom_items:
                    expanded_requirements = await expand_bom_with_source_control(
                        tenant_id=tenant_id,
                        material_id=material_id,
                        required_quantity=required_quantity,
                        only_approved=True
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
            
            # 计算净需求
            gross_requirement = req_info["required_quantity"]
            available_inventory = 0.0  # TODO: 从库存系统获取
            net_requirement = max(0.0, gross_requirement - available_inventory)
            
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
                # 委外件：生成委外计划（TODO: 后续实现委外工单）
                if net_requirement > 0 and validation_passed:
                    suggested_work_order_quantity = Decimal(str(net_requirement))  # 暂时使用工单表示
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
            
            # 生成工单和采购单（根据物料来源类型智能生成）
            work_orders = []
            purchase_orders = []
            validation_errors = []
            
            # 按供应商分组采购件（物料来源控制增强）
            purchase_items_by_supplier: Dict[int, List[DemandComputationItem]] = {}
            
            for item in items:
                source_type = item.material_source_type
                
                # 跳过虚拟件（虚拟件不生成工单和采购单）
                if source_type == SOURCE_TYPE_PHANTOM:
                    logger.debug(f"跳过虚拟件，不生成工单和采购单，物料ID: {item.material_id}")
                    continue
                
                # 验证物料来源配置（验证失败时不允许生成）
                if source_type:
                    validation_passed, errors = await validate_material_source_config(
                        tenant_id=tenant_id,
                        material_id=item.material_id,
                        source_type=source_type
                    )
                    
                    if not validation_passed:
                        validation_errors.extend([f"物料 {item.material_code} ({item.material_name}): {err}" for err in errors])
                        logger.warning(f"物料来源验证失败，跳过生成，物料ID: {item.material_id}, 错误: {errors}")
                        continue
                
                # 根据物料来源类型生成相应的单据
                if source_type == SOURCE_TYPE_MAKE:
                    # 自制件：生成生产工单
                    if item.suggested_work_order_quantity and item.suggested_work_order_quantity > 0:
                        work_order = await self._create_work_order_from_item(
                            tenant_id=tenant_id,
                            computation=computation,
                            item=item,
                            created_by=created_by
                        )
                        work_orders.append(work_order)
                        
                elif source_type == SOURCE_TYPE_BUY:
                    # 采购件：按供应商分组（物料来源控制增强）
                    if item.suggested_purchase_order_quantity and item.suggested_purchase_order_quantity > 0:
                        # 获取供应商ID
                        supplier_id = None
                        if item.material_source_config:
                            source_config = item.material_source_config.get("source_config", {})
                            supplier_id = source_config.get("default_supplier_id")
                        
                        # 如果没有供应商ID，使用默认值1（后续需要手动指定）
                        if not supplier_id:
                            supplier_id = 1
                        
                        # 按供应商分组
                        if supplier_id not in purchase_items_by_supplier:
                            purchase_items_by_supplier[supplier_id] = []
                        purchase_items_by_supplier[supplier_id].append(item)
                        
                elif source_type == SOURCE_TYPE_OUTSOURCE:
                    # 委外件：生成委外工单（TODO: 后续实现委外工单，暂时生成普通工单）
                    if item.suggested_work_order_quantity and item.suggested_work_order_quantity > 0:
                        work_order = await self._create_work_order_from_item(
                            tenant_id=tenant_id,
                            computation=computation,
                            item=item,
                            created_by=created_by,
                            is_outsource=True  # 标记为委外工单
                        )
                        work_orders.append(work_order)
                        
                elif source_type == SOURCE_TYPE_CONFIGURE:
                    # 配置件：按变体生成生产工单（TODO: 后续支持变体选择）
                    if item.suggested_work_order_quantity and item.suggested_work_order_quantity > 0:
                        work_order = await self._create_work_order_from_item(
                            tenant_id=tenant_id,
                            computation=computation,
                            item=item,
                            created_by=created_by
                        )
                        work_orders.append(work_order)
                
                # 兼容旧逻辑：如果没有物料来源类型，根据建议数量生成（向后兼容）
                elif not source_type:
                    # 如果有建议工单数量，生成工单
                    if item.suggested_work_order_quantity and item.suggested_work_order_quantity > 0:
                        work_order = await self._create_work_order_from_item(
                            tenant_id=tenant_id,
                            computation=computation,
                            item=item,
                            created_by=created_by
                        )
                        work_orders.append(work_order)
                    
                    # 如果有建议采购订单数量，按供应商分组（物料来源控制增强）
                    if item.suggested_purchase_order_quantity and item.suggested_purchase_order_quantity > 0:
                        # 获取供应商ID（从物料主数据获取）
                        supplier_id = 1  # 默认值，需要手动指定
                        if item.material_source_config:
                            source_config = item.material_source_config.get("source_config", {})
                            supplier_id = source_config.get("default_supplier_id", 1)
                        
                        # 按供应商分组
                        if supplier_id not in purchase_items_by_supplier:
                            purchase_items_by_supplier[supplier_id] = []
                        purchase_items_by_supplier[supplier_id].append(item)
            
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
            
            # 如果有验证错误，抛出异常
            if validation_errors:
                error_msg = "物料来源验证失败，无法生成工单和采购单：\n" + "\n".join(validation_errors)
                raise BusinessLogicError(error_msg)
            
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
        created_by: int,
        is_outsource: bool = False
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
            
            # 创建工单（物料来源控制增强）
            remarks = f"从需求计算 {computation.computation_code} 自动生成"
            if is_outsource:
                remarks += "（委外工单）"
            
            work_order_data = WorkOrderCreate(
                product_id=item.material_id,
                quantity=float(item.suggested_work_order_quantity or 0),
                production_mode=production_mode,
                sales_order_id=computation.demand_id if production_mode == "MTO" else None,
                planned_start_date=planned_start_date,
                planned_end_date=planned_end_date,
                remarks=remarks,
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
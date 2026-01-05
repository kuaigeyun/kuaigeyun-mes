"""
成本核算服务模块

提供成本核算相关的业务逻辑处理，包括成本核算规则管理、成本核算、成本对比、成本分析等。

Author: Luigi Lu
Date: 2026-01-05
"""

import uuid
from datetime import datetime, date
from typing import List, Optional, Dict, Any
from decimal import Decimal
from tortoise.transactions import in_transaction
from tortoise.queryset import Q

from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError

from apps.base_service import AppBaseService
from apps.kuaizhizao.models.cost_rule import CostRule
from apps.kuaizhizao.models.cost_calculation import CostCalculation
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.reporting_record import ReportingRecord
from apps.kuaizhizao.models.production_picking import ProductionPicking, ProductionPickingItem
from apps.master_data.models.material import Material
from apps.master_data.models.bill_of_materials import BillOfMaterials, BillOfMaterialsItem
from apps.kuaizhizao.schemas.cost import (
    CostRuleCreate,
    CostRuleUpdate,
    CostRuleResponse,
    CostRuleListResponse,
    CostCalculationCreate,
    CostCalculationUpdate,
    CostCalculationResponse,
    CostCalculationListResponse,
    WorkOrderCostCalculationRequest,
    ProductCostCalculationRequest,
    CostComparisonResponse,
    CostAnalysisResponse,
    CostOptimizationResponse,
)
from loguru import logger


class CostRuleService(AppBaseService[CostRule]):
    """
    成本核算规则服务类
    
    处理成本核算规则相关的所有业务逻辑。
    """

    def __init__(self):
        super().__init__(CostRule)

    async def create_cost_rule(
        self,
        tenant_id: int,
        cost_rule_data: CostRuleCreate,
        created_by: int
    ) -> CostRuleResponse:
        """
        创建成本核算规则

        Args:
            tenant_id: 组织ID
            cost_rule_data: 成本核算规则创建数据
            created_by: 创建人ID

        Returns:
            CostRuleResponse: 创建的成本核算规则信息

        Raises:
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 生成规则编码（如果未提供）
            if not cost_rule_data.code:
                today = datetime.now().strftime("%Y%m%d")
                code = await self.generate_code(
                    tenant_id=tenant_id,
                    code_type="COST_RULE_CODE",
                    prefix=f"CR{today}"
                )
            else:
                code = cost_rule_data.code

            # 检查规则编码是否已存在
            existing_rule = await CostRule.filter(tenant_id=tenant_id, code=code, deleted_at__isnull=True).first()
            if existing_rule:
                raise ValidationError(f"成本核算规则编码 {code} 已存在")

            # 获取创建人信息
            user_info = await self.get_user_info(created_by)

            # 创建成本核算规则
            cost_rule = await CostRule.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                code=code,
                name=cost_rule_data.name,
                rule_type=cost_rule_data.rule_type,
                cost_type=cost_rule_data.cost_type,
                calculation_method=cost_rule_data.calculation_method,
                calculation_formula=cost_rule_data.calculation_formula,
                rule_parameters=cost_rule_data.rule_parameters,
                is_active=cost_rule_data.is_active,
                description=cost_rule_data.description,
                created_by=created_by,
                updated_by=created_by,
                created_by_name=user_info["name"],
                updated_by_name=user_info["name"],
            )

            return CostRuleResponse.model_validate(cost_rule)

    async def get_cost_rule_by_id(
        self,
        tenant_id: int,
        cost_rule_id: int
    ) -> CostRuleResponse:
        """
        根据ID获取成本核算规则

        Args:
            tenant_id: 组织ID
            cost_rule_id: 成本核算规则ID

        Returns:
            CostRuleResponse: 成本核算规则信息

        Raises:
            NotFoundError: 成本核算规则不存在
        """
        cost_rule = await self.get_by_id(tenant_id, cost_rule_id, raise_if_not_found=True)
        return CostRuleResponse.model_validate(cost_rule)

    async def list_cost_rules(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        rule_type: Optional[str] = None,
        cost_type: Optional[str] = None,
        is_active: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> List[CostRuleListResponse]:
        """
        获取成本核算规则列表

        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            rule_type: 规则类型
            cost_type: 成本类型
            is_active: 是否启用
            search: 搜索关键词

        Returns:
            List[CostRuleListResponse]: 成本核算规则列表
        """
        query = CostRule.filter(tenant_id=tenant_id, deleted_at__isnull=True)

        if rule_type:
            query = query.filter(rule_type=rule_type)
        if cost_type:
            query = query.filter(cost_type=cost_type)
        if is_active is not None:
            query = query.filter(is_active=is_active)
        if search:
            query = query.filter(Q(code__icontains=search) | Q(name__icontains=search))

        rules = await query.offset(skip).limit(limit).order_by("-created_at")
        return [CostRuleListResponse.model_validate(rule) for rule in rules]

    async def update_cost_rule(
        self,
        tenant_id: int,
        cost_rule_id: int,
        cost_rule_data: CostRuleUpdate,
        updated_by: int
    ) -> CostRuleResponse:
        """
        更新成本核算规则

        Args:
            tenant_id: 组织ID
            cost_rule_id: 成本核算规则ID
            cost_rule_data: 成本核算规则更新数据
            updated_by: 更新人ID

        Returns:
            CostRuleResponse: 更新后的成本核算规则信息

        Raises:
            NotFoundError: 成本核算规则不存在
        """
        async with in_transaction():
            cost_rule = await self.get_by_id(tenant_id, cost_rule_id, raise_if_not_found=True)

            # 获取更新人信息
            user_info = await self.get_user_info(updated_by)

            update_data = cost_rule_data.model_dump(exclude_unset=True)
            await cost_rule.update_from_dict({
                **update_data,
                "updated_by": updated_by,
                "updated_by_name": user_info["name"],
            }).save()

            return CostRuleResponse.model_validate(cost_rule)

    async def delete_cost_rule(
        self,
        tenant_id: int,
        cost_rule_id: int
    ) -> None:
        """
        删除成本核算规则（软删除）

        Args:
            tenant_id: 组织ID
            cost_rule_id: 成本核算规则ID

        Raises:
            NotFoundError: 成本核算规则不存在
        """
        async with in_transaction():
            cost_rule = await self.get_by_id(tenant_id, cost_rule_id, raise_if_not_found=True)

            cost_rule.deleted_at = datetime.utcnow()
            await cost_rule.save()


class CostCalculationService(AppBaseService[CostCalculation]):
    """
    成本核算服务类
    
    处理成本核算相关的所有业务逻辑。
    """

    def __init__(self):
        super().__init__(CostCalculation)
        self.cost_rule_service = CostRuleService()

    async def calculate_work_order_cost(
        self,
        tenant_id: int,
        request: WorkOrderCostCalculationRequest,
        created_by: int
    ) -> CostCalculationResponse:
        """
        核算工单成本

        根据工单信息计算材料成本、人工成本、制造费用等。

        Args:
            tenant_id: 组织ID
            request: 工单成本核算请求
            created_by: 创建人ID

        Returns:
            CostCalculationResponse: 成本核算记录

        Raises:
            NotFoundError: 工单不存在
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 获取工单信息
            work_order = await WorkOrder.filter(tenant_id=tenant_id, id=request.work_order_id, deleted_at__isnull=True).first()
            if not work_order:
                raise NotFoundError(f"工单 {request.work_order_id} 不存在")

            # 生成核算单号
            today = datetime.now().strftime("%Y%m%d")
            calculation_no = await self.generate_code(
                tenant_id=tenant_id,
                code_type="COST_CALCULATION_CODE",
                prefix=f"CC{today}"
            )

            # 计算材料成本
            material_cost = await self._calculate_material_cost(tenant_id, work_order)

            # 计算人工成本
            labor_cost = await self._calculate_labor_cost(tenant_id, work_order)

            # 计算制造费用
            manufacturing_cost = await self._calculate_manufacturing_cost(tenant_id, work_order)

            # 计算总成本和单位成本
            total_cost = material_cost + labor_cost + manufacturing_cost
            unit_cost = total_cost / work_order.quantity if work_order.quantity > 0 else Decimal(0)

            # 获取创建人信息
            user_info = await self.get_user_info(created_by)

            # 创建成本核算记录
            cost_calculation = await CostCalculation.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                calculation_no=calculation_no,
                calculation_type="工单成本",
                work_order_id=work_order.id,
                work_order_code=work_order.code,
                product_id=work_order.product_id,
                product_code=work_order.product_code,
                product_name=work_order.product_name,
                quantity=work_order.quantity,
                material_cost=material_cost,
                labor_cost=labor_cost,
                manufacturing_cost=manufacturing_cost,
                total_cost=total_cost,
                unit_cost=unit_cost,
                cost_details={
                    "material_cost_breakdown": await self._get_material_cost_breakdown(tenant_id, work_order),
                    "labor_cost_breakdown": await self._get_labor_cost_breakdown(tenant_id, work_order),
                    "manufacturing_cost_breakdown": await self._get_manufacturing_cost_breakdown(tenant_id, work_order),
                },
                calculation_date=request.calculation_date or date.today(),
                calculation_status="已核算",
                remark=request.remark,
                created_by=created_by,
                updated_by=created_by,
                created_by_name=user_info["name"],
                updated_by_name=user_info["name"],
            )

            return CostCalculationResponse.model_validate(cost_calculation)

    async def calculate_product_cost(
        self,
        tenant_id: int,
        request: ProductCostCalculationRequest,
        created_by: int
    ) -> CostCalculationResponse:
        """
        核算产品成本

        根据产品信息计算材料成本、人工成本、制造费用等。

        Args:
            tenant_id: 组织ID
            request: 产品成本核算请求
            created_by: 创建人ID

        Returns:
            CostCalculationResponse: 成本核算记录

        Raises:
            NotFoundError: 产品不存在
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 获取产品信息
            product = await Material.filter(tenant_id=tenant_id, id=request.product_id, deleted_at__isnull=True).first()
            if not product:
                raise NotFoundError(f"产品 {request.product_id} 不存在")

            # 生成核算单号
            today = datetime.now().strftime("%Y%m%d")
            calculation_no = await self.generate_code(
                tenant_id=tenant_id,
                code_type="COST_CALCULATION_CODE",
                prefix=f"CC{today}"
            )

            # 计算材料成本（基于BOM）
            material_cost = await self._calculate_product_material_cost(tenant_id, product, request.quantity)

            # 计算人工成本（基于标准工时）
            labor_cost = await self._calculate_product_labor_cost(tenant_id, product, request.quantity)

            # 计算制造费用（基于标准费用率）
            manufacturing_cost = await self._calculate_product_manufacturing_cost(tenant_id, product, request.quantity)

            # 计算总成本和单位成本
            total_cost = material_cost + labor_cost + manufacturing_cost
            unit_cost = total_cost / request.quantity if request.quantity > 0 else Decimal(0)

            # 获取创建人信息
            user_info = await self.get_user_info(created_by)

            # 创建成本核算记录
            cost_calculation = await CostCalculation.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                calculation_no=calculation_no,
                calculation_type=request.calculation_type,
                product_id=product.id,
                product_code=product.code,
                product_name=product.name,
                quantity=request.quantity,
                material_cost=material_cost,
                labor_cost=labor_cost,
                manufacturing_cost=manufacturing_cost,
                total_cost=total_cost,
                unit_cost=unit_cost,
                cost_details={
                    "material_cost_breakdown": await self._get_product_material_cost_breakdown(tenant_id, product, request.quantity),
                    "labor_cost_breakdown": await self._get_product_labor_cost_breakdown(tenant_id, product, request.quantity),
                    "manufacturing_cost_breakdown": await self._get_product_manufacturing_cost_breakdown(tenant_id, product, request.quantity),
                },
                calculation_date=request.calculation_date or date.today(),
                calculation_status="已核算",
                remark=request.remark,
                created_by=created_by,
                updated_by=created_by,
                created_by_name=user_info["name"],
                updated_by_name=user_info["name"],
            )

            return CostCalculationResponse.model_validate(cost_calculation)

    async def _calculate_material_cost(self, tenant_id: int, work_order: WorkOrder) -> Decimal:
        """
        计算工单材料成本

        根据工单的生产领料单计算材料成本。

        Args:
            tenant_id: 组织ID
            work_order: 工单对象

        Returns:
            Decimal: 材料成本
        """
        # 获取工单的生产领料单
        pickings = await ProductionPicking.filter(
            tenant_id=tenant_id,
            work_order_id=work_order.id,
            status="已确认",
            deleted_at__isnull=True
        ).all()

        total_material_cost = Decimal(0)
        for picking in pickings:
            # 获取领料单明细
            items = await ProductionPickingItem.filter(
                tenant_id=tenant_id,
                picking_id=picking.id,
                deleted_at__isnull=True
            ).all()

            for item in items:
                # 获取物料信息
                material = await Material.get_or_none(tenant_id=tenant_id, id=item.material_id)
                if material:
                    # 计算材料成本（数量 * 单价）
                    # TODO: 实际应该从库存成本或价格表获取单价
                    unit_price = Decimal(100.00)  # 默认单价，实际应该从价格表获取
                    total_material_cost += item.picked_quantity * unit_price

        return total_material_cost

    async def _calculate_labor_cost(self, tenant_id: int, work_order: WorkOrder) -> Decimal:
        """
        计算工单人工成本

        根据工单的报工记录计算人工成本。

        Args:
            tenant_id: 组织ID
            work_order: 工单对象

        Returns:
            Decimal: 人工成本
        """
        # 获取工单的报工记录
        reporting_records = await ReportingRecord.filter(
            tenant_id=tenant_id,
            work_order_id=work_order.id,
            status="approved",
            deleted_at__isnull=True
        ).all()

        total_labor_cost = Decimal(0)
        for record in reporting_records:
            # 计算人工成本（工时 * 工时单价）
            # TODO: 实际应该从员工信息或工时单价表获取工时单价
            hourly_rate = Decimal(50.00)  # 默认工时单价，实际应该从配置获取
            total_labor_cost += record.work_hours * hourly_rate

        return total_labor_cost

    async def _calculate_manufacturing_cost(self, tenant_id: int, work_order: WorkOrder) -> Decimal:
        """
        计算工单制造费用

        根据工单的制造费用规则计算制造费用。

        Args:
            tenant_id: 组织ID
            work_order: 工单对象

        Returns:
            Decimal: 制造费用
        """
        # 获取制造费用规则
        rules = await CostRule.filter(
            tenant_id=tenant_id,
            rule_type="制造费用",
            is_active=True,
            deleted_at__isnull=True
        ).all()

        total_manufacturing_cost = Decimal(0)
        for rule in rules:
            # 根据规则计算方法计算制造费用
            # TODO: 实际应该根据规则的计算方法和公式计算
            if rule.calculation_method == "按工时":
                # 获取工单总工时
                reporting_records = await ReportingRecord.filter(
                    tenant_id=tenant_id,
                    work_order_id=work_order.id,
                    status="approved",
                    deleted_at__isnull=True
                ).all()
                total_hours = sum([record.work_hours for record in reporting_records])
                # 计算制造费用（工时 * 费用率）
                rate = Decimal(10.00)  # 默认费用率，实际应该从规则参数获取
                total_manufacturing_cost += total_hours * rate
            elif rule.calculation_method == "按比例":
                # 计算制造费用（材料成本 * 比例）
                material_cost = await self._calculate_material_cost(tenant_id, work_order)
                rate = Decimal(0.1)  # 默认比例，实际应该从规则参数获取
                total_manufacturing_cost += material_cost * rate

        return total_manufacturing_cost

    async def _calculate_product_material_cost(self, tenant_id: int, product: Material, quantity: Decimal) -> Decimal:
        """
        计算产品材料成本

        根据产品的BOM计算材料成本。

        Args:
            tenant_id: 组织ID
            product: 产品对象
            quantity: 数量

        Returns:
            Decimal: 材料成本
        """
        # 获取产品的BOM
        bom = await BillOfMaterials.filter(
            tenant_id=tenant_id,
            product_id=product.id,
            is_active=True,
            deleted_at__isnull=True
        ).first()

        if not bom:
            return Decimal(0)

        # 获取BOM明细
        bom_items = await BillOfMaterialsItem.filter(
            tenant_id=tenant_id,
            bom_id=bom.id,
            deleted_at__isnull=True
        ).all()

        total_material_cost = Decimal(0)
        for item in bom_items:
            # 获取物料信息
            material = await Material.get_or_none(tenant_id=tenant_id, id=item.material_id)
            if material:
                # 计算材料成本（BOM数量 * 数量 * 单价）
                # TODO: 实际应该从库存成本或价格表获取单价
                unit_price = Decimal(100.00)  # 默认单价，实际应该从价格表获取
                total_material_cost += item.quantity * quantity * unit_price

        return total_material_cost

    async def _calculate_product_labor_cost(self, tenant_id: int, product: Material, quantity: Decimal) -> Decimal:
        """
        计算产品人工成本

        根据产品的标准工时计算人工成本。

        Args:
            tenant_id: 组织ID
            product: 产品对象
            quantity: 数量

        Returns:
            Decimal: 人工成本
        """
        # TODO: 实际应该从产品信息或工艺路线获取标准工时
        standard_hours = Decimal(2.0)  # 默认标准工时，实际应该从配置获取
        hourly_rate = Decimal(50.00)  # 默认工时单价，实际应该从配置获取
        return standard_hours * quantity * hourly_rate

    async def _calculate_product_manufacturing_cost(self, tenant_id: int, product: Material, quantity: Decimal) -> Decimal:
        """
        计算产品制造费用

        根据产品的制造费用规则计算制造费用。

        Args:
            tenant_id: 组织ID
            product: 产品对象
            quantity: 数量

        Returns:
            Decimal: 制造费用
        """
        # 获取制造费用规则
        rules = await CostRule.filter(
            tenant_id=tenant_id,
            rule_type="制造费用",
            is_active=True,
            deleted_at__isnull=True
        ).all()

        total_manufacturing_cost = Decimal(0)
        for rule in rules:
            # 根据规则计算方法计算制造费用
            # TODO: 实际应该根据规则的计算方法和公式计算
            if rule.calculation_method == "按比例":
                # 计算制造费用（材料成本 * 比例）
                material_cost = await self._calculate_product_material_cost(tenant_id, product, quantity)
                rate = Decimal(0.1)  # 默认比例，实际应该从规则参数获取
                total_manufacturing_cost += material_cost * rate

        return total_manufacturing_cost

    async def _get_material_cost_breakdown(self, tenant_id: int, work_order: WorkOrder) -> List[Dict[str, Any]]:
        """
        获取材料成本明细

        Args:
            tenant_id: 组织ID
            work_order: 工单对象

        Returns:
            List[Dict[str, Any]]: 材料成本明细
        """
        # TODO: 实现材料成本明细
        return []

    async def _get_labor_cost_breakdown(self, tenant_id: int, work_order: WorkOrder) -> List[Dict[str, Any]]:
        """
        获取人工成本明细

        Args:
            tenant_id: 组织ID
            work_order: 工单对象

        Returns:
            List[Dict[str, Any]]: 人工成本明细
        """
        # TODO: 实现人工成本明细
        return []

    async def _get_manufacturing_cost_breakdown(self, tenant_id: int, work_order: WorkOrder) -> List[Dict[str, Any]]:
        """
        获取制造费用明细

        Args:
            tenant_id: 组织ID
            work_order: 工单对象

        Returns:
            List[Dict[str, Any]]: 制造费用明细
        """
        # TODO: 实现制造费用明细
        return []

    async def _get_product_material_cost_breakdown(self, tenant_id: int, product: Material, quantity: Decimal) -> List[Dict[str, Any]]:
        """
        获取产品材料成本明细

        Args:
            tenant_id: 组织ID
            product: 产品对象
            quantity: 数量

        Returns:
            List[Dict[str, Any]]: 材料成本明细
        """
        # TODO: 实现产品材料成本明细
        return []

    async def _get_product_labor_cost_breakdown(self, tenant_id: int, product: Material, quantity: Decimal) -> List[Dict[str, Any]]:
        """
        获取产品人工成本明细

        Args:
            tenant_id: 组织ID
            product: 产品对象
            quantity: 数量

        Returns:
            List[Dict[str, Any]]: 人工成本明细
        """
        # TODO: 实现产品人工成本明细
        return []

    async def _get_product_manufacturing_cost_breakdown(self, tenant_id: int, product: Material, quantity: Decimal) -> List[Dict[str, Any]]:
        """
        获取产品制造费用明细

        Args:
            tenant_id: 组织ID
            product: 产品对象
            quantity: 数量

        Returns:
            List[Dict[str, Any]]: 制造费用明细
        """
        # TODO: 实现产品制造费用明细
        return []

    async def get_cost_calculation_by_id(
        self,
        tenant_id: int,
        cost_calculation_id: int
    ) -> CostCalculationResponse:
        """
        根据ID获取成本核算记录

        Args:
            tenant_id: 组织ID
            cost_calculation_id: 成本核算记录ID

        Returns:
            CostCalculationResponse: 成本核算记录信息

        Raises:
            NotFoundError: 成本核算记录不存在
        """
        cost_calculation = await self.get_by_id(tenant_id, cost_calculation_id, raise_if_not_found=True)
        return CostCalculationResponse.model_validate(cost_calculation)

    async def list_cost_calculations(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        calculation_type: Optional[str] = None,
        work_order_id: Optional[int] = None,
        product_id: Optional[int] = None,
        calculation_status: Optional[str] = None,
    ) -> List[CostCalculationListResponse]:
        """
        获取成本核算记录列表

        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            calculation_type: 核算类型
            work_order_id: 工单ID
            product_id: 产品ID
            calculation_status: 核算状态

        Returns:
            List[CostCalculationListResponse]: 成本核算记录列表
        """
        query = CostCalculation.filter(tenant_id=tenant_id, deleted_at__isnull=True)

        if calculation_type:
            query = query.filter(calculation_type=calculation_type)
        if work_order_id:
            query = query.filter(work_order_id=work_order_id)
        if product_id:
            query = query.filter(product_id=product_id)
        if calculation_status:
            query = query.filter(calculation_status=calculation_status)

        calculations = await query.offset(skip).limit(limit).order_by("-created_at")
        return [CostCalculationListResponse.model_validate(calc) for calc in calculations]

    async def compare_costs(
        self,
        tenant_id: int,
        product_id: int
    ) -> CostComparisonResponse:
        """
        对比标准成本和实际成本

        Args:
            tenant_id: 组织ID
            product_id: 产品ID

        Returns:
            CostComparisonResponse: 成本对比结果

        Raises:
            NotFoundError: 产品不存在
        """
        # 获取产品信息
        product = await Material.filter(tenant_id=tenant_id, id=product_id, deleted_at__isnull=True).first()
        if not product:
            raise NotFoundError(f"产品 {product_id} 不存在")

        # 获取标准成本（最新的标准成本核算记录）
        standard_calculation = await CostCalculation.filter(
            tenant_id=tenant_id,
            product_id=product_id,
            calculation_type="标准成本",
            calculation_status="已审核",
            deleted_at__isnull=True
        ).order_by("-created_at").first()

        # 获取实际成本（最新的实际成本核算记录）
        actual_calculation = await CostCalculation.filter(
            tenant_id=tenant_id,
            product_id=product_id,
            calculation_type="实际成本",
            calculation_status="已审核",
            deleted_at__isnull=True
        ).order_by("-created_at").first()

        if not standard_calculation:
            raise NotFoundError(f"产品 {product_id} 的标准成本不存在")
        if not actual_calculation:
            raise NotFoundError(f"产品 {product_id} 的实际成本不存在")

        # 计算成本差异
        standard_cost = standard_calculation.unit_cost
        actual_cost = actual_calculation.unit_cost
        cost_difference = actual_cost - standard_cost
        cost_difference_rate = (cost_difference / standard_cost * 100) if standard_cost > 0 else Decimal(0)

        # 计算各项成本差异
        material_cost_difference = actual_calculation.material_cost - standard_calculation.material_cost
        labor_cost_difference = actual_calculation.labor_cost - standard_calculation.labor_cost
        manufacturing_cost_difference = actual_calculation.manufacturing_cost - standard_calculation.manufacturing_cost

        # 分析差异原因
        difference_analysis = self._analyze_cost_difference(
            material_cost_difference,
            labor_cost_difference,
            manufacturing_cost_difference
        )

        return CostComparisonResponse(
            product_id=product.id,
            product_code=product.code,
            product_name=product.name,
            standard_cost=standard_cost,
            actual_cost=actual_cost,
            cost_difference=cost_difference,
            cost_difference_rate=cost_difference_rate,
            material_cost_difference=material_cost_difference,
            labor_cost_difference=labor_cost_difference,
            manufacturing_cost_difference=manufacturing_cost_difference,
            difference_analysis=difference_analysis,
        )

    async def analyze_cost(
        self,
        tenant_id: int,
        product_id: int
    ) -> CostAnalysisResponse:
        """
        分析产品成本

        Args:
            tenant_id: 组织ID
            product_id: 产品ID

        Returns:
            CostAnalysisResponse: 成本分析结果

        Raises:
            NotFoundError: 产品不存在
        """
        # 获取产品信息
        product = await Material.filter(tenant_id=tenant_id, id=product_id, deleted_at__isnull=True).first()
        if not product:
            raise NotFoundError(f"产品 {product_id} 不存在")

        # 获取最新的成本核算记录
        cost_calculation = await CostCalculation.filter(
            tenant_id=tenant_id,
            product_id=product_id,
            calculation_status="已审核",
            deleted_at__isnull=True
        ).order_by("-created_at").first()

        if not cost_calculation:
            raise NotFoundError(f"产品 {product_id} 的成本核算记录不存在")

        # 成本构成
        cost_composition = {
            "材料成本": cost_calculation.material_cost,
            "人工成本": cost_calculation.labor_cost,
            "制造费用": cost_calculation.manufacturing_cost,
        }

        # 成本趋势（获取最近6个月的成本核算记录）
        cost_trend = []
        calculations = await CostCalculation.filter(
            tenant_id=tenant_id,
            product_id=product_id,
            calculation_status="已审核",
            deleted_at__isnull=True
        ).order_by("-calculation_date").limit(6).all()

        for calc in reversed(calculations):
            cost_trend.append({
                "date": calc.calculation_date.isoformat(),
                "material_cost": float(calc.material_cost),
                "labor_cost": float(calc.labor_cost),
                "manufacturing_cost": float(calc.manufacturing_cost),
                "total_cost": float(calc.total_cost),
                "unit_cost": float(calc.unit_cost),
            })

        # 成本明细
        cost_breakdown = cost_calculation.cost_details or {}

        return CostAnalysisResponse(
            product_id=product.id,
            product_code=product.code,
            product_name=product.name,
            cost_composition=cost_composition,
            cost_trend=cost_trend,
            cost_breakdown=cost_breakdown,
        )

    async def get_cost_optimization(
        self,
        tenant_id: int,
        product_id: int
    ) -> CostOptimizationResponse:
        """
        获取成本优化建议

        Args:
            tenant_id: 组织ID
            product_id: 产品ID

        Returns:
            CostOptimizationResponse: 成本优化建议

        Raises:
            NotFoundError: 产品不存在
        """
        # 获取产品信息
        product = await Material.filter(tenant_id=tenant_id, id=product_id, deleted_at__isnull=True).first()
        if not product:
            raise NotFoundError(f"产品 {product_id} 不存在")

        # 获取成本对比结果
        cost_comparison = await self.compare_costs(tenant_id, product_id)

        # 生成优化建议
        suggestions = []
        potential_savings = Decimal(0)
        priority = "低"

        # 如果材料成本差异较大，建议优化材料成本
        if abs(cost_comparison.material_cost_difference) > Decimal(100):
            suggestions.append({
                "type": "材料成本优化",
                "description": f"材料成本差异 {cost_comparison.material_cost_difference}，建议优化材料采购或使用替代材料",
                "priority": "高" if abs(cost_comparison.material_cost_difference) > Decimal(500) else "中",
            })
            potential_savings += abs(cost_comparison.material_cost_difference)
            if abs(cost_comparison.material_cost_difference) > Decimal(500):
                priority = "高"

        # 如果人工成本差异较大，建议优化人工成本
        if abs(cost_comparison.labor_cost_difference) > Decimal(50):
            suggestions.append({
                "type": "人工成本优化",
                "description": f"人工成本差异 {cost_comparison.labor_cost_difference}，建议优化工艺流程或提高生产效率",
                "priority": "高" if abs(cost_comparison.labor_cost_difference) > Decimal(200) else "中",
            })
            potential_savings += abs(cost_comparison.labor_cost_difference)
            if abs(cost_comparison.labor_cost_difference) > Decimal(200) and priority != "高":
                priority = "中"

        # 如果制造费用差异较大，建议优化制造费用
        if abs(cost_comparison.manufacturing_cost_difference) > Decimal(30):
            suggestions.append({
                "type": "制造费用优化",
                "description": f"制造费用差异 {cost_comparison.manufacturing_cost_difference}，建议优化设备利用率或降低制造费用",
                "priority": "中",
            })
            potential_savings += abs(cost_comparison.manufacturing_cost_difference)
            if priority == "低":
                priority = "中"

        return CostOptimizationResponse(
            product_id=product.id,
            product_code=product.code,
            product_name=product.name,
            suggestions=suggestions,
            potential_savings=potential_savings,
            priority=priority,
        )

    def _analyze_cost_difference(
        self,
        material_cost_difference: Decimal,
        labor_cost_difference: Decimal,
        manufacturing_cost_difference: Decimal
    ) -> str:
        """
        分析成本差异原因

        Args:
            material_cost_difference: 材料成本差异
            labor_cost_difference: 人工成本差异
            manufacturing_cost_difference: 制造费用差异

        Returns:
            str: 差异原因分析
        """
        analysis_parts = []
        
        if material_cost_difference > 0:
            analysis_parts.append(f"材料成本超支 {material_cost_difference}，可能原因：材料价格上涨、材料用量增加、材料浪费等")
        elif material_cost_difference < 0:
            analysis_parts.append(f"材料成本节约 {abs(material_cost_difference)}，可能原因：材料价格下降、材料用量减少、材料利用率提高等")

        if labor_cost_difference > 0:
            analysis_parts.append(f"人工成本超支 {labor_cost_difference}，可能原因：工时增加、工时单价上涨、生产效率下降等")
        elif labor_cost_difference < 0:
            analysis_parts.append(f"人工成本节约 {abs(labor_cost_difference)}，可能原因：工时减少、工时单价下降、生产效率提高等")

        if manufacturing_cost_difference > 0:
            analysis_parts.append(f"制造费用超支 {manufacturing_cost_difference}，可能原因：设备利用率下降、制造费用率上涨等")
        elif manufacturing_cost_difference < 0:
            analysis_parts.append(f"制造费用节约 {abs(manufacturing_cost_difference)}，可能原因：设备利用率提高、制造费用率下降等")

        return "；".join(analysis_parts) if analysis_parts else "成本差异在合理范围内"


"""
成本核算服务模块（轻管理会计）

提供成本核算规则、成本核算记录等核心业务逻辑。
生产成本、委外成本等专项核算服务仍在 kuaizhizao。

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
from apps.kuaicaiwu.models.cost_rule import CostRule
from apps.kuaicaiwu.models.cost_calculation import CostCalculation
from apps.kuaicaiwu.models.standard_cost import StandardCost
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.reporting_record import ReportingRecord
from apps.kuaizhizao.models.production_picking import ProductionPicking
from apps.kuaizhizao.models.production_picking_item import ProductionPickingItem
from apps.master_data.models.material import Material
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
    """成本核算规则服务类"""

    def __init__(self):
        super().__init__(CostRule)

    async def create_cost_rule(
        self,
        tenant_id: int,
        cost_rule_data: CostRuleCreate,
        created_by: int
    ) -> CostRuleResponse:
        async with in_transaction():
            if not cost_rule_data.code:
                today = datetime.now().strftime("%Y%m%d")
                code = await self.generate_code(
                    tenant_id=tenant_id,
                    code_type="COST_RULE_CODE",
                    prefix=f"CR{today}"
                )
            else:
                code = cost_rule_data.code

            existing_rule = await CostRule.filter(tenant_id=tenant_id, code=code, deleted_at__isnull=True).first()
            if existing_rule:
                raise ValidationError(f"成本核算规则编码 {code} 已存在")

            user_info = await self.get_user_info(created_by)

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

    async def get_cost_rule_by_id(self, tenant_id: int, cost_rule_id: int) -> CostRuleResponse:
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
        async with in_transaction():
            cost_rule = await self.get_by_id(tenant_id, cost_rule_id, raise_if_not_found=True)
            user_info = await self.get_user_info(updated_by)
            update_data = cost_rule_data.model_dump(exclude_unset=True)
            await cost_rule.update_from_dict({
                **update_data,
                "updated_by": updated_by,
                "updated_by_name": user_info["name"],
            }).save()
            return CostRuleResponse.model_validate(cost_rule)

    async def delete_cost_rule(self, tenant_id: int, cost_rule_id: int) -> None:
        async with in_transaction():
            cost_rule = await self.get_by_id(tenant_id, cost_rule_id, raise_if_not_found=True)
            cost_rule.deleted_at = datetime.utcnow()
            await cost_rule.save()


class CostCalculationService(AppBaseService[CostCalculation]):
    """成本核算服务类"""

    def __init__(self):
        super().__init__(CostCalculation)
        self.cost_rule_service = CostRuleService()

    async def _get_standard_value(self, tenant_id: int, target_type: str, target_id: int, item_type: str) -> Decimal:
        """获取标准值（单价或费率）"""
        sc = await StandardCost.filter(
            tenant_id=tenant_id,
            target_type=target_type,
            target_id=target_id,
            cost_item_type=item_type,
            is_active=True,
            effective_date__lte=date.today()
        ).order_by("-effective_date").first()
        
        if sc:
            return sc.standard_value
        
        # 默认回退值（可根据业务需求调整）
        defaults = {
            "material_cost": Decimal("100.00"),
            "labor_rate": Decimal("50.00"),
            "overhead_rate": Decimal("10.00")
        }
        return defaults.get(item_type, Decimal("0.00"))

    async def calculate_work_order_cost(
        self,
        tenant_id: int,
        request: WorkOrderCostCalculationRequest,
        created_by: int
    ) -> CostCalculationResponse:
        async with in_transaction():
            work_order = await WorkOrder.filter(tenant_id=tenant_id, id=request.work_order_id, deleted_at__isnull=True).first()
            if not work_order:
                raise NotFoundError(f"工单 {request.work_order_id} 不存在")

            today = datetime.now().strftime("%Y%m%d")
            calculation_no = await self.generate_code(
                tenant_id=tenant_id,
                code_type="COST_CALCULATION_CODE",
                prefix=f"CC{today}"
            )

            material_cost = await self._calculate_material_cost(tenant_id, work_order)
            labor_cost = await self._calculate_labor_cost(tenant_id, work_order)
            manufacturing_cost = await self._calculate_manufacturing_cost(tenant_id, work_order)
            total_cost = material_cost + labor_cost + manufacturing_cost
            unit_cost = total_cost / work_order.quantity if work_order.quantity > 0 else Decimal(0)
            user_info = await self.get_user_info(created_by)

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
        async with in_transaction():
            product = await Material.filter(tenant_id=tenant_id, id=request.product_id, deleted_at__isnull=True).first()
            if not product:
                raise NotFoundError(f"产品 {request.product_id} 不存在")

            today = datetime.now().strftime("%Y%m%d")
            calculation_no = await self.generate_code(
                tenant_id=tenant_id,
                code_type="COST_CALCULATION_CODE",
                prefix=f"CC{today}"
            )

            material_cost = await self._calculate_product_material_cost(tenant_id, product, request.quantity)
            labor_cost = await self._calculate_product_labor_cost(tenant_id, product, request.quantity)
            manufacturing_cost = await self._calculate_product_manufacturing_cost(tenant_id, product, request.quantity)
            total_cost = material_cost + labor_cost + manufacturing_cost
            unit_cost = total_cost / request.quantity if request.quantity > 0 else Decimal(0)
            user_info = await self.get_user_info(created_by)

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
        pickings = await ProductionPicking.filter(
            tenant_id=tenant_id,
            work_order_id=work_order.id,
            status="已确认",
            deleted_at__isnull=True
        ).all()
        total_material_cost = Decimal(0)
        for picking in pickings:
            items = await ProductionPickingItem.filter(
                tenant_id=tenant_id,
                picking_id=picking.id,
                deleted_at__isnull=True
            ).all()
            for item in items:
                material = await Material.get_or_none(tenant_id=tenant_id, id=item.material_id)
                if material:
                    unit_price = await self._get_standard_value(tenant_id, "material", material.id, "material_cost")
                    total_material_cost += item.picked_quantity * unit_price
        return total_material_cost

    async def _calculate_labor_cost(self, tenant_id: int, work_order: WorkOrder) -> Decimal:
        reporting_records = await ReportingRecord.filter(
            tenant_id=tenant_id,
            work_order_id=work_order.id,
            status="approved",
            deleted_at__isnull=True
        ).all()
        total_labor_cost = Decimal(0)
        for record in reporting_records:
            # 优先从工作中心获取标准工时费率
            hourly_rate = await self._get_standard_value(tenant_id, "work_center", record.work_center_id, "labor_rate")
            total_labor_cost += record.work_hours * hourly_rate
        return total_labor_cost

    async def _calculate_manufacturing_cost(self, tenant_id: int, work_order: WorkOrder) -> Decimal:
        rules = await CostRule.filter(
            tenant_id=tenant_id,
            rule_type="制造费用",
            is_active=True,
            deleted_at__isnull=True
        ).all()
        total_manufacturing_cost = Decimal(0)
        for rule in rules:
            if rule.calculation_method == "按工时":
                reporting_records = await ReportingRecord.filter(
                    tenant_id=tenant_id,
                    work_order_id=work_order.id,
                    status="approved",
                    deleted_at__isnull=True
                ).all()
                total_hours = sum([record.work_hours for record in reporting_records])
                # 从规则参数或工作中心获取制造费用率
                rate = await self._get_standard_value(tenant_id, "work_center", work_order.work_center_id, "overhead_rate") # Assuming work_order has work_center_id
                total_manufacturing_cost += total_hours * rate
            elif rule.calculation_method == "按比例":
                material_cost = await self._calculate_material_cost(tenant_id, work_order)
                rate = Decimal(0.1)
                total_manufacturing_cost += material_cost * rate
        return total_manufacturing_cost

    async def _calculate_product_material_cost(self, tenant_id: int, product: Material, quantity: Decimal) -> Decimal:
        return Decimal(0)

    async def _calculate_product_labor_cost(self, tenant_id: int, product: Material, quantity: Decimal) -> Decimal:
        standard_hours = Decimal(2.0)
        hourly_rate = Decimal(50.00)
        return standard_hours * quantity * hourly_rate

    async def _calculate_product_manufacturing_cost(self, tenant_id: int, product: Material, quantity: Decimal) -> Decimal:
        rules = await CostRule.filter(
            tenant_id=tenant_id,
            rule_type="制造费用",
            is_active=True,
            deleted_at__isnull=True
        ).all()
        total_manufacturing_cost = Decimal(0)
        for rule in rules:
            if rule.calculation_method == "按比例":
                material_cost = await self._calculate_product_material_cost(tenant_id, product, quantity)
                rate = Decimal(0.1)
                total_manufacturing_cost += material_cost * rate
        return total_manufacturing_cost

    async def _get_material_cost_breakdown(self, tenant_id: int, work_order: WorkOrder) -> List[Dict[str, Any]]:
        return []

    async def _get_labor_cost_breakdown(self, tenant_id: int, work_order: WorkOrder) -> List[Dict[str, Any]]:
        return []

    async def _get_manufacturing_cost_breakdown(self, tenant_id: int, work_order: WorkOrder) -> List[Dict[str, Any]]:
        return []

    async def _get_product_material_cost_breakdown(self, tenant_id: int, product: Material, quantity: Decimal) -> List[Dict[str, Any]]:
        return []

    async def _get_product_labor_cost_breakdown(self, tenant_id: int, product: Material, quantity: Decimal) -> List[Dict[str, Any]]:
        return []

    async def _get_product_manufacturing_cost_breakdown(self, tenant_id: int, product: Material, quantity: Decimal) -> List[Dict[str, Any]]:
        return []

    async def get_cost_calculation_by_id(self, tenant_id: int, cost_calculation_id: int) -> CostCalculationResponse:
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

    async def compare_costs(self, tenant_id: int, product_id: int) -> CostComparisonResponse:
        product = await Material.filter(tenant_id=tenant_id, id=product_id, deleted_at__isnull=True).first()
        if not product:
            raise NotFoundError(f"产品 {product_id} 不存在")
        standard_calculation = await CostCalculation.filter(
            tenant_id=tenant_id,
            product_id=product_id,
            calculation_type="标准成本",
            calculation_status="已审核",
            deleted_at__isnull=True
        ).order_by("-created_at").first()
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
        standard_cost = standard_calculation.unit_cost
        actual_cost = actual_calculation.unit_cost
        cost_difference = actual_cost - standard_cost
        cost_difference_rate = (cost_difference / standard_cost * 100) if standard_cost > 0 else Decimal(0)
        material_cost_difference = actual_calculation.material_cost - standard_calculation.material_cost
        labor_cost_difference = actual_calculation.labor_cost - standard_calculation.labor_cost
        manufacturing_cost_difference = actual_calculation.manufacturing_cost - standard_calculation.manufacturing_cost
        difference_analysis = self._analyze_cost_difference(
            material_cost_difference, labor_cost_difference, manufacturing_cost_difference
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

    async def analyze_cost(self, tenant_id: int, product_id: int) -> CostAnalysisResponse:
        product = await Material.filter(tenant_id=tenant_id, id=product_id, deleted_at__isnull=True).first()
        if not product:
            raise NotFoundError(f"产品 {product_id} 不存在")
        cost_calculation = await CostCalculation.filter(
            tenant_id=tenant_id,
            product_id=product_id,
            calculation_status="已审核",
            deleted_at__isnull=True
        ).order_by("-created_at").first()
        if not cost_calculation:
            raise NotFoundError(f"产品 {product_id} 的成本核算记录不存在")
        cost_composition = {
            "材料成本": cost_calculation.material_cost,
            "人工成本": cost_calculation.labor_cost,
            "制造费用": cost_calculation.manufacturing_cost,
        }
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
        cost_breakdown = cost_calculation.cost_details or {}
        return CostAnalysisResponse(
            product_id=product.id,
            product_code=product.code,
            product_name=product.name,
            cost_composition=cost_composition,
            cost_trend=cost_trend,
            cost_breakdown=cost_breakdown,
        )

    async def get_cost_optimization(self, tenant_id: int, product_id: int) -> CostOptimizationResponse:
        product = await Material.filter(tenant_id=tenant_id, id=product_id, deleted_at__isnull=True).first()
        if not product:
            raise NotFoundError(f"产品 {product_id} 不存在")
        cost_comparison = await self.compare_costs(tenant_id, product_id)
        suggestions = []
        potential_savings = Decimal(0)
        priority = "低"
        if abs(cost_comparison.material_cost_difference) > Decimal(100):
            suggestions.append({
                "type": "材料成本优化",
                "description": f"材料成本差异 {cost_comparison.material_cost_difference}，建议优化材料采购或使用替代材料",
                "priority": "高" if abs(cost_comparison.material_cost_difference) > Decimal(500) else "中",
            })
            potential_savings += abs(cost_comparison.material_cost_difference)
            if abs(cost_comparison.material_cost_difference) > Decimal(500):
                priority = "高"
        if abs(cost_comparison.labor_cost_difference) > Decimal(50):
            suggestions.append({
                "type": "人工成本优化",
                "description": f"人工成本差异 {cost_comparison.labor_cost_difference}，建议优化工艺流程或提高生产效率",
                "priority": "高" if abs(cost_comparison.labor_cost_difference) > Decimal(200) else "中",
            })
            potential_savings += abs(cost_comparison.labor_cost_difference)
            if abs(cost_comparison.labor_cost_difference) > Decimal(200) and priority != "高":
                priority = "中"
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

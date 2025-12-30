"""
BOM管理服务模块

提供BOM管理相关的业务逻辑处理，包括BOM展开和物料需求计算。

Author: Luigi Lu
Date: 2025-12-30
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, date
from tortoise.transactions import in_transaction
from tortoise.expressions import Q
from loguru import logger
from collections import defaultdict

from apps.kuaizhizao.models.bill_of_materials import BillOfMaterials
from apps.kuaizhizao.models.bill_of_materials_item import BillOfMaterialsItem

from apps.kuaizhizao.schemas.bom import (
    # BOM
    BillOfMaterialsCreate, BillOfMaterialsUpdate, BillOfMaterialsResponse, BillOfMaterialsListResponse,
    BillOfMaterialsItemCreate, BillOfMaterialsItemUpdate, BillOfMaterialsItemResponse,
    # BOM展开和计算
    BOMExpansionItem, BOMExpansionResult, MaterialRequirement, MRPRequirement,
)

from core.services.base import BaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from infra.services.user_service import UserService


class BOMService(BaseService):
    """BOM物料清单服务"""

    def __init__(self):
        super().__init__(BillOfMaterials)

    async def create_bom(self, tenant_id: int, bom_data: BillOfMaterialsCreate, created_by: int) -> BillOfMaterialsResponse:
        """创建BOM"""
        async with in_transaction():
            creator = await UserService.get_user_by_id(created_by)
            created_by_name = f"{creator.first_name or ''} {creator.last_name or ''}".strip() or creator.username
            code = await self._generate_bom_code(tenant_id)

            bom = await BillOfMaterials.create(
                tenant_id=tenant_id,
                bom_code=code,
                created_by=created_by,
                created_by_name=created_by_name,
                **bom_data.model_dump(exclude_unset=True, exclude={'created_by'})
            )
            return BillOfMaterialsResponse.model_validate(bom)

    async def get_bom_by_id(self, tenant_id: int, bom_id: int) -> BillOfMaterialsResponse:
        """根据ID获取BOM"""
        bom = await BillOfMaterials.get_or_none(tenant_id=tenant_id, id=bom_id)
        if not bom:
            raise NotFoundError(f"BOM不存在: {bom_id}")
        return BillOfMaterialsResponse.model_validate(bom)

    async def list_boms(self, tenant_id: int, skip: int = 0, limit: int = 20, **filters) -> List[BillOfMaterialsListResponse]:
        """获取BOM列表"""
        query = BillOfMaterials.filter(tenant_id=tenant_id)

        # 应用过滤条件
        if filters.get('status'):
            query = query.filter(status=filters['status'])
        if filters.get('finished_product_id'):
            query = query.filter(finished_product_id=filters['finished_product_id'])
        if filters.get('bom_type'):
            query = query.filter(bom_type=filters['bom_type'])

        boms = await query.offset(skip).limit(limit).order_by('-created_at')
        return [BillOfMaterialsListResponse.model_validate(bom) for bom in boms]

    async def update_bom(self, tenant_id: int, bom_id: int, bom_data: BillOfMaterialsUpdate, updated_by: int) -> BillOfMaterialsResponse:
        """更新BOM"""
        async with in_transaction():
            bom = await self.get_bom_by_id(tenant_id, bom_id)

            # 只有草稿状态的BOM才能修改
            if bom.status != '草稿':
                raise BusinessLogicError("只有草稿状态的BOM才能修改")

            update_data = bom_data.model_dump(exclude_unset=True, exclude={'updated_by'})
            update_data['updated_by'] = updated_by

            await BillOfMaterials.filter(tenant_id=tenant_id, id=bom_id).update(**update_data)
            updated_bom = await self.get_bom_by_id(tenant_id, bom_id)
            return updated_bom

    async def approve_bom(self, tenant_id: int, bom_id: int, approved_by: int, rejection_reason: Optional[str] = None) -> BillOfMaterialsResponse:
        """审核BOM"""
        async with in_transaction():
            bom = await self.get_bom_by_id(tenant_id, bom_id)

            if bom.review_status != '待审核':
                raise BusinessLogicError("BOM审核状态不是待审核")

            approver = await UserService.get_user_by_id(approved_by)
            approver_name = f"{approver.first_name or ''} {approver.last_name or ''}".strip() or approver.username

            review_status = "驳回" if rejection_reason else "通过"
            status = "已驳回" if rejection_reason else "已审核"

            await BillOfMaterials.filter(tenant_id=tenant_id, id=bom_id).update(
                reviewer_id=approved_by,
                reviewer_name=approver_name,
                review_time=datetime.now(),
                review_status=review_status,
                review_remarks=rejection_reason,
                status=status,
                updated_by=approved_by
            )

            updated_bom = await self.get_bom_by_id(tenant_id, bom_id)
            return updated_bom

    async def add_bom_item(self, tenant_id: int, bom_id: int, item_data: BillOfMaterialsItemCreate) -> BillOfMaterialsItemResponse:
        """添加BOM明细"""
        async with in_transaction():
            # 验证BOM存在且为草稿状态
            bom = await self.get_bom_by_id(tenant_id, bom_id)
            if bom.status != '草稿':
                raise BusinessLogicError("只有草稿状态的BOM才能添加明细")

            # 计算总成本
            total_cost = item_data.quantity * item_data.unit_cost

            item = await BillOfMaterialsItem.create(
                tenant_id=tenant_id,
                bom_id=bom_id,
                total_cost=total_cost,
                **item_data.model_dump(exclude_unset=True)
            )

            # 更新BOM总成本
            await self._update_bom_costs(tenant_id, bom_id)

            return BillOfMaterialsItemResponse.model_validate(item)

    async def get_bom_items(self, tenant_id: int, bom_id: int) -> List[BillOfMaterialsItemResponse]:
        """获取BOM明细"""
        items = await BillOfMaterialsItem.filter(tenant_id=tenant_id, bom_id=bom_id).order_by('level', 'sequence')
        return [BillOfMaterialsItemResponse.model_validate(item) for item in items]

    async def expand_bom(self, tenant_id: int, bom_id: int, quantity: float = 1.0) -> BOMExpansionResult:
        """展开BOM，计算所有层级的物料需求"""
        bom = await self.get_bom_by_id(tenant_id, bom_id)

        if bom.status != '已审核':
            raise BusinessLogicError("只有已审核的BOM才能展开")

        expansion_items = []
        total_cost = 0
        max_lead_time = 0

        # 获取所有BOM明细并按层级排序
        all_items = await BillOfMaterialsItem.filter(
            tenant_id=tenant_id,
            bom_id=bom_id
        ).order_by('level', 'sequence')

        # 构建层级结构
        items_by_parent = defaultdict(list)
        for item in all_items:
            items_by_parent[item.parent_item_id].append(item)

        # 递归展开BOM
        def expand_level(parent_id: Optional[int], level: int, parent_quantity: float):
            nonlocal total_cost, max_lead_time

            for item in items_by_parent.get(parent_id, []):
                # 计算实际需求数量（考虑损耗率）
                required_quantity = parent_quantity * item.quantity * (1 + item.scrap_rate / 100)
                item_total_cost = required_quantity * item.unit_cost

                expansion_item = BOMExpansionItem(
                    level=level,
                    component_id=item.component_id,
                    component_code=item.component_code,
                    component_name=item.component_name,
                    component_type=item.component_type,
                    required_quantity=round(required_quantity, 4),
                    unit=item.unit,
                    unit_cost=item.unit_cost,
                    total_cost=round(item_total_cost, 2),
                    lead_time=item.lead_time,
                    operation_name=item.operation_name
                )

                expansion_items.append(expansion_item)
                total_cost += item_total_cost
                max_lead_time = max(max_lead_time, item.lead_time)

                # 递归展开子项（如果有下级BOM）
                expand_level(item.id, level + 1, required_quantity)

        # 从顶级开始展开
        expand_level(None, 1, quantity)

        return BOMExpansionResult(
            bom_id=bom_id,
            bom_code=bom.bom_code,
            finished_product_code=bom.finished_product_code,
            finished_product_name=bom.finished_product_name,
            expansion_quantity=quantity,
            total_cost=round(total_cost, 2),
            max_lead_time=max_lead_time,
            items=expansion_items
        )

    async def calculate_material_requirements(self, tenant_id: int, bom_id: int, required_quantity: float) -> List[MaterialRequirement]:
        """计算物料需求"""
        expansion_result = await self.expand_bom(tenant_id, bom_id, required_quantity)

        # 按物料汇总需求
        material_requirements = defaultdict(lambda: {
            'component_id': 0,
            'component_code': '',
            'component_name': '',
            'component_type': '',
            'gross_requirement': 0,
            'unit': '',
            'lead_time': 0
        })

        for item in expansion_result.items:
            key = item.component_id
            if material_requirements[key]['component_code'] == '':
                material_requirements[key].update({
                    'component_id': item.component_id,
                    'component_code': item.component_code,
                    'component_name': item.component_name,
                    'component_type': item.component_type,
                    'unit': item.unit,
                    'lead_time': item.lead_time
                })
            material_requirements[key]['gross_requirement'] += item.required_quantity

        # 转换为MaterialRequirement列表
        requirements = []
        for req in material_requirements.values():
            # TODO: 从库存系统中获取可用库存和计划入库
            available_inventory = 0  # 暂时设为0
            planned_receipt = 0      # 暂时设为0

            net_requirement = max(0, req['gross_requirement'] - available_inventory - planned_receipt)

            requirements.append(MaterialRequirement(
                component_id=req['component_id'],
                component_code=req['component_code'],
                component_name=req['component_name'],
                component_type=req['component_type'],
                gross_requirement=round(req['gross_requirement'], 4),
                net_requirement=round(net_requirement, 4),
                available_inventory=available_inventory,
                planned_receipt=planned_receipt,
                unit=req['unit'],
                lead_time=req['lead_time']
            ))

        return requirements

    async def _update_bom_costs(self, tenant_id: int, bom_id: int):
        """更新BOM的成本信息"""
        # 计算材料成本
        material_cost_result = await BillOfMaterialsItem.filter(
            tenant_id=tenant_id,
            bom_id=bom_id
        ).aggregate(material_cost=Sum('total_cost'))

        material_cost = material_cost_result.get('material_cost', 0) or 0

        # TODO: 计算人工成本和制造费用（需要工艺路线数据）
        labor_cost = 0
        overhead_cost = 0

        total_cost = material_cost + labor_cost + overhead_cost

        await BillOfMaterials.filter(tenant_id=tenant_id, id=bom_id).update(
            material_cost=round(material_cost, 2),
            labor_cost=round(labor_cost, 2),
            overhead_cost=round(overhead_cost, 2),
            total_cost=round(total_cost, 2)
        )

    @staticmethod
    async def _generate_bom_code(tenant_id: int) -> str:
        """生成BOM编码"""
        today = datetime.now().strftime("%Y%m%d")
        prefix = f"BOM{today}"
        from core.services.business.code_generation_service import CodeGenerationService
        return await CodeGenerationService.generate_code(tenant_id, "BOM_CODE", {"prefix": prefix})

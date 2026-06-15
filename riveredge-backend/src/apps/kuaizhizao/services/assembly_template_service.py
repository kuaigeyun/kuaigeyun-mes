"""
组装模板业务服务
"""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.common.base_service import AppBaseService
from apps.kuaizhizao.models.assembly_template import AssemblyTemplate, AssemblyTemplateItem
from apps.kuaizhizao.schemas.assembly_template import (
    AssemblyTemplateCreate,
    AssemblyTemplateUpdate,
    AssemblyTemplateResponse,
    AssemblyTemplateListResponse,
    AssemblyTemplateItemCreate,
    AssemblyTemplateItemCreateInput,
    AssemblyTemplateItemUpdate,
    AssemblyTemplateItemResponse,
    AssemblyTemplateBomPreviewLine,
    AssemblyTemplateBomPreviewResponse,
)
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError


class AssemblyTemplateService(AppBaseService[AssemblyTemplate]):
    def __init__(self):
        super().__init__(AssemblyTemplate)

    async def _resolve_bom_lines(
        self,
        tenant_id: int,
        product_material_id: int,
        base_quantity: Decimal,
    ) -> List[AssemblyTemplateBomPreviewLine]:
        from apps.kuaizhizao.utils.bom_helper import calculate_material_requirements_from_bom

        base_qty = Decimal(str(base_quantity or 1))
        if base_qty <= 0:
            raise ValidationError("基准数量必须大于 0")

        requirements = await calculate_material_requirements_from_bom(
            tenant_id=tenant_id,
            material_id=product_material_id,
            required_quantity=float(base_qty),
            only_approved=True,
        )
        if not requirements:
            raise ValidationError("该物料无已审核 BOM 或 BOM 无组件，无法从 BOM 读取")

        lines: List[AssemblyTemplateBomPreviewLine] = []
        for idx, req in enumerate(requirements):
            net = Decimal(str(getattr(req, "net_requirement", 0) or 0))
            if net <= 0:
                continue
            qty_per_base = net / base_qty
            lines.append(
                AssemblyTemplateBomPreviewLine(
                    material_id=int(req.component_id),
                    material_code=str(getattr(req, "component_code", "") or ""),
                    material_name=str(getattr(req, "component_name", "") or ""),
                    quantity_per_base=qty_per_base,
                    unit=str(getattr(req, "unit", "") or "") or None,
                )
            )
        if not lines:
            raise ValidationError("BOM 展开后无有效组件用量")
        return lines

    async def preview_bom(
        self,
        tenant_id: int,
        product_material_id: int,
        base_quantity: Decimal = Decimal("1"),
        product_material_code: Optional[str] = None,
        product_material_name: Optional[str] = None,
    ) -> AssemblyTemplateBomPreviewResponse:
        lines = await self._resolve_bom_lines(tenant_id, product_material_id, base_quantity)
        return AssemblyTemplateBomPreviewResponse(
            product_material_id=product_material_id,
            product_material_code=product_material_code,
            product_material_name=product_material_name,
            base_quantity=base_quantity,
            lines=lines,
        )

    async def _replace_template_items(
        self,
        tenant_id: int,
        template_id: int,
        items: List[AssemblyTemplateItemCreate],
    ) -> None:
        now = datetime.now()
        await AssemblyTemplateItem.filter(
            tenant_id=tenant_id,
            template_id=template_id,
            deleted_at__isnull=True,
        ).update(deleted_at=now)

        for idx, item_data in enumerate(items):
            await AssemblyTemplateItem.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                template_id=template_id,
                sequence=item_data.sequence if item_data.sequence else idx,
                material_id=item_data.material_id,
                material_code=item_data.material_code,
                material_name=item_data.material_name,
                quantity_per_base=item_data.quantity_per_base,
                unit_price=item_data.unit_price or Decimal("0"),
                remarks=item_data.remarks,
            )

    async def _load_items(
        self, tenant_id: int, template_id: int
    ) -> List[AssemblyTemplateItemResponse]:
        rows = await AssemblyTemplateItem.filter(
            tenant_id=tenant_id,
            template_id=template_id,
            deleted_at__isnull=True,
        ).order_by("sequence", "id")
        return [
            AssemblyTemplateItemResponse(
                id=row.id,
                template_id=template_id,
                material_id=row.material_id,
                material_code=row.material_code,
                material_name=row.material_name,
                quantity_per_base=row.quantity_per_base,
                unit_price=row.unit_price,
                sequence=row.sequence,
                remarks=row.remarks,
                created_at=row.created_at,
                updated_at=row.updated_at,
            )
            for row in rows
        ]

    async def _build_response(
        self, template: AssemblyTemplate, include_items: bool = True
    ) -> AssemblyTemplateResponse:
        resp = AssemblyTemplateResponse.model_validate(template)
        if include_items:
            resp.items = await self._load_items(template.tenant_id, template.id)
        return resp

    async def create_template(
        self,
        tenant_id: int,
        data: AssemblyTemplateCreate,
        created_by: int,
    ) -> AssemblyTemplateResponse:
        async with in_transaction():
            if data.template_code:
                template_code = data.template_code.strip()
                existing = await AssemblyTemplate.filter(
                    tenant_id=tenant_id,
                    template_code=template_code,
                    deleted_at__isnull=True,
                ).first()
                if existing:
                    raise ValidationError(f"模板编码 '{template_code}' 已存在")
            else:
                today = datetime.now().strftime("%Y%m%d")
                template_code = await self.generate_code(
                    tenant_id=tenant_id,
                    code_type="ASSEMBLY_TEMPLATE_CODE",
                    prefix=f"ZZMB{today}",
                )

            user_info = await self.get_user_info(created_by)
            template = await AssemblyTemplate.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                template_code=template_code,
                template_name=data.template_name,
                product_material_id=data.product_material_id,
                product_material_code=data.product_material_code,
                product_material_name=data.product_material_name,
                base_quantity=data.base_quantity or Decimal("1"),
                source_type="manual",
                is_active=data.is_active,
                total_items=0,
                remarks=data.remarks,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
            )

            if data.items:
                await self._replace_template_items(tenant_id, template.id, data.items)
                template.total_items = len(data.items)
                await template.save(update_fields=["total_items"])

            return await self._build_response(template)

    async def get_template_by_id(
        self, tenant_id: int, template_id: int
    ) -> AssemblyTemplateResponse:
        template = await AssemblyTemplate.get_or_none(
            id=template_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not template:
            raise NotFoundError(f"组装模板不存在: {template_id}")
        return await self._build_response(template)

    async def list_templates(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        keyword: Optional[str] = None,
        product_material_id: Optional[int] = None,
        is_active: Optional[bool] = None,
    ) -> AssemblyTemplateListResponse:
        query = AssemblyTemplate.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if keyword:
            query = query.filter(
                Q(template_code__icontains=keyword)
                | Q(template_name__icontains=keyword)
                | Q(product_material_code__icontains=keyword)
                | Q(product_material_name__icontains=keyword)
            )
        if product_material_id:
            query = query.filter(product_material_id=product_material_id)
        if is_active is not None:
            query = query.filter(is_active=is_active)

        total = await query.count()
        rows = await query.order_by("-updated_at").offset(skip).limit(limit)
        return AssemblyTemplateListResponse(
            items=[AssemblyTemplateResponse.model_validate(r) for r in rows],
            total=total,
        )

    async def update_template(
        self,
        tenant_id: int,
        template_id: int,
        data: AssemblyTemplateUpdate,
        updated_by: int,
    ) -> AssemblyTemplateResponse:
        async with in_transaction():
            template = await AssemblyTemplate.get_or_none(
                id=template_id, tenant_id=tenant_id, deleted_at__isnull=True
            )
            if not template:
                raise NotFoundError(f"组装模板不存在: {template_id}")

            user_info = await self.get_user_info(updated_by)
            payload = data.model_dump(exclude_unset=True, exclude={"items"})
            for field, value in payload.items():
                setattr(template, field, value)
            template.updated_by = updated_by
            template.updated_by_name = user_info["name"]

            if data.items is not None:
                await self._replace_template_items(tenant_id, template_id, data.items)
                template.total_items = len(data.items)

            await template.save()
            return await self._build_response(template)

    async def delete_template(self, tenant_id: int, template_id: int) -> bool:
        template = await AssemblyTemplate.get_or_none(
            id=template_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not template:
            raise NotFoundError(f"组装模板不存在: {template_id}")
        now = datetime.now()
        await AssemblyTemplate.filter(id=template_id, tenant_id=tenant_id).update(deleted_at=now)
        await AssemblyTemplateItem.filter(
            tenant_id=tenant_id, template_id=template_id, deleted_at__isnull=True
        ).update(deleted_at=now)
        return True

    async def import_from_bom(
        self,
        tenant_id: int,
        template_id: int,
        updated_by: int,
    ) -> AssemblyTemplateResponse:
        async with in_transaction():
            template = await AssemblyTemplate.get_or_none(
                id=template_id, tenant_id=tenant_id, deleted_at__isnull=True
            )
            if not template:
                raise NotFoundError(f"组装模板不存在: {template_id}")

            preview_lines = await self._resolve_bom_lines(
                tenant_id,
                template.product_material_id,
                template.base_quantity,
            )
            item_creates = [
                AssemblyTemplateItemCreate(
                    material_id=line.material_id,
                    material_code=line.material_code,
                    material_name=line.material_name,
                    quantity_per_base=line.quantity_per_base,
                    unit_price=Decimal("0"),
                    sequence=idx,
                )
                for idx, line in enumerate(preview_lines)
            ]
            await self._replace_template_items(tenant_id, template_id, item_creates)

            user_info = await self.get_user_info(updated_by)
            template.source_type = "bom"
            template.total_items = len(item_creates)
            template.updated_by = updated_by
            template.updated_by_name = user_info["name"]
            await template.save()

            return await self._build_response(template)

    async def create_template_item(
        self,
        tenant_id: int,
        template_id: int,
        item_data: AssemblyTemplateItemCreateInput,
        created_by: int,
    ) -> AssemblyTemplateItemResponse:
        async with in_transaction():
            template = await AssemblyTemplate.get_or_none(
                id=template_id, tenant_id=tenant_id, deleted_at__isnull=True
            )
            if not template:
                raise NotFoundError(f"组装模板不存在: {template_id}")

            item = await AssemblyTemplateItem.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                template_id=template_id,
                sequence=item_data.sequence,
                material_id=item_data.material_id,
                material_code=item_data.material_code,
                material_name=item_data.material_name,
                quantity_per_base=item_data.quantity_per_base,
                unit_price=item_data.unit_price or Decimal("0"),
                remarks=item_data.remarks,
            )
            template.total_items = await AssemblyTemplateItem.filter(
                tenant_id=tenant_id, template_id=template_id, deleted_at__isnull=True
            ).count()
            user_info = await self.get_user_info(created_by)
            template.updated_by = created_by
            template.updated_by_name = user_info["name"]
            template.source_type = "manual"
            await template.save()

            return AssemblyTemplateItemResponse(
                id=item.id,
                template_id=template_id,
                material_id=item.material_id,
                material_code=item.material_code,
                material_name=item.material_name,
                quantity_per_base=item.quantity_per_base,
                unit_price=item.unit_price,
                sequence=item.sequence,
                remarks=item.remarks,
                created_at=item.created_at,
                updated_at=item.updated_at,
            )

    async def update_template_item(
        self,
        tenant_id: int,
        template_id: int,
        item_id: int,
        item_data: AssemblyTemplateItemUpdate,
        updated_by: int,
    ) -> AssemblyTemplateItemResponse:
        item = await AssemblyTemplateItem.get_or_none(
            id=item_id, tenant_id=tenant_id, template_id=template_id, deleted_at__isnull=True
        )
        if not item:
            raise NotFoundError(f"模板明细不存在: {item_id}")

        for field, value in item_data.model_dump(exclude_unset=True).items():
            setattr(item, field, value)
        await item.save()

        template = await AssemblyTemplate.get(id=template_id, tenant_id=tenant_id)
        user_info = await self.get_user_info(updated_by)
        template.updated_by = updated_by
        template.updated_by_name = user_info["name"]
        template.source_type = "manual"
        await template.save()

        return AssemblyTemplateItemResponse(
            id=item.id,
            template_id=template_id,
            material_id=item.material_id,
            material_code=item.material_code,
            material_name=item.material_name,
            quantity_per_base=item.quantity_per_base,
            unit_price=item.unit_price,
            sequence=item.sequence,
            remarks=item.remarks,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )

    async def delete_template_item(
        self, tenant_id: int, template_id: int, item_id: int, updated_by: int
    ) -> bool:
        item = await AssemblyTemplateItem.get_or_none(
            id=item_id, tenant_id=tenant_id, template_id=template_id, deleted_at__isnull=True
        )
        if not item:
            raise NotFoundError(f"模板明细不存在: {item_id}")
        item.deleted_at = datetime.now()
        await item.save(update_fields=["deleted_at"])

        template = await AssemblyTemplate.get(id=template_id, tenant_id=tenant_id)
        template.total_items = await AssemblyTemplateItem.filter(
            tenant_id=tenant_id, template_id=template_id, deleted_at__isnull=True
        ).count()
        user_info = await self.get_user_info(updated_by)
        template.updated_by = updated_by
        template.updated_by_name = user_info["name"]
        await template.save()
        return True

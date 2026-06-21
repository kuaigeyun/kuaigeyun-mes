"""
物料批号服务模块

提供物料批号的业务逻辑处理，包括批号生成、CRUD、追溯等功能。

Author: Luigi Lu
Date: 2026-01-27
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, date
from decimal import Decimal
from tortoise.expressions import Q

from apps.master_data.models.material_batch import MaterialBatch
from apps.master_data.models.material import Material
from apps.master_data.schemas.material_schemas import (
    MaterialBatchCreate,
    MaterialBatchUpdate,
    MaterialBatchResponse,
    MaterialBatchListResponse,
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class MaterialBatchService:
    """
    物料批号服务类
    
    提供物料批号的 CRUD 操作和批号生成、追溯功能。
    """

    @staticmethod
    def _to_response(batch: MaterialBatch) -> MaterialBatchResponse:
        material = batch.material
        if not material:
            raise ValueError(f"物料批号 {batch.id} 关联物料不存在")
        return MaterialBatchResponse(
            id=batch.id,
            uuid=batch.uuid,
            tenant_id=batch.tenant_id,
            material_id=batch.material_id,
            material_uuid=material.uuid,
            material_name=material.name,
            material_code=material.main_code,
            material_model=material.model,
            batch_no=batch.batch_no,
            production_date=batch.production_date,
            expiry_date=batch.expiry_date,
            supplier_batch_no=batch.supplier_batch_no,
            quantity=batch.quantity or Decimal(0),
            status=batch.status,
            remark=batch.remark,
            created_at=batch.created_at,
            updated_at=batch.updated_at,
            deleted_at=batch.deleted_at,
        )
    
    @staticmethod
    async def create_batch(
        tenant_id: int,
        data: MaterialBatchCreate
    ) -> MaterialBatchResponse:
        """
        创建物料批号
        
        Args:
            tenant_id: 租户ID
            data: 批号创建数据
            
        Returns:
            MaterialBatchResponse: 创建的批号对象
            
        Raises:
            NotFoundError: 当物料不存在时抛出
            ValidationError: 当批号已存在时抛出
        """
        # 验证物料是否存在
        material = await Material.filter(
            tenant_id=tenant_id,
            uuid=data.material_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not material:
            raise NotFoundError("物料", data.material_uuid)
        
        # 检查批号是否已存在（同一物料下唯一）
        existing = await MaterialBatch.filter(
            tenant_id=tenant_id,
            material_id=material.id,
            batch_no=data.batch_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"物料 {material.name} 的批号 {data.batch_no} 已存在")
        
        production_date = data.production_date
        # 创建批号
        batch = await MaterialBatch.create(
            tenant_id=tenant_id,
            material_id=material.id,
            batch_no=data.batch_no,
            production_date=production_date,
            expiry_date=data.expiry_date,
            supplier_batch_no=data.supplier_batch_no,
            quantity=data.quantity,
            status=data.status,
            remark=data.remark,
        )
        
        # 加载关联数据
        await batch.fetch_related("material")
        
        return MaterialBatchService._to_response(batch)
    
    @staticmethod
    async def get_batch_by_uuid(
        tenant_id: int,
        batch_uuid: str
    ) -> MaterialBatchResponse:
        """
        根据UUID获取批号
        
        Args:
            tenant_id: 租户ID
            batch_uuid: 批号UUID
            
        Returns:
            MaterialBatchResponse: 批号对象
            
        Raises:
            NotFoundError: 当批号不存在时抛出
        """
        batch = await MaterialBatch.filter(
            tenant_id=tenant_id,
            uuid=batch_uuid,
            deleted_at__isnull=True
        ).prefetch_related("material").first()
        
        if not batch:
            raise NotFoundError("物料批号", batch_uuid)
        
        return MaterialBatchService._to_response(batch)
    
    @staticmethod
    async def list_batches(
        tenant_id: int,
        material_uuid: Optional[str] = None,
        batch_no: Optional[str] = None,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
        keyword: Optional[str] = None,
        sort_by: Optional[str] = None,
        sort_order: Optional[str] = None,
    ) -> MaterialBatchListResponse:
        """
        获取批号列表
        
        Args:
            tenant_id: 租户ID
            material_uuid: 物料UUID（可选，筛选条件）
            batch_no: 批号（可选，模糊搜索）
            status: 状态（可选，筛选条件）
            page: 页码（默认：1）
            page_size: 每页数量（默认：20）
            
        Returns:
            MaterialBatchListResponse: 批号列表响应
        """
        query = MaterialBatch.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            material__deleted_at__isnull=True,
        )
        
        # 物料筛选
        if material_uuid:
            material = await Material.filter(
                tenant_id=tenant_id,
                uuid=material_uuid,
                deleted_at__isnull=True
            ).first()
            if material:
                query = query.filter(material_id=material.id)
        
        # 批号模糊搜索
        if batch_no:
            query = query.filter(batch_no__icontains=batch_no)

        # 综合关键词（批号、供应商批号、物料名称/编码/型号）
        if keyword and keyword.strip():
            kw = keyword.strip()
            query = query.filter(
                Q(batch_no__icontains=kw)
                | Q(supplier_batch_no__icontains=kw)
                | Q(material__name__icontains=kw)
                | Q(material__main_code__icontains=kw)
                | Q(material__model__icontains=kw)
            )
        
        # 状态筛选
        if status:
            query = query.filter(status=status)
        
        # 总数
        total = await query.count()

        sort_field_map = {
            "batch_no": "batch_no",
            "quantity": "quantity",
            "status": "status",
            "production_date": "production_date",
            "expiry_date": "expiry_date",
            "created_at": "created_at",
            "material_name": "material__name",
            "material_code": "material__main_code",
            "material_model": "material__model",
        }
        db_sort = sort_field_map.get(sort_by or "", "created_at")
        desc = (sort_order or "desc").lower() == "desc"
        order_expr = f"-{db_sort}" if desc else db_sort
        
        # 分页查询
        batches = await query.prefetch_related("material").offset(
            (page - 1) * page_size
        ).limit(page_size).order_by(order_expr).all()
        
        items = [MaterialBatchService._to_response(batch) for batch in batches]
        
        return MaterialBatchListResponse(items=items, total=total)
    
    @staticmethod
    async def update_batch(
        tenant_id: int,
        batch_uuid: str,
        data: MaterialBatchUpdate
    ) -> MaterialBatchResponse:
        """
        更新批号
        
        Args:
            tenant_id: 租户ID
            batch_uuid: 批号UUID
            data: 批号更新数据
            
        Returns:
            MaterialBatchResponse: 更新后的批号对象
            
        Raises:
            NotFoundError: 当批号不存在时抛出
        """
        batch = await MaterialBatch.filter(
            tenant_id=tenant_id,
            uuid=batch_uuid,
            deleted_at__isnull=True
        ).prefetch_related("material").first()
        
        if not batch:
            raise NotFoundError("物料批号", batch_uuid)
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(batch, key, value)
        
        await batch.save()
        await batch.fetch_related("material")
        
        return MaterialBatchService._to_response(batch)
    
    @staticmethod
    async def delete_batch(
        tenant_id: int,
        batch_uuid: str
    ) -> None:
        """
        删除批号（软删除）
        
        Args:
            tenant_id: 租户ID
            batch_uuid: 批号UUID
            
        Raises:
            NotFoundError: 当批号不存在时抛出
        """
        batch = await MaterialBatch.filter(
            tenant_id=tenant_id,
            uuid=batch_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not batch:
            raise NotFoundError("物料批号", batch_uuid)
        
        # 软删除
        batch.deleted_at = datetime.utcnow()
        await batch.save()
    
    @staticmethod
    async def generate_batch_no(
        tenant_id: int,
        material_uuid: str,
        rule_id: Optional[int] = None,
        rule_uuid: Optional[str] = None,
        supplier_code: Optional[str] = None,
        *,
        preview: bool = False,
        preview_offset: int = 0,
    ) -> str:
        """
        生成批号

        优先使用规则：rule_id/rule_uuid > 物料默认批号规则 > 系统默认(YYYYMMDD-序号)

        Args:
            tenant_id: 租户ID
            material_uuid: 物料UUID
            rule_id: 批号规则ID（可选）
            rule_uuid: 批号规则UUID（可选）
            supplier_code: 供应商编码（可选，用于规则变量）
            preview: 为 True 时不占用流水号，仅用于界面预览
            preview_offset: 预览时同一单据内多行同物料递增值（0,1,2…）

        Returns:
            str: 生成的批号
        """
        from core.services.business.batch_rule_service import BatchRuleService

        material = await Material.filter(
            tenant_id=tenant_id,
            uuid=material_uuid,
            deleted_at__isnull=True
        ).prefetch_related("default_batch_rule").first()

        if not material:
            raise NotFoundError("物料", material_uuid)

        material_code = material.main_code or material.code or ""
        context = {
            "material_code": material_code,
            "group_code": getattr(material.group, "code", "") if material.group_id else "",
            "supplier_code": supplier_code or "",
        }

        batch_rule = None
        if rule_id:
            batch_rule = await BatchRuleService.get_rule_by_id(tenant_id, rule_id)
        elif rule_uuid:
            batch_rule = await BatchRuleService.get_rule_by_uuid(tenant_id, rule_uuid)
        elif getattr(material, "default_batch_rule_id", None) and material.default_batch_rule:
            batch_rule = material.default_batch_rule

        if batch_rule:
            return await BatchRuleService.generate_by_rule(
                tenant_id=tenant_id,
                rule=batch_rule,
                context=context,
                scope_key="",  # 全局自增，避免不同物料产生相同的如 -001 批号
                preview=preview,
                preview_offset=preview_offset,
            )

        # 使用系统默认批号规则（未配置时）
        default_rule = await BatchRuleService.get_or_create_system_default(tenant_id)
        return await BatchRuleService.generate_by_rule(
            tenant_id=tenant_id,
            rule=default_rule,
            context=context,
            scope_key="",  # 全局自增
            preview=preview,
            preview_offset=preview_offset,
        )
    
    @staticmethod
    async def trace_batch(
        tenant_id: int,
        batch_uuid: str
    ) -> Dict[str, Any]:
        """
        批号追溯
        
        查询批号的完整流转历史（入库→出库→生产→销售）
        
        Args:
            tenant_id: 租户ID
            batch_uuid: 批号UUID
            
        Returns:
            Dict[str, Any]: 追溯信息
            
        Raises:
            NotFoundError: 当批号不存在时抛出
        """
        from apps.kuaizhizao.services.traceability import TraceabilityService

        profile = await TraceabilityService().build_profile_by_batch_uuid(tenant_id, batch_uuid, "both")
        batch = await MaterialBatch.filter(
            tenant_id=tenant_id,
            uuid=batch_uuid,
            deleted_at__isnull=True,
        ).prefetch_related("material").first()
        if not batch:
            raise NotFoundError("物料批号", batch_uuid)

        return {
            "batch": MaterialBatchService._to_response(batch).model_dump(by_alias=True),
            "profile": profile.model_dump(by_alias=True),
            "inbound_records": [
                e.model_dump(by_alias=True)
                for e in profile.events
                if e.document_type
                in (
                    "purchase_receipt",
                    "customer_material_registration",
                    "finished_goods_receipt",
                    "semi_finished_goods_receipt",
                    "sales_return",
                )
            ],
            "outbound_records": [
                e.model_dump(by_alias=True)
                for e in profile.events
                if e.document_type == "sales_delivery"
            ],
            "production_records": [
                e.model_dump(by_alias=True)
                for e in profile.events
                if e.document_type in ("work_order", "reporting_record", "material_binding")
            ],
            "sales_records": [
                e.model_dump(by_alias=True)
                for e in profile.events
                if e.document_type in ("sales_delivery", "sales_return")
            ],
        }

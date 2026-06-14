"""
物料序列号服务模块

提供物料序列号的业务逻辑处理，包括序列号生成、CRUD、追溯等功能。

Author: Luigi Lu
Date: 2026-01-27
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, date
from tortoise.expressions import Q

from apps.master_data.models.material_serial import MaterialSerial
from apps.master_data.models.material import Material
from apps.master_data.schemas.material_schemas import (
    MaterialSerialCreate,
    MaterialSerialUpdate,
    MaterialSerialResponse,
    MaterialSerialListResponse,
)
from infra.exceptions.exceptions import NotFoundError, ValidationError
from loguru import logger


class MaterialSerialService:
    """
    物料序列号服务类
    
    提供物料序列号的 CRUD 操作和序列号生成、追溯功能。
    """
    
    @staticmethod
    def _to_response(serial: MaterialSerial) -> MaterialSerialResponse:
        material = getattr(serial, "material", None)
        material_uuid = getattr(material, "uuid", "") if material else ""
        material_name = getattr(material, "name", None) if material else None
        return MaterialSerialResponse(
            id=serial.id,
            uuid=serial.uuid,
            tenant_id=serial.tenant_id,
            material_id=serial.material_id,
            material_uuid=material_uuid,
            material_name=material_name,
            serial_no=serial.serial_no,
            production_date=serial.production_date,
            factory_date=serial.factory_date,
            supplier_serial_no=serial.supplier_serial_no,
            status=serial.status,
            remark=serial.remark,
            created_at=serial.created_at,
            updated_at=serial.updated_at,
            deleted_at=serial.deleted_at,
        )

    @staticmethod
    async def create_serial(
        tenant_id: int,
        data: MaterialSerialCreate
    ) -> MaterialSerialResponse:
        """
        创建物料序列号
        
        Args:
            tenant_id: 租户ID
            data: 序列号创建数据
            
        Returns:
            MaterialSerialResponse: 创建的序列号对象
            
        Raises:
            NotFoundError: 当物料不存在时抛出
            ValidationError: 当序列号已存在时抛出
        """
        # 验证物料是否存在
        material = await Material.filter(
            tenant_id=tenant_id,
            uuid=data.material_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not material:
            raise NotFoundError("物料", data.material_uuid)
        
        # 检查序列号是否已存在（全局唯一）
        existing = await MaterialSerial.filter(
            tenant_id=tenant_id,
            serial_no=data.serial_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"序列号 {data.serial_no} 已存在")
        
        # 创建序列号
        serial = await MaterialSerial.create(
            tenant_id=tenant_id,
            material_id=material.id,
            serial_no=data.serial_no,
            production_date=data.production_date,
            factory_date=data.factory_date,
            supplier_serial_no=data.supplier_serial_no,
            status=data.status,
            remark=data.remark,
        )
        
        # 加载关联数据
        await serial.fetch_related("material")
        
        return MaterialSerialService._to_response(serial)
    
    @staticmethod
    async def get_serial_by_uuid(
        tenant_id: int,
        serial_uuid: str
    ) -> MaterialSerialResponse:
        """
        根据UUID获取序列号
        
        Args:
            tenant_id: 租户ID
            serial_uuid: 序列号UUID
            
        Returns:
            MaterialSerialResponse: 序列号对象
            
        Raises:
            NotFoundError: 当序列号不存在时抛出
        """
        serial = await MaterialSerial.filter(
            tenant_id=tenant_id,
            uuid=serial_uuid,
            deleted_at__isnull=True
        ).prefetch_related("material").first()
        
        if not serial:
            raise NotFoundError("物料序列号", serial_uuid)
        
        return MaterialSerialService._to_response(serial)
    
    @staticmethod
    async def list_serials(
        tenant_id: int,
        material_uuid: Optional[str] = None,
        serial_no: Optional[str] = None,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
        keyword: Optional[str] = None,
        sort_by: Optional[str] = None,
        sort_order: Optional[str] = None,
    ) -> MaterialSerialListResponse:
        """
        获取序列号列表
        
        Args:
            tenant_id: 租户ID
            material_uuid: 物料UUID（可选，筛选条件）
            serial_no: 序列号（可选，模糊搜索）
            status: 状态（可选，筛选条件）
            page: 页码（默认：1）
            page_size: 每页数量（默认：20）
            
        Returns:
            MaterialSerialListResponse: 序列号列表响应
        """
        query = MaterialSerial.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
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
        
        # 序列号模糊搜索
        if serial_no:
            query = query.filter(serial_no__icontains=serial_no)

        if keyword and keyword.strip():
            kw = keyword.strip()
            query = query.filter(
                Q(serial_no__icontains=kw)
                | Q(supplier_serial_no__icontains=kw)
                | Q(material__name__icontains=kw)
            )
        
        # 状态筛选
        if status:
            query = query.filter(status=status)
        
        # 总数
        total = await query.count()

        sort_field_map = {
            "serial_no": "serial_no",
            "status": "status",
            "production_date": "production_date",
            "factory_date": "factory_date",
            "created_at": "created_at",
            "material_name": "material__name",
        }
        db_sort = sort_field_map.get(sort_by or "", "created_at")
        desc = (sort_order or "desc").lower() == "desc"
        order_expr = f"-{db_sort}" if desc else db_sort
        
        # 分页查询
        serials = await query.prefetch_related("material").offset(
            (page - 1) * page_size
        ).limit(page_size).order_by(order_expr).all()
        
        items = []
        for serial in serials:
            try:
                # 处理历史孤立数据：若关联物料已不存在，跳过该序列号，避免整页报错
                if not serial.material:
                    logger.warning(f"跳过孤立的物料序列号: id={serial.id}, material_id={serial.material_id} (物料不存在)")
                    continue
                items.append(MaterialSerialService._to_response(serial))
            except Exception as e:
                logger.error(f"序列化物料序列号 {serial.id} 失败: {str(e)}")
                continue
        
        return MaterialSerialListResponse(items=items, total=total)
    
    @staticmethod
    async def update_serial(
        tenant_id: int,
        serial_uuid: str,
        data: MaterialSerialUpdate
    ) -> MaterialSerialResponse:
        """
        更新序列号
        
        Args:
            tenant_id: 租户ID
            serial_uuid: 序列号UUID
            data: 序列号更新数据
            
        Returns:
            MaterialSerialResponse: 更新后的序列号对象
            
        Raises:
            NotFoundError: 当序列号不存在时抛出
        """
        serial = await MaterialSerial.filter(
            tenant_id=tenant_id,
            uuid=serial_uuid,
            deleted_at__isnull=True
        ).prefetch_related("material").first()
        
        if not serial:
            raise NotFoundError("物料序列号", serial_uuid)
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(serial, key, value)
        
        await serial.save()
        
        return MaterialSerialService._to_response(serial)
    
    @staticmethod
    async def delete_serial(
        tenant_id: int,
        serial_uuid: str
    ) -> None:
        """
        删除序列号（软删除）
        
        Args:
            tenant_id: 租户ID
            serial_uuid: 序列号UUID
            
        Raises:
            NotFoundError: 当序列号不存在时抛出
        """
        serial = await MaterialSerial.filter(
            tenant_id=tenant_id,
            uuid=serial_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not serial:
            raise NotFoundError("物料序列号", serial_uuid)
        
        # 软删除
        serial.deleted_at = datetime.utcnow()
        await serial.save()
    
    @staticmethod
    async def generate_serial_no(
        tenant_id: int,
        material_uuid: str,
        count: int = 1,
        rule_id: Optional[int] = None,
        rule_uuid: Optional[str] = None,
    ) -> List[str]:
        """
        生成序列号（批量生成）

        优先使用规则：rule_id/rule_uuid > 物料默认序列号规则 > 系统默认

        Args:
            tenant_id: 租户ID
            material_uuid: 物料UUID
            count: 生成数量（默认：1）
            rule_id: 序列号规则ID（可选）
            rule_uuid: 序列号规则UUID（可选）

        Returns:
            List[str]: 生成的序列号列表
        """
        from core.services.business.serial_rule_service import SerialRuleService

        material = await Material.filter(
            tenant_id=tenant_id,
            uuid=material_uuid,
            deleted_at__isnull=True
        ).prefetch_related("default_serial_rule").first()

        if not material:
            raise NotFoundError("物料", material_uuid)

        material_code = material.main_code or material.code or ""
        context = {
            "material_code": material_code,
            "group_code": getattr(material.group, "code", "") if material.group_id else "",
        }

        serial_rule = None
        if rule_id:
            serial_rule = await SerialRuleService.get_rule_by_id(tenant_id, rule_id)
        elif rule_uuid:
            serial_rule = await SerialRuleService.get_rule_by_uuid(tenant_id, rule_uuid)
        elif getattr(material, "default_serial_rule_id", None) and material.default_serial_rule:
            serial_rule = material.default_serial_rule

        if serial_rule:
            return await SerialRuleService.generate_by_rule(
                tenant_id=tenant_id,
                rule=serial_rule,
                context=context,
                scope_key="",  # 全局自增，避免不同物料产生相同的序列号
                count=count,
            )

        # 使用系统默认序列号规则（未配置时）
        default_rule = await SerialRuleService.get_or_create_system_default(tenant_id)
        return await SerialRuleService.generate_by_rule(
            tenant_id=tenant_id,
            rule=default_rule,
            context=context,
            scope_key="",  # 全局自增
            count=count,
        )
    
    @staticmethod
    async def trace_serial(
        tenant_id: int,
        serial_uuid: str
    ) -> Dict[str, Any]:
        """
        序列号追溯
        
        查询序列号的完整生命周期（生产→入库→出库→销售→售后）
        
        Args:
            tenant_id: 租户ID
            serial_uuid: 序列号UUID
            
        Returns:
            Dict[str, Any]: 追溯信息
            
        Raises:
            NotFoundError: 当序列号不存在时抛出
        """
        serial = await MaterialSerial.filter(
            tenant_id=tenant_id,
            uuid=serial_uuid,
            deleted_at__isnull=True
        ).prefetch_related("material").first()
        
        if not serial:
            raise NotFoundError("物料序列号", serial_uuid)
        
        # TODO: 后续实现完整的追溯逻辑
        # 需要查询：
        # 1. 生产记录（工单、生产入库单）
        # 2. 入库记录（库存入库单）
        # 3. 出库记录（库存出库单）
        # 4. 销售记录（销售订单、销售出库单）
        # 5. 售后记录（售后单、退货单）
        
        trace_info = {
            "serial": MaterialSerialService._to_response(serial).dict(),
            "production_records": [],  # 生产记录
            "inbound_records": [],  # 入库记录
            "outbound_records": [],  # 出库记录
            "sales_records": [],  # 销售记录
            "after_sales_records": [],  # 售后记录
        }
        
        return trace_info

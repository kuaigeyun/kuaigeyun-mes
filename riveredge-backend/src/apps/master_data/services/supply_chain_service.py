"""
供应链数据服务模块

提供供应链数据的业务逻辑处理（客户、供应商），支持多组织隔离。
"""

from typing import Any, Dict, List, Optional, Tuple
from tortoise.exceptions import IntegrityError

from tortoise.expressions import Q
from tortoise import timezone
from apps.master_data.models.customer import Customer
from apps.master_data.models.supplier import Supplier
from apps.master_data.schemas.supply_chain_schemas import (
    CustomerContactItem,
    CustomerCreate,
    CustomerUpdate,
    CustomerResponse,
    SupplierCreate,
    SupplierUpdate,
    SupplierResponse,
)
from core.services.authorization.data_scope_service import DataScopeService
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User

RESOURCE_SUPPLIER = "master-data:supply-chain:supplier"


def _pick_contact_field(row: Dict[str, Any], *keys: str) -> Optional[str]:
    for key in keys:
        val = row.get(key)
        if val is not None and str(val).strip():
            return str(val).strip()
    return None


def _normalize_partner_contact_row(row: Any) -> Optional[Dict[str, Optional[str]]]:
    if not isinstance(row, dict):
        return None
    contact_person = _pick_contact_field(row, "contact_person", "contactPerson")
    contact_title = _pick_contact_field(row, "contact_title", "contactTitle")
    phone = _pick_contact_field(row, "phone")
    email = _pick_contact_field(row, "email")
    if not any([contact_person, contact_title, phone, email]):
        return None
    return {
        "contact_person": contact_person,
        "contact_title": contact_title,
        "phone": phone,
        "email": email,
    }


def _apply_partner_contacts_payload(data: Dict[str, Any]) -> None:
    """将 contacts 明细写入 payload，并同步首条至 legacy 单联系人字段。"""
    if "contacts" not in data:
        legacy = _normalize_partner_contact_row(
            {
                "contact_person": data.get("contact_person"),
                "contact_title": data.get("contact_title"),
                "phone": data.get("phone"),
                "email": data.get("email"),
            }
        )
        if legacy:
            data["contacts"] = [legacy]
        return

    raw_contacts = data.get("contacts")
    normalized: List[Dict[str, Optional[str]]] = []
    if isinstance(raw_contacts, list):
        for row in raw_contacts:
            item = _normalize_partner_contact_row(row)
            if item:
                normalized.append(item)

    data["contacts"] = normalized
    if normalized:
        first = normalized[0]
        data["contact_person"] = first.get("contact_person")
        data["contact_title"] = first.get("contact_title")
        data["phone"] = first.get("phone")
        data["email"] = first.get("email")
    else:
        data["contact_person"] = None
        data["contact_title"] = None
        data["phone"] = None
        data["email"] = None


def _partner_contacts_for_response(entity: Customer | Supplier) -> List[Dict[str, Optional[str]]]:
    stored = entity.contacts
    if isinstance(stored, list) and stored:
        rows: List[Dict[str, Optional[str]]] = []
        for row in stored:
            item = _normalize_partner_contact_row(row)
            if item:
                rows.append(item)
        if rows:
            return rows
    legacy = _normalize_partner_contact_row(
        {
            "contact_person": entity.contact_person,
            "contact_title": entity.contact_title,
            "phone": entity.phone,
            "email": entity.email,
        }
    )
    return [legacy] if legacy else []


def _to_customer_response(customer: Customer) -> CustomerResponse:
    resp = CustomerResponse.model_validate(customer)
    contact_rows = _partner_contacts_for_response(customer)
    contact_items = [CustomerContactItem.model_validate(row) for row in contact_rows] if contact_rows else None
    return resp.model_copy(update={"contacts": contact_items})


def _to_supplier_response(supplier: Supplier) -> SupplierResponse:
    resp = SupplierResponse.model_validate(supplier)
    contact_rows = _partner_contacts_for_response(supplier)
    contact_items = [CustomerContactItem.model_validate(row) for row in contact_rows] if contact_rows else None
    return resp.model_copy(update={"contacts": contact_items})


class SupplyChainService:
    """供应链数据服务"""
    
    # ==================== 客户相关方法 ====================
    
    @staticmethod
    async def create_customer(
        tenant_id: int,
        data: CustomerCreate
    ) -> CustomerResponse:
        """
        创建客户
        
        Args:
            tenant_id: 租户ID
            data: 客户创建数据
            
        Returns:
            CustomerResponse: 创建的客户对象
            
        Raises:
            ValidationError: 当编码已存在时抛出
        """
        # 检查编码是否已存在
        existing = await Customer.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"客户编码 {data.code} 已存在")
        
        # 创建客户（未传 is_active 时默认为启用）
        create_data = data.model_dump(by_alias=False) if hasattr(data, "model_dump") else data.dict()
        if create_data.get("is_active") is None:
            create_data["is_active"] = True
        if create_data.get("is_public") is None:
            create_data["is_public"] = False
        if create_data.get("salesman_id"):
            create_data["pool_status"] = "owned"
            create_data["assigned_at"] = timezone.now()
        else:
            create_data["pool_status"] = create_data.get("pool_status") or "pool"
            if create_data["pool_status"] == "pool":
                create_data["assigned_at"] = None
                create_data["recycle_at"] = None
        # 自动回填业务员姓名
        if create_data.get("salesman_id"):
            salesman = await User.filter(id=create_data["salesman_id"]).first()
            if salesman:
                create_data["salesman_name"] = salesman.full_name or salesman.username

        _apply_partner_contacts_payload(create_data)
        
        try:
            customer = await Customer.create(
                tenant_id=tenant_id,
                **create_data
            )
        except IntegrityError as e:
            # 捕获数据库唯一约束错误，提供友好提示
            if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                raise ValidationError(f"客户编码 {data.code} 已存在（可能已被软删除，请检查）")
            raise
        
        return _to_customer_response(customer)
    
    @staticmethod
    async def get_customer_by_uuid(
        tenant_id: int,
        customer_uuid: str
    ) -> CustomerResponse:
        """
        根据UUID获取客户
        
        Args:
            tenant_id: 租户ID
            customer_uuid: 客户UUID
            
        Returns:
            CustomerResponse: 客户对象
            
        Raises:
            NotFoundError: 当客户不存在时抛出
        """
        customer = await Customer.filter(
            tenant_id=tenant_id,
            uuid=customer_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not customer:
            raise NotFoundError(f"客户 {customer_uuid} 不存在")
        
        return _to_customer_response(customer)
    
    @staticmethod
    async def list_customers(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        category: Optional[str] = None,
        is_active: Optional[bool] = None,
        keyword: Optional[str] = None,
        salesman_id: Optional[int] = None,
        sort_by: Optional[str] = None,
        sort_order: Optional[str] = None,
        current_user: Optional[User] = None,
    ) -> Tuple[List[CustomerResponse], int]:
        """
        获取客户列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            category: 客户分类（可选，用于过滤）
            is_active: 是否启用（可选）
            keyword: 搜索关键词（编号、名称、简称、联系人、电话、邮箱）
            salesman_id: 归属业务员（可选）
            sort_by / sort_order: 排序字段与方向（asc/desc）
            current_user: 当前用户（用于数据隔离）
            
        Returns:
            (客户列表, 总条数)
        """
        query = Customer.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if category is not None:
            query = query.filter(category=category)
        
        if is_active is not None:
            query = query.filter(is_active=is_active)

        if salesman_id is not None:
            query = query.filter(salesman_id=salesman_id)

        if keyword and keyword.strip():
            kw = keyword.strip()
            query = query.filter(
                Q(code__icontains=kw)
                | Q(name__icontains=kw)
                | Q(short_name__icontains=kw)
                | Q(contact_person__icontains=kw)
                | Q(phone__icontains=kw)
                | Q(email__icontains=kw)
                | Q(tax_registration_no__icontains=kw)
                | Q(invoice_title__icontains=kw)
            )

        # 业务员数据隔离：普通用户只能看到自己负责的客户 + 公共客户
        if current_user and current_user.is_regular_user():
            query = query.filter(Q(salesman_id=current_user.id) | Q(pool_status="pool"))

        total = await query.count()
        allowed_sort = {"code", "name", "category", "created_at", "is_active", "salesman_name", "short_name"}
        field = sort_by if sort_by in allowed_sort else "code"
        desc = (sort_order or "asc").lower() == "desc"
        order_expr = f"-{field}" if desc else field

        customers = await query.offset(skip).limit(limit).order_by(order_expr).all()

        return [_to_customer_response(c) for c in customers], total
    
    @staticmethod
    async def update_customer(
        tenant_id: int,
        customer_uuid: str,
        data: CustomerUpdate
    ) -> CustomerResponse:
        """
        更新客户
        
        Args:
            tenant_id: 租户ID
            customer_uuid: 客户UUID
            data: 客户更新数据
            
        Returns:
            CustomerResponse: 更新后的客户对象
            
        Raises:
            NotFoundError: 当客户不存在时抛出
            ValidationError: 当编码已存在时抛出
        """
        customer = await Customer.filter(
            tenant_id=tenant_id,
            uuid=customer_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not customer:
            raise NotFoundError(f"客户 {customer_uuid} 不存在")
        
        # 如果更新编码，检查是否已存在
        if data.code and data.code != customer.code:
            existing = await Customer.filter(
                tenant_id=tenant_id,
                code=data.code,
                deleted_at__isnull=True
            ).first()
            
            if existing:
                raise ValidationError(f"客户编码 {data.code} 已存在")
        
        # 更新字段（by_alias=False 得到 snake_case 供 ORM 使用）
        update_data = data.model_dump(exclude_unset=True, by_alias=False) if hasattr(data, "model_dump") else data.dict(exclude_unset=True)
        now = timezone.now()

        if "salesman_id" in update_data:
            if update_data["salesman_id"]:
                update_data["pool_status"] = "owned"
                update_data["assigned_at"] = now
            else:
                update_data["pool_status"] = "pool"
                update_data["assigned_at"] = None
                update_data["recycle_at"] = None

        if update_data.get("pool_status") == "pool":
            update_data["salesman_id"] = None
            update_data["salesman_name"] = None
            update_data["assigned_at"] = None
            update_data["recycle_at"] = None

        _apply_partner_contacts_payload(update_data)

        for key, value in update_data.items():
            setattr(customer, key, value)
        
        # 自动回填业务员姓名
        if "salesman_id" in update_data:
            if update_data["salesman_id"]:
                salesman = await User.filter(id=update_data["salesman_id"]).first()
                if salesman:
                    customer.salesman_name = salesman.full_name or salesman.username
            else:
                customer.salesman_name = None

        try:
            await customer.save()
        except IntegrityError as e:
            # 捕获数据库唯一约束错误，提供友好提示
            if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                raise ValidationError(f"客户编码 {data.code or customer.code} 已存在（可能已被软删除，请检查）")
            raise
        
        return _to_customer_response(customer)
    
    @staticmethod
    async def delete_customer(
        tenant_id: int,
        customer_uuid: str
    ) -> None:
        """
        删除客户（软删除）
        
        Args:
            tenant_id: 租户ID
            customer_uuid: 客户UUID
            
        Raises:
            NotFoundError: 当客户不存在时抛出
        """
        customer = await Customer.filter(
            tenant_id=tenant_id,
            uuid=customer_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not customer:
            raise NotFoundError(f"客户 {customer_uuid} 不存在")
        
        # 软删除
        from tortoise import timezone
        customer.deleted_at = timezone.now()
        await customer.save()
    
    # ==================== 供应商相关方法 ====================
    
    @staticmethod
    async def create_supplier(
        tenant_id: int,
        data: SupplierCreate
    ) -> SupplierResponse:
        """
        创建供应商
        
        Args:
            tenant_id: 租户ID
            data: 供应商创建数据
            
        Returns:
            SupplierResponse: 创建的供应商对象
            
        Raises:
            ValidationError: 当编码已存在时抛出
        """
        # 检查编码是否已存在
        existing = await Supplier.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"供应商编码 {data.code} 已存在")
        
        # 创建供应商（未传 is_active 时默认为启用）
        create_data = data.model_dump(by_alias=False) if hasattr(data, "model_dump") else data.dict()
        if create_data.get("is_active") is None:
            create_data["is_active"] = True
        # 自动回填采购员姓名
        if create_data.get("buyer_id"):
            buyer = await User.filter(id=create_data["buyer_id"]).first()
            if buyer:
                create_data["buyer_name"] = buyer.full_name or buyer.username

        _apply_partner_contacts_payload(create_data)

        try:
            supplier = await Supplier.create(
                tenant_id=tenant_id,
                **create_data
            )
        except IntegrityError as e:
            # 捕获数据库唯一约束错误，提供友好提示
            if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                raise ValidationError(f"供应商编码 {data.code} 已存在（可能已被软删除，请检查）")
            raise
        
        return _to_supplier_response(supplier)
    
    @staticmethod
    async def get_supplier_by_uuid(
        tenant_id: int,
        supplier_uuid: str
    ) -> SupplierResponse:
        """
        根据UUID获取供应商
        
        Args:
            tenant_id: 租户ID
            supplier_uuid: 供应商UUID
            
        Returns:
            SupplierResponse: 供应商对象
            
        Raises:
            NotFoundError: 当供应商不存在时抛出
        """
        supplier = await Supplier.filter(
            tenant_id=tenant_id,
            uuid=supplier_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not supplier:
            raise NotFoundError(f"供应商 {supplier_uuid} 不存在")
        
        return _to_supplier_response(supplier)
    
    @staticmethod
    async def list_suppliers(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        category: Optional[str] = None,
        is_active: Optional[bool] = None,
        keyword: Optional[str] = None,
        code: Optional[str] = None,
        name: Optional[str] = None,
        buyer_id: Optional[int] = None,
        sort_by: Optional[str] = None,
        sort_order: Optional[str] = None,
        current_user: Optional[User] = None,
    ) -> Tuple[List[SupplierResponse], int]:
        """
        获取供应商列表

        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            category: 供应商分类（可选，用于过滤）
            is_active: 是否启用（可选）
            keyword: 搜索关键词（编码、名称、简称、联系人、电话、邮箱）
            code: 供应商编码（模糊）
            name: 供应商名称（模糊匹配）
            buyer_id: 归属采购员（可选）
            sort_by / sort_order: 排序
            current_user: 当前用户（用于数据隔离）

        Returns:
            (供应商列表, 总条数)
        """
        query = Supplier.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        if category is not None:
            query = query.filter(category=category)

        if is_active is not None:
            query = query.filter(is_active=is_active)

        if buyer_id is not None:
            query = query.filter(buyer_id=buyer_id)

        # 添加搜索条件
        if keyword and keyword.strip():
            kw = keyword.strip()
            query = query.filter(
                Q(code__icontains=kw)
                | Q(name__icontains=kw)
                | Q(short_name__icontains=kw)
                | Q(contact_person__icontains=kw)
                | Q(phone__icontains=kw)
                | Q(email__icontains=kw)
                | Q(tax_registration_no__icontains=kw)
                | Q(invoice_title__icontains=kw)
            )

        if code:
            # 精确匹配供应商编码
            query = query.filter(code__icontains=code)

        if name:
            # 模糊匹配供应商名称
            query = query.filter(name__icontains=name)

        if current_user:
            query = await DataScopeService.apply(
                query,
                tenant_id=tenant_id,
                user=current_user,
                resource=RESOURCE_SUPPLIER,
            )

        total = await query.count()
        allowed_sort = {"code", "name", "category", "created_at", "is_active", "buyer_name", "short_name"}
        field = sort_by if sort_by in allowed_sort else "code"
        desc = (sort_order or "asc").lower() == "desc"
        order_expr = f"-{field}" if desc else field

        suppliers = await query.offset(skip).limit(limit).order_by(order_expr).all()

        return [_to_supplier_response(s) for s in suppliers], total
    
    @staticmethod
    async def update_supplier(
        tenant_id: int,
        supplier_uuid: str,
        data: SupplierUpdate
    ) -> SupplierResponse:
        """
        更新供应商
        
        Args:
            tenant_id: 租户ID
            supplier_uuid: 供应商UUID
            data: 供应商更新数据
            
        Returns:
            SupplierResponse: 更新后的供应商对象
            
        Raises:
            NotFoundError: 当供应商不存在时抛出
            ValidationError: 当编码已存在时抛出
        """
        supplier = await Supplier.filter(
            tenant_id=tenant_id,
            uuid=supplier_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not supplier:
            raise NotFoundError(f"供应商 {supplier_uuid} 不存在")
        
        # 如果更新编码，检查是否已存在
        if data.code and data.code != supplier.code:
            existing = await Supplier.filter(
                tenant_id=tenant_id,
                code=data.code,
                deleted_at__isnull=True
            ).first()
            
            if existing:
                raise ValidationError(f"供应商编码 {data.code} 已存在")
        
        # 更新字段（by_alias=False 得到 snake_case 供 ORM 使用）
        update_data = data.model_dump(exclude_unset=True, by_alias=False) if hasattr(data, "model_dump") else data.dict(exclude_unset=True)

        _apply_partner_contacts_payload(update_data)

        for key, value in update_data.items():
            setattr(supplier, key, value)
        
        # 自动回填采购员姓名
        if "buyer_id" in update_data:
            if update_data["buyer_id"]:
                buyer = await User.filter(id=update_data["buyer_id"]).first()
                if buyer:
                    supplier.buyer_name = buyer.full_name or buyer.username
            else:
                supplier.buyer_name = None

        try:
            await supplier.save()
        except IntegrityError as e:
            # 捕获数据库唯一约束错误，提供友好提示
            if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                raise ValidationError(f"供应商编码 {data.code or supplier.code} 已存在（可能已被软删除，请检查）")
            raise
        
        return _to_supplier_response(supplier)
    
    @staticmethod
    async def delete_supplier(
        tenant_id: int,
        supplier_uuid: str
    ) -> None:
        """
        删除供应商（软删除）
        
        Args:
            tenant_id: 租户ID
            supplier_uuid: 供应商UUID
            
        Raises:
            NotFoundError: 当供应商不存在时抛出
        """
        supplier = await Supplier.filter(
            tenant_id=tenant_id,
            uuid=supplier_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not supplier:
            raise NotFoundError(f"供应商 {supplier_uuid} 不存在")
        
        # 软删除
        from tortoise import timezone
        supplier.deleted_at = timezone.now()
        await supplier.save()


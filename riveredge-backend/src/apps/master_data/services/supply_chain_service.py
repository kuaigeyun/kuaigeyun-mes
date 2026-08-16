"""
供应链数据服务模块

提供供应链数据的业务逻辑处理（客户、供应商），支持多组织隔离。
"""

from typing import Any, Dict, List, Optional, Tuple
from tortoise.exceptions import IntegrityError

from tortoise.expressions import Q
from tortoise import timezone
from apps.common.audit_actor import apply_create_audit, apply_update_audit
from apps.master_data.models.customer import Customer
from apps.master_data.models.supplier import Supplier
from apps.common.bulk_import import BulkCreateResponse, run_bulk_create
from apps.master_data.schemas.supply_chain_schemas import (
    CustomerContactItem,
    CustomerCreate,
    CustomerUpdate,
    CustomerResponse,
    SupplierCreate,
    SupplierUpdate,
    SupplierResponse,
)
from apps.kuaizhizao.services.customer_pool_service import CustomerPoolService
from core.services.authorization.data_scope_service import DataScopeService
from core.services.authorization.user_permission_service import UserPermissionService
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User

from apps.master_data.services.master_data_list_core import (
    apply_master_crud_created_date_range,
    apply_master_crud_updated_date_range,
    apply_master_crud_list_filters,
    resolve_master_crud_order_clause,
)

_CUSTOMER_SUPPLIER_KEYWORD_FIELDS = [
    "code",
    "name",
    "short_name",
    "contact_person",
    "phone",
    "email",
    "tax_registration_no",
    "invoice_title",
]

RESOURCE_SUPPLIER = "master-data:supply-chain:supplier"
RESOURCE_CUSTOMER = "master-data:supply-chain:customer"

CUSTOMER_POOL_MANAGED_FIELDS = frozenset(
    {
        "pool_status",
        "assigned_at",
        "recycle_at",
        "last_follow_up_at",
        "is_public",
        "salesman_name",
    }
)


def _strip_customer_pool_managed_fields(data: Dict[str, Any]) -> None:
    for key in CUSTOMER_POOL_MANAGED_FIELDS:
        data.pop(key, None)


def _normalize_partner_name(name: Optional[str]) -> str:
    """客户/供应商名称：去首尾空白。"""
    return str(name or "").strip()


async def _assert_customer_name_unique(
    tenant_id: int,
    name: str,
    *,
    exclude_uuid: Optional[str] = None,
) -> None:
    normalized = _normalize_partner_name(name)
    if not normalized:
        raise ValidationError("客户名称不能为空")
    query = Customer.filter(
        tenant_id=tenant_id,
        name=normalized,
        deleted_at__isnull=True,
    )
    if exclude_uuid:
        query = query.exclude(uuid=exclude_uuid)
    existing = await query.first()
    if existing:
        raise ValidationError(f"客户名称「{normalized}」已存在（编码 {existing.code}）")


async def _assert_supplier_name_unique(
    tenant_id: int,
    name: str,
    *,
    exclude_uuid: Optional[str] = None,
) -> None:
    normalized = _normalize_partner_name(name)
    if not normalized:
        raise ValidationError("供应商名称不能为空")
    query = Supplier.filter(
        tenant_id=tenant_id,
        name=normalized,
        deleted_at__isnull=True,
    )
    if exclude_uuid:
        query = query.exclude(uuid=exclude_uuid)
    existing = await query.first()
    if existing:
        raise ValidationError(f"供应商名称「{normalized}」已存在（编码 {existing.code}）")


async def _summarize_customer_blocking_documents(
    tenant_id: int,
    customer_id: int,
) -> Dict[str, Any]:
    """
    统计引用该客户的业务单据（未删除），用于删除守卫提示。
    """
    from core.services.document_tracking_service import (
        DOCUMENT_MODEL_REGISTRY,
        DOCUMENT_TYPE_LABEL_ZH,
    )

    items: List[Dict[str, Any]] = []
    total = 0

    for doc_type, (model, _) in DOCUMENT_MODEL_REGISTRY().items():
        fields_map = getattr(model, "_meta", None).fields_map if getattr(model, "_meta", None) else {}
        if "customer_id" not in fields_map:
            continue
        if "tenant_id" not in fields_map:
            continue

        query = model.filter(tenant_id=tenant_id, customer_id=customer_id)
        if doc_type == "sales_invoice":
            query = query.filter(category="OUT")
        if "deleted_at" in fields_map:
            query = query.filter(deleted_at__isnull=True)

        count = await query.count()
        if count <= 0:
            continue

        items.append(
            {
                "document_type": doc_type,
                "label": DOCUMENT_TYPE_LABEL_ZH.get(doc_type, doc_type),
                "count": count,
            }
        )
        total += count

    items.sort(key=lambda x: (-x["count"], x["label"]))
    return {"total": total, "items": items}


def _format_customer_delete_guard_message(customer_name: str, summary: Dict[str, Any]) -> str:
    items = summary.get("items") or []
    if not items:
        return f"客户「{customer_name}」存在业务单据，无法删除"

    top_items = items[:5]
    labels = [f"{item['label']}({item['count']})" for item in top_items]
    labels_text = "、".join(labels)
    if len(items) > 5:
        labels_text = f"{labels_text} 等"
    return f"客户「{customer_name}」存在业务单据（{labels_text}），无法删除。请先处理相关单据后再删除。"


async def _assert_can_assign_customer_ownership(user: User, tenant_id: int) -> None:
    if user.is_tenant_admin or user.is_infra_admin:
        return
    if await UserPermissionService.has_permission(
        user.id, tenant_id, "kuaizhizao:customer-pool:assign"
    ):
        return
    raise ValidationError("无权分配客户归属")


async def _assert_can_release_customer_ownership(user: User, tenant_id: int) -> None:
    if user.is_tenant_admin or user.is_infra_admin:
        return
    if await UserPermissionService.has_permission(
        user.id, tenant_id, "kuaizhizao:customer-pool:release"
    ):
        return
    raise ValidationError("无权释放客户归属")


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


_CUSTOMER_PAGE_CODE = "master-data-supply-chain-customer"
_SUPPLIER_PAGE_CODE = "master-data-supply-chain-supplier"


async def _resolve_partner_create_code(
    tenant_id: int,
    page_code: str,
    code: Optional[str],
) -> str:
    """创建客户/供应商时：已启用编码规则且未填编码则由服务端按已保存规则生成。"""
    from core.config.code_rule_pages import get_canonical_rule_code
    from core.services.business.code_generation_service import CodeGenerationService
    from core.services.business.code_rule_service import CodeRuleService

    trimmed = (code or "").strip()
    rule_code = get_canonical_rule_code(page_code)
    if not rule_code:
        if not trimmed:
            raise ValidationError("请填写编码")
        return trimmed
    rule = await CodeRuleService.get_rule_by_code(tenant_id, rule_code, active_only=True)
    if rule:
        if not trimmed:
            return await CodeGenerationService.generate_code(tenant_id, rule_code)
        return trimmed
    if not trimmed:
        raise ValidationError("请填写编码，或在「编码规则」中启用并保存该页面的自动编号")
    return trimmed


class SupplyChainService:
    """供应链数据服务"""
    
    # ==================== 客户相关方法 ====================
    
    @staticmethod
    async def create_customer(
        tenant_id: int,
        data: CustomerCreate,
        current_user: User,
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
        create_data = data.model_dump(by_alias=False) if hasattr(data, "model_dump") else data.dict()
        create_data["code"] = await _resolve_partner_create_code(
            tenant_id, _CUSTOMER_PAGE_CODE, create_data.get("code")
        )
        create_data["name"] = _normalize_partner_name(create_data.get("name"))

        # 检查编码是否已存在
        existing = await Customer.filter(
            tenant_id=tenant_id,
            code=create_data["code"],
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"客户编码 {create_data['code']} 已存在")

        await _assert_customer_name_unique(tenant_id, create_data["name"])
        
        _strip_customer_pool_managed_fields(create_data)
        salesman_id = create_data.pop("salesman_id", None)

        if create_data.get("is_active") is None:
            create_data["is_active"] = True

        create_data["pool_status"] = "pool"
        create_data["salesman_id"] = None
        create_data["salesman_name"] = None
        create_data["assigned_at"] = None
        create_data["recycle_at"] = None

        _apply_partner_contacts_payload(create_data)

        try:
            apply_create_audit(create_data, current_user)
            customer = await Customer.create(
                tenant_id=tenant_id,
                **create_data
            )
        except IntegrityError as e:
            if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                raise ValidationError(f"客户编码 {create_data['code']} 已存在（可能已被软删除，请检查）")
            raise

        if salesman_id:
            await _assert_can_assign_customer_ownership(current_user, tenant_id)
            target_user = await User.filter(id=salesman_id, tenant_id=tenant_id).first()
            if not target_user:
                raise ValidationError(f"业务员不存在: {salesman_id}")
            customer = await CustomerPoolService.apply_assign(
                tenant_id=tenant_id,
                customer=customer,
                target_user=target_user,
                operator=current_user,
                reason="master-data create",
            )

        return _to_customer_response(customer)

    @staticmethod
    async def bulk_create_customers(
        tenant_id: int,
        items: List[CustomerCreate],
        current_user: User,
    ) -> BulkCreateResponse:
        """批量创建客户（导入分片）；单条失败不中断整批。"""

        async def create_one(item: CustomerCreate, _index: int) -> CustomerResponse:
            return await SupplyChainService.create_customer(tenant_id, item, current_user)

        return await run_bulk_create(list(items or []), create_one)
    
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
        code: Optional[str] = None,
        name: Optional[str] = None,
        salesman_id: Optional[int] = None,
        sort_by: Optional[str] = None,
        sort_order: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
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

        query, order_expr = apply_master_crud_list_filters(
            query,
            keyword=keyword,
            code=code,
            name=name,
            keyword_fields=_CUSTOMER_SUPPLIER_KEYWORD_FIELDS,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
            updated_start_date=updated_start_date,
            updated_end_date=updated_end_date,
            sort_field=sort_by,
            sort_order=sort_order,
            default_sort_col="code",
        )

        # 客户行级范围：统一走 DataScopeService（含公海 + 业务员默认解析器）
        if current_user:
            query = await DataScopeService.apply(
                query,
                tenant_id=tenant_id,
                user=current_user,
                resource=RESOURCE_CUSTOMER,
            )

        total = await query.count()

        customers = await query.offset(skip).limit(limit).order_by(order_expr).all()

        return [_to_customer_response(c) for c in customers], total
    
    @staticmethod
    async def update_customer(
        tenant_id: int,
        customer_uuid: str,
        data: CustomerUpdate,
        current_user: User,
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
        
        update_data = data.model_dump(exclude_unset=True, by_alias=False) if hasattr(data, "model_dump") else data.dict(exclude_unset=True)
        _strip_customer_pool_managed_fields(update_data)

        if "name" in update_data:
            update_data["name"] = _normalize_partner_name(update_data.get("name"))
            if update_data["name"] != _normalize_partner_name(customer.name):
                await _assert_customer_name_unique(
                    tenant_id,
                    update_data["name"],
                    exclude_uuid=customer.uuid,
                )

        salesman_field_present = "salesman_id" in update_data
        salesman_change = update_data.pop("salesman_id", None) if salesman_field_present else None
        salesman_changed = salesman_field_present and salesman_change != customer.salesman_id

        _apply_partner_contacts_payload(update_data)

        if salesman_changed:
            if salesman_change:
                await _assert_can_assign_customer_ownership(current_user, tenant_id)
                target_user = await User.filter(id=salesman_change, tenant_id=tenant_id).first()
                if not target_user:
                    raise ValidationError(f"业务员不存在: {salesman_change}")
                customer = await CustomerPoolService.apply_assign(
                    tenant_id=tenant_id,
                    customer=customer,
                    target_user=target_user,
                    operator=current_user,
                    reason="master-data update",
                )
            else:
                await _assert_can_release_customer_ownership(current_user, tenant_id)
                customer = await CustomerPoolService.apply_release(
                    tenant_id=tenant_id,
                    customer=customer,
                    operator=current_user,
                    reason="master-data update",
                    skip_own_check=True,
                )

        for key, value in update_data.items():
            setattr(customer, key, value)

        try:
            if update_data:
                apply_update_audit(customer, current_user)
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
        customer_uuid: str,
        current_user: Optional[User] = None,
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

        # 删除守卫：存在业务单据引用时禁止删除（按未删除单据统计）
        summary = await _summarize_customer_blocking_documents(tenant_id, customer.id)
        if summary["total"] > 0:
            raise ValidationError(
                _format_customer_delete_guard_message(customer.name or customer.code, summary)
            )
        
        # 软删除
        from tortoise import timezone
        customer.deleted_at = timezone.now()
        apply_update_audit(customer, current_user)
        await customer.save()
    
    # ==================== 供应商相关方法 ====================
    
    @staticmethod
    async def create_supplier(
        tenant_id: int,
        data: SupplierCreate,
        current_user: Optional[User] = None,
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
        create_data = data.model_dump(by_alias=False) if hasattr(data, "model_dump") else data.dict()
        create_data["code"] = await _resolve_partner_create_code(
            tenant_id, _SUPPLIER_PAGE_CODE, create_data.get("code")
        )
        create_data["name"] = _normalize_partner_name(create_data.get("name"))

        # 检查编码是否已存在
        existing = await Supplier.filter(
            tenant_id=tenant_id,
            code=create_data["code"],
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"供应商编码 {create_data['code']} 已存在")

        await _assert_supplier_name_unique(tenant_id, create_data["name"])
        
        # 创建供应商（未传 is_active 时默认为启用）
        if create_data.get("is_active") is None:
            create_data["is_active"] = True
        from apps.master_data.services.supplier_governance import (
            QUALIFICATION_APPROVED,
            QUALIFICATION_POTENTIAL,
            is_supplier_qualification_required,
        )

        qualification_required = await is_supplier_qualification_required(tenant_id)
        if qualification_required:
            if not create_data.get("qualification_status"):
                create_data["qualification_status"] = QUALIFICATION_POTENTIAL
        else:
            # 关闭准入：创建即准入
            create_data["qualification_status"] = QUALIFICATION_APPROVED
        if create_data.get("qualifications") is None:
            create_data["qualifications"] = []
        # 评级由系统回写，创建时忽略客户端传入
        create_data.pop("rating_grade", None)
        create_data.pop("rating_score", None)
        create_data.pop("rated_at", None)
        # 自动回填采购员姓名
        if create_data.get("buyer_id"):
            buyer = await User.filter(id=create_data["buyer_id"]).first()
            if buyer:
                create_data["buyer_name"] = buyer.full_name or buyer.username

        _apply_partner_contacts_payload(create_data)

        try:
            apply_create_audit(create_data, current_user)
            supplier = await Supplier.create(
                tenant_id=tenant_id,
                **create_data
            )
        except IntegrityError as e:
            # 捕获数据库唯一约束错误，提供友好提示
            if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                raise ValidationError(f"供应商编码 {create_data['code']} 已存在（可能已被软删除，请检查）")
            raise
        
        return _to_supplier_response(supplier)

    @staticmethod
    async def bulk_create_suppliers(
        tenant_id: int,
        items: List[SupplierCreate],
        current_user: Optional[User] = None,
    ) -> BulkCreateResponse:
        """批量创建供应商（导入分片）；单条失败不中断整批。"""

        async def create_one(item: SupplierCreate, _index: int) -> SupplierResponse:
            return await SupplyChainService.create_supplier(
                tenant_id, item, current_user=current_user
            )

        return await run_bulk_create(list(items or []), create_one)
    
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
        qualification_status: Optional[str] = None,
        sort_by: Optional[str] = None,
        sort_order: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
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

        if qualification_status is not None and str(qualification_status).strip():
            query = query.filter(qualification_status=str(qualification_status).strip().lower())

        query, order_expr = apply_master_crud_list_filters(
            query,
            keyword=keyword,
            code=code,
            name=name,
            keyword_fields=_CUSTOMER_SUPPLIER_KEYWORD_FIELDS,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
            updated_start_date=updated_start_date,
            updated_end_date=updated_end_date,
            sort_field=sort_by,
            sort_order=sort_order,
            default_sort_col="code",
        )

        if current_user:
            query = await DataScopeService.apply(
                query,
                tenant_id=tenant_id,
                user=current_user,
                resource=RESOURCE_SUPPLIER,
            )

        total = await query.count()

        suppliers = await query.offset(skip).limit(limit).order_by(order_expr).all()

        return [_to_supplier_response(s) for s in suppliers], total
    
    @staticmethod
    async def update_supplier(
        tenant_id: int,
        supplier_uuid: str,
        data: SupplierUpdate,
        current_user: Optional[User] = None,
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
        # 评级由 recalculate 回写，禁止手工改分（允许改等级仅当同时不传 score？本期一律禁止手工写评分字段）
        update_data.pop("rating_score", None)
        update_data.pop("rated_at", None)
        # rating_grade 允许采购手工覆盖（少数场景），保留

        if "name" in update_data:
            update_data["name"] = _normalize_partner_name(update_data.get("name"))
            if update_data["name"] != _normalize_partner_name(supplier.name):
                await _assert_supplier_name_unique(
                    tenant_id,
                    update_data["name"],
                    exclude_uuid=supplier.uuid,
                )

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

        apply_update_audit(supplier, current_user)
        try:
            await supplier.save()
        except IntegrityError as e:
            # 捕获数据库唯一约束错误，提供友好提示
            if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                raise ValidationError(f"供应商编码 {data.code or supplier.code} 已存在（可能已被软删除，请检查）")
            raise
        
        return _to_supplier_response(supplier)

    @staticmethod
    async def recalculate_supplier_rating(
        tenant_id: int,
        supplier_uuid: str,
        *,
        lookback_days: int = 90,
    ) -> Dict[str, Any]:
        from apps.master_data.services.supplier_governance import recalculate_supplier_rating

        supplier = await Supplier.filter(
            tenant_id=tenant_id,
            uuid=supplier_uuid,
            deleted_at__isnull=True,
        ).first()
        if not supplier:
            raise NotFoundError(f"供应商 {supplier_uuid} 不存在")
        return await recalculate_supplier_rating(
            tenant_id, supplier, lookback_days=lookback_days
        )
    
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


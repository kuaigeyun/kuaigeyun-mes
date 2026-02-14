"""
物料数据 Schema 模块

定义物料数据的 Pydantic Schema（物料分组、物料、BOM），用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator, ConfigDict
from typing import Optional, Dict, Any, List
from datetime import datetime, date
from decimal import Decimal


class MaterialGroupBase(BaseModel):
    """物料分组基础 Schema"""
    
    code: str = Field(..., max_length=50, description="分组编码")
    name: str = Field(..., max_length=200, description="分组名称")
    parent_id: Optional[int] = Field(None, alias="parentId", description="父分组ID（用于层级结构）")
    description: Optional[str] = Field(None, description="描述")
    is_active: bool = Field(True, alias="isActive", description="是否启用")
    
    model_config = ConfigDict(
        populate_by_name=True,  # 允许同时使用字段名和别名
    )
    
    @validator("code")
    def validate_code(cls, v):
        """验证编码格式"""
        if not v or not v.strip():
            raise ValueError("分组编码不能为空")
        return v.strip().upper()
    
    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if not v or not v.strip():
            raise ValueError("分组名称不能为空")
        return v.strip()


class MaterialGroupCreate(MaterialGroupBase):
    """创建物料分组 Schema"""
    pass


class MaterialGroupUpdate(BaseModel):
    """更新物料分组 Schema"""
    
    code: Optional[str] = Field(None, max_length=50, description="分组编码")
    name: Optional[str] = Field(None, max_length=200, description="分组名称")
    parent_id: Optional[int] = Field(None, alias="parentId", description="父分组ID")
    description: Optional[str] = Field(None, description="描述")
    is_active: Optional[bool] = Field(None, alias="isActive", description="是否启用")
    
    model_config = ConfigDict(
        populate_by_name=True,  # 允许同时使用字段名和别名
    )
    
    @validator("code")
    def validate_code(cls, v):
        """验证编码格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("分组编码不能为空")
        return v.strip().upper() if v else None
    
    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("分组名称不能为空")
        return v.strip() if v else None


class MaterialGroupResponse(MaterialGroupBase):
    """物料分组响应 Schema"""
    
    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: int = Field(..., alias="tenantId", description="租户ID")
    parent_id: Optional[int] = Field(None, alias="parentId", description="父分组ID")
    process_route_id: Optional[int] = Field(None, alias="processRouteId", description="工艺路线ID")
    process_route_name: Optional[str] = Field(None, alias="processRouteName", description="工艺路线名称")
    created_at: datetime = Field(..., alias="createdAt", description="创建时间")
    updated_at: datetime = Field(..., alias="updatedAt", description="更新时间")
    deleted_at: Optional[datetime] = Field(None, alias="deletedAt", description="删除时间")
    is_active: bool = Field(True, alias="isActive", description="是否启用")
    
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        by_alias=True
    )


class MaterialBase(BaseModel):
    """物料基础 Schema"""
    
    main_code: Optional[str] = Field(None, alias="mainCode", max_length=50, description="主编码（系统自动生成，格式：MAT-{类型}-{序号}）")
    code: Optional[str] = Field(None, max_length=50, description="物料编码（已废弃，保留用于向后兼容，建议使用部门编码）")
    name: str = Field(..., max_length=200, description="物料名称")
    material_type: Optional[str] = Field(None, alias="materialType", max_length=20, description="物料类型（FIN/SEMI/RAW/PACK/AUX）")
    group_id: Optional[int] = Field(None, alias="groupId", description="物料分组ID")
    specification: Optional[str] = Field(None, max_length=500, description="规格")
    base_unit: str = Field(..., alias="baseUnit", max_length=20, description="基础单位")
    units: Optional[Dict[str, Any]] = Field(None, description="多单位管理（JSON格式）")
    batch_managed: bool = Field(False, alias="batchManaged", description="是否启用批号管理")
    variant_managed: bool = Field(False, alias="variantManaged", description="是否启用变体管理")
    variant_attributes: Optional[Dict[str, Any]] = Field(None, alias="variantAttributes", description="变体属性（JSON格式）")
    description: Optional[str] = Field(None, description="描述")
    brand: Optional[str] = Field(None, max_length=100, description="品牌")
    model: Optional[str] = Field(None, max_length=100, description="型号")
    is_active: bool = Field(True, alias="isActive", description="是否启用")
    
    # 部门编码列表（用于创建时输入）
    department_codes: Optional[List[Dict[str, Any]]] = Field(None, alias="departmentCodes", description="部门编码列表，格式：[{'code_type': 'SALE', 'code': 'SALE-A001', 'department': '销售部'}]")
    
    # 客户编码列表（用于创建时输入）
    customer_codes: Optional[List[Dict[str, Any]]] = Field(None, alias="customerCodes", description="客户编码列表，格式：[{'customer_id': 1, 'code': 'CUST-A-PART-12345', 'description': '描述'}]")
    
    # 供应商编码列表（用于创建时输入）
    supplier_codes: Optional[List[Dict[str, Any]]] = Field(None, alias="supplierCodes", description="供应商编码列表，格式：[{'supplier_id': 1, 'code': 'SUP-B-MAT-67890', 'description': '描述'}]")
    
    # 默认值设置（用于创建时输入）
    defaults: Optional[Dict[str, Any]] = Field(None, description="默认值设置（JSON格式），包含财务、采购、销售、库存、生产的默认值")
    
    # 物料来源控制（核心功能，新增）
    source_type: Optional[str] = Field(None, alias="sourceType", max_length=20, description="物料来源类型（Make/Buy/Phantom/Outsource/Configure）：Make(自制件)、Buy(采购件)、Phantom(虚拟件)、Outsource(委外件)、Configure(配置件)")
    source_config: Optional[Dict[str, Any]] = Field(None, alias="sourceConfig", description="物料来源相关配置（JSON格式），自制件含 manufacturing_mode（fabrication加工型/assembly装配型）、工艺路线、BOM等；采购件含供应商；委外件含委外供应商/工序；配置件含变体属性等")
    
    model_config = ConfigDict(
        populate_by_name=True,  # 允许同时使用字段名和别名
    )
    
    @validator("material_type")
    def validate_material_type(cls, v):
        """验证物料类型"""
        if v is None:
            return None
        valid_types = ["FIN", "SEMI", "RAW", "PACK", "AUX"]
        if v not in valid_types:
            raise ValueError(f"物料类型必须是以下之一: {', '.join(valid_types)}")
        return v
    
    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if not v or not v.strip():
            raise ValueError("物料名称不能为空")
        return v.strip()
    
    @validator("base_unit")
    def validate_base_unit(cls, v):
        """验证基础单位格式"""
        if not v or not v.strip():
            raise ValueError("基础单位不能为空")
        return v.strip()


class MaterialCreate(MaterialBase):
    """创建物料 Schema"""
    pass


class MaterialUpdate(BaseModel):
    """更新物料 Schema"""
    
    code: Optional[str] = Field(None, max_length=50, description="物料编码")
    name: Optional[str] = Field(None, max_length=200, description="物料名称")
    group_id: Optional[int] = Field(None, description="物料分组ID")
    process_route_id: Optional[int] = Field(None, alias="processRouteId", description="默认工艺路线ID（自制件时使用）")
    material_type: Optional[str] = Field(None, max_length=20, description="物料类型（FIN/SEMI/RAW/PACK/AUX）")
    specification: Optional[str] = Field(None, max_length=500, description="规格")
    base_unit: Optional[str] = Field(None, max_length=20, description="基础单位")
    units: Optional[Dict[str, Any]] = Field(None, description="多单位管理（JSON格式）")
    batch_managed: Optional[bool] = Field(None, description="是否启用批号管理")
    variant_managed: Optional[bool] = Field(None, description="是否启用变体管理")
    variant_attributes: Optional[Dict[str, Any]] = Field(None, description="变体属性（JSON格式）")
    description: Optional[str] = Field(None, description="描述")
    brand: Optional[str] = Field(None, max_length=100, description="品牌")
    model: Optional[str] = Field(None, max_length=100, description="型号")
    is_active: Optional[bool] = Field(None, description="是否启用")
    
    # 部门编码列表（用于更新时输入）
    department_codes: Optional[List[Dict[str, Any]]] = Field(None, description="部门编码列表")
    
    # 客户编码列表（用于更新时输入）
    customer_codes: Optional[List[Dict[str, Any]]] = Field(None, description="客户编码列表")
    
    # 供应商编码列表（用于更新时输入）
    supplier_codes: Optional[List[Dict[str, Any]]] = Field(None, description="供应商编码列表")
    
    # 默认值设置（用于更新时输入）
    defaults: Optional[Dict[str, Any]] = Field(None, description="默认值设置（JSON格式）")

    # 物料来源控制（与 MaterialBase 一致，支持更新时保存）
    source_type: Optional[str] = Field(None, alias="sourceType", max_length=20, description="物料来源类型（Make/Buy/Phantom/Outsource/Configure）")
    source_config: Optional[Dict[str, Any]] = Field(None, alias="sourceConfig", description="物料来源相关配置（JSON格式）")

    model_config = ConfigDict(populate_by_name=True)
    
    @validator("code")
    def validate_code(cls, v):
        """验证编码格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("物料编码不能为空")
        return v.strip().upper() if v else None
    
    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("物料名称不能为空")
        return v.strip() if v else None
    
    @validator("base_unit")
    def validate_base_unit(cls, v):
        """验证基础单位格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("基础单位不能为空")
        return v.strip() if v else None


class MaterialCodeAliasResponse(BaseModel):
    """物料编码别名响应 Schema"""
    
    id: int = Field(..., description="主键ID")
    code_type: str = Field(..., description="编码类型")
    code: str = Field(..., description="编码（部门编码、客户编码或供应商编码）")
    department: Optional[str] = Field(None, description="部门名称（可选，用于部门编码）")
    external_entity_type: Optional[str] = Field(None, description="外部实体类型（customer/supplier，用于客户编码和供应商编码）")
    external_entity_id: Optional[int] = Field(None, description="外部实体ID（客户ID或供应商ID）")
    description: Optional[str] = Field(None, description="描述")
    is_primary: bool = Field(False, description="是否为主要编码")
    
    model_config = ConfigDict(from_attributes=True)


class MaterialResponse(MaterialBase):
    """物料响应 Schema"""
    
    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: int = Field(..., alias="tenantId", description="租户ID")
    # main_code 从 MaterialBase 继承，但在这里确保它是必填的（实际数据库中总是有值）
    main_code: str = Field(..., description="主编码（系统内部唯一标识）")
    group_id: Optional[int] = Field(None, alias="groupId", description="物料分组ID")
    process_route_id: Optional[int] = Field(None, alias="processRouteId", description="工艺路线ID")
    process_route_name: Optional[str] = Field(None, alias="processRouteName", description="工艺路线名称")
    created_at: datetime = Field(..., alias="createdAt", description="创建时间")
    updated_at: datetime = Field(..., alias="updatedAt", description="更新时间")
    deleted_at: Optional[datetime] = Field(None, alias="deletedAt", description="删除时间")
    is_active: bool = Field(True, alias="isActive", description="是否启用")
    
    # 默认值设置（从数据库加载）
    defaults: Optional[Dict[str, Any]] = Field(None, description="默认值设置（JSON格式）")
    
    # 编码别名列表（可选，需要时加载）
    code_aliases: Optional[List[MaterialCodeAliasResponse]] = Field(None, description="编码别名列表")
    
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        by_alias=True
    )


# ==================== 级联查询响应 Schema ====================

class MaterialTreeResponse(MaterialResponse):
    """物料树形响应 Schema（用于级联查询）"""
    pass


class MaterialGroupTreeResponse(MaterialGroupResponse):
    """物料分组树形响应 Schema（用于级联查询）"""
    
    children: List["MaterialGroupTreeResponse"] = Field(default_factory=list, alias="children", description="子分组列表")
    materials: List[MaterialTreeResponse] = Field(default_factory=list, alias="materials", description="物料列表")
    
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        by_alias=True
    )


class BOMBase(BaseModel):
    """
    BOM基础 Schema
    
    根据《工艺路线和标准作业流程优化设计规范.md》设计。
    """
    
    material_id: int = Field(..., description="主物料ID（父件）")
    component_id: int = Field(..., description="子物料ID（子件）")
    quantity: Decimal = Field(..., description="用量（必填，数字）")
    unit: Optional[str] = Field(None, max_length=20, description="单位（可选，如：个、kg、m等）")
    
    # 损耗率和必选标识（根据优化设计规范新增）
    waste_rate: Decimal = Field(
        default=Decimal("0.00"),
        description="损耗率（百分比，如：5.00表示5%，用于计算实际用料数量）"
    )
    is_required: bool = Field(default=True, description="是否必选（是/否，默认：是）")
    
    # 层级信息（用于多层级BOM展开，根据优化设计规范新增）
    level: int = Field(default=0, description="层级深度（0为顶层，用于多层级BOM展开）")
    path: Optional[str] = Field(None, max_length=500, description="层级路径（如：1/2/3，用于快速查询和排序）")
    
    # 版本控制
    version: str = Field("1.0", max_length=50, description="BOM版本号")
    bom_code: Optional[str] = Field(None, max_length=100, description="BOM编码")
    is_default: bool = Field(False, description="是否为默认版本（每个物料至多一个）")
    
    # 有效期管理
    effective_date: Optional[datetime] = Field(None, description="生效日期")
    expiry_date: Optional[datetime] = Field(None, description="失效日期")
    
    # 审核管理
    approval_status: str = Field(
        "draft",
        max_length=20,
        description="审核状态：draft(草稿), pending(待审核), approved(已审核), rejected(已拒绝)"
    )
    approved_by: Optional[int] = Field(None, description="审核人ID")
    approved_at: Optional[datetime] = Field(None, description="审核时间")
    approval_comment: Optional[str] = Field(None, description="审核意见")
    
    # 替代料管理
    is_alternative: bool = Field(False, description="是否为替代料")
    alternative_group_id: Optional[int] = Field(None, description="替代料组ID")
    priority: int = Field(0, description="优先级（数字越小优先级越高）")
    
    # 扩展信息
    description: Optional[str] = Field(None, description="描述")
    remark: Optional[str] = Field(None, description="备注")
    is_active: bool = Field(True, description="是否启用")
    
    @validator("quantity")
    def validate_quantity(cls, v):
        """验证用量"""
        if v <= 0:
            raise ValueError("用量必须大于0")
        return v
    
    @validator("unit")
    def validate_unit(cls, v):
        """验证单位格式（unit 为可选，None 或空时返回 None）"""
        if v is None:
            return v
        if not v or not str(v).strip():
            return None
        return str(v).strip()
    
    @validator("approval_status")
    def validate_approval_status(cls, v):
        """验证审核状态"""
        allowed_statuses = ["draft", "pending", "approved", "rejected"]
        if v not in allowed_statuses:
            raise ValueError(f"审核状态必须是: {', '.join(allowed_statuses)}")
        return v
    
    @validator("expiry_date")
    def validate_expiry_date(cls, v, values):
        """验证失效日期必须晚于生效日期"""
        if v and "effective_date" in values and values["effective_date"]:
            if v <= values["effective_date"]:
                raise ValueError("失效日期必须晚于生效日期")
        return v


class BOMCreate(BOMBase):
    """创建BOM Schema"""
    pass


class BOMUpdate(BaseModel):
    """更新BOM Schema"""
    
    model_config = ConfigDict(populate_by_name=True)
    
    material_id: Optional[int] = Field(None, description="主物料ID（父件）")
    component_id: Optional[int] = Field(None, description="子物料ID（子件）")
    quantity: Optional[Decimal] = Field(None, description="用量（必填，数字）")
    unit: Optional[str] = Field(None, max_length=20, description="单位（可选，如：个、kg、m等）")
    
    # 损耗率和必选标识（根据优化设计规范新增）
    waste_rate: Optional[Decimal] = Field(
        None,
        description="损耗率（百分比，如：5.00表示5%，用于计算实际用料数量）"
    )
    is_required: Optional[bool] = Field(None, description="是否必选（是/否，默认：是）")
    
    # 层级信息（用于多层级BOM展开，根据优化设计规范新增）
    level: Optional[int] = Field(None, description="层级深度（0为顶层，用于多层级BOM展开）")
    path: Optional[str] = Field(None, max_length=500, description="层级路径（如：1/2/3，用于快速查询和排序）")
    
    # 版本控制
    version: Optional[str] = Field(None, max_length=50, description="BOM版本号")
    bom_code: Optional[str] = Field(None, max_length=100, description="BOM编码")
    is_default: Optional[bool] = Field(None, alias="isDefault", description="是否为默认版本")
    
    # 有效期管理
    effective_date: Optional[datetime] = Field(None, description="生效日期")
    expiry_date: Optional[datetime] = Field(None, description="失效日期")
    
    # 审核管理
    approval_status: Optional[str] = Field(
        None,
        max_length=20,
        description="审核状态：draft(草稿), pending(待审核), approved(已审核), rejected(已拒绝)"
    )
    approved_by: Optional[int] = Field(None, description="审核人ID")
    approved_at: Optional[datetime] = Field(None, description="审核时间")
    approval_comment: Optional[str] = Field(None, description="审核意见")
    
    # 替代料管理
    is_alternative: Optional[bool] = Field(None, description="是否为替代料")
    alternative_group_id: Optional[int] = Field(None, description="替代料组ID")
    priority: Optional[int] = Field(None, description="优先级")
    
    # 扩展信息
    description: Optional[str] = Field(None, description="描述")
    remark: Optional[str] = Field(None, description="备注")
    is_active: Optional[bool] = Field(None, description="是否启用")
    
    @validator("quantity")
    def validate_quantity(cls, v):
        """验证用量"""
        if v is not None and v <= 0:
            raise ValueError("用量必须大于0")
        return v
    
    @validator("unit")
    def validate_unit(cls, v):
        """验证单位格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("单位不能为空")
        return v.strip() if v else None
    
    @validator("approval_status")
    def validate_approval_status(cls, v):
        """验证审核状态"""
        if v is not None:
            allowed_statuses = ["draft", "pending", "approved", "rejected"]
            if v not in allowed_statuses:
                raise ValueError(f"审核状态必须是: {', '.join(allowed_statuses)}")
        return v
    
    @validator("expiry_date")
    def validate_expiry_date(cls, v, values):
        """验证失效日期必须晚于生效日期"""
        if v and "effective_date" in values and values.get("effective_date"):
            if v <= values["effective_date"]:
                raise ValueError("失效日期必须晚于生效日期")
        return v


class BOMResponse(BOMBase):
    """BOM响应 Schema"""
    
    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    deleted_at: Optional[datetime] = Field(None, description="删除时间")
    
    class Config:
        from_attributes = True


class BOMItemCreate(BaseModel):
    """
    BOM子物料项创建 Schema（用于批量创建）
    
    根据《工艺路线和标准作业流程优化设计规范.md》设计。
    """
    
    component_id: int = Field(..., description="子物料ID")
    quantity: Decimal = Field(..., description="用量（必填，数字）")
    unit: Optional[str] = Field(None, max_length=20, description="单位（可选，如：个、kg、m等）")
    
    # 损耗率和必选标识（根据优化设计规范新增）
    waste_rate: Decimal = Field(
        default=Decimal("0.00"),
        description="损耗率（百分比，如：5.00表示5%，用于计算实际用料数量）"
    )
    is_required: bool = Field(default=True, description="是否必选（是/否，默认：是）")
    
    is_alternative: bool = Field(False, description="是否为替代料")
    alternative_group_id: Optional[int] = Field(None, description="替代料组ID")
    priority: int = Field(0, description="优先级（数字越小优先级越高）")
    description: Optional[str] = Field(None, description="描述")
    remark: Optional[str] = Field(None, description="备注")
    
    @validator("quantity")
    def validate_quantity(cls, v):
        """验证用量"""
        if v <= 0:
            raise ValueError("用量必须大于0")
        return v
    
    @validator("unit")
    def validate_unit(cls, v):
        """验证单位格式（单位可选，如果提供则不能为空）"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("单位不能为空")
        return v.strip() if v else None
    
    @validator("waste_rate")
    def validate_waste_rate(cls, v):
        """验证损耗率（必须在0-100之间）"""
        if v < 0 or v > 100:
            raise ValueError("损耗率必须在0-100之间")
        return v


class BOMBatchCreate(BaseModel):
    """批量创建BOM Schema"""
    
    material_id: int = Field(..., description="主物料ID")
    items: List[BOMItemCreate] = Field(..., min_items=1, description="子物料项列表")
    
    # 版本控制
    version: str = Field("1.0", max_length=50, description="BOM版本号")
    bom_code: Optional[str] = Field(None, max_length=100, description="BOM编码")
    
    # 有效期管理
    effective_date: Optional[datetime] = Field(None, description="生效日期")
    expiry_date: Optional[datetime] = Field(None, description="失效日期")
    
    # 审核管理
    approval_status: str = Field(
        "draft",
        max_length=20,
        description="审核状态：draft(草稿), pending(待审核), approved(已审核), rejected(已拒绝)"
    )
    
    # 扩展信息
    description: Optional[str] = Field(None, description="描述")
    remark: Optional[str] = Field(None, description="备注")
    is_active: bool = Field(True, description="是否启用")
    
    @validator("items")
    def validate_items(cls, v):
        """验证子物料项列表"""
        if not v or len(v) == 0:
            raise ValueError("至少需要添加一个子物料项")
        
        # 检查是否有重复的子物料ID（非替代料）
        component_ids = [item.component_id for item in v if not item.is_alternative]
        if len(component_ids) != len(set(component_ids)):
            raise ValueError("子物料不能重复（替代料除外）")
        
        return v
    
    @validator("approval_status")
    def validate_approval_status(cls, v):
        """验证审核状态"""
        allowed_statuses = ["draft", "pending", "approved", "rejected"]
        if v not in allowed_statuses:
            raise ValueError(f"审核状态必须是: {', '.join(allowed_statuses)}")
        return v
    
    @validator("expiry_date")
    def validate_expiry_date(cls, v, values):
        """验证失效日期必须晚于生效日期"""
        if v and "effective_date" in values and values.get("effective_date"):
            if v <= values["effective_date"]:
                raise ValueError("失效日期必须晚于生效日期")
        return v


class BOMBatchImportItem(BaseModel):
    """
    BOM批量导入项 Schema（用于universheet批量导入）
    
    根据《工艺路线和标准作业流程优化设计规范.md》设计。
    支持使用任意部门编码，系统自动映射到主编码。
    """
    
    parent_code: str = Field(..., description="父件编码（支持任意部门编码：SALE-A001、DES-A001、主编码MAT-FIN-0001）")
    component_code: str = Field(..., description="子件编码（支持任意部门编码：PROD-A001、主编码MAT-SEMI-0001）")
    quantity: Decimal = Field(..., description="子件数量（必填，数字）")
    unit: Optional[str] = Field(None, description="子件单位（可选，如：个、kg、m等）")
    waste_rate: Optional[Decimal] = Field(None, description="损耗率（可选，百分比，如：5%表示5.00）")
    is_required: Optional[bool] = Field(True, description="是否必选（可选，是/否，默认：是）")
    remark: Optional[str] = Field(None, description="备注（可选）")
    
    @validator("quantity")
    def validate_quantity(cls, v):
        """验证用量"""
        if v <= 0:
            raise ValueError("子件数量必须大于0")
        return v
    
    @validator("waste_rate")
    def validate_waste_rate(cls, v):
        """验证损耗率（必须在0-100之间）"""
        if v is not None and (v < 0 or v > 100):
            raise ValueError("损耗率必须在0-100之间")
        return v


class BOMBatchImport(BaseModel):
    """
    BOM批量导入 Schema（用于universheet批量导入）
    
    根据《工艺路线和标准作业流程优化设计规范.md》设计。
    支持使用任意部门编码，系统自动映射到主编码。
    """
    
    items: List[BOMBatchImportItem] = Field(..., min_items=1, description="BOM导入项列表")
    version: Optional[str] = Field("1.0", max_length=50, description="BOM版本号（可选，默认：1.0）")
    bom_code: Optional[str] = Field(None, max_length=100, description="BOM编码（可选）")
    effective_date: Optional[datetime] = Field(None, description="生效日期（可选）")
    description: Optional[str] = Field(None, description="描述（可选）")
    
    @validator("items")
    def validate_items(cls, v):
        """验证导入项列表"""
        if not v or len(v) == 0:
            raise ValueError("至少需要添加一个BOM导入项")
        return v


class BOMVersionCreate(BaseModel):
    """
    BOM版本创建 Schema
    
    根据《工艺路线和标准作业流程优化设计规范.md》设计。
    """
    
    version: str = Field(..., max_length=50, description="版本号（如：v1.1）")
    version_description: Optional[str] = Field(None, description="版本说明")
    effective_date: Optional[datetime] = Field(None, description="生效日期（可选）")
    apply_strategy: str = Field(
        "new_only",
        description="版本应用策略：new_only（仅新工单使用新版本，推荐）或 all（所有工单使用新版本，谨慎使用）"
    )
    
    @validator("apply_strategy")
    def validate_apply_strategy(cls, v):
        """验证版本应用策略"""
        allowed_strategies = ["new_only", "all"]
        if v not in allowed_strategies:
            raise ValueError(f"版本应用策略必须是: {', '.join(allowed_strategies)}")
        return v


class BOMVersionCompare(BaseModel):
    """
    BOM版本对比 Schema
    
    根据《工艺路线和标准作业流程优化设计规范.md》设计。
    """
    
    version1: str = Field(..., max_length=50, description="版本1（如：v1.0）")
    version2: str = Field(..., max_length=50, description="版本2（如：v1.1）")


# ==================== 物料编码映射 Schema ====================

class MaterialCodeMappingBase(BaseModel):
    """物料编码映射基础 Schema"""
    
    material_uuid: str = Field(..., description="物料UUID（关联内部物料）")
    internal_code: str = Field(..., max_length=50, description="内部编码（物料编码）")
    external_code: str = Field(..., max_length=100, description="外部编码（外部系统的编码）")
    external_system: str = Field(..., max_length=50, description="外部系统名称（如：ERP、WMS、MES等）")
    description: Optional[str] = Field(None, description="描述")
    is_active: bool = Field(True, description="是否启用")
    
    @validator("internal_code")
    def validate_internal_code(cls, v):
        """验证内部编码格式"""
        if not v or not v.strip():
            raise ValueError("内部编码不能为空")
        return v.strip().upper()
    
    @validator("external_code")
    def validate_external_code(cls, v):
        """验证外部编码格式"""
        if not v or not v.strip():
            raise ValueError("外部编码不能为空")
        return v.strip()
    
    @validator("external_system")
    def validate_external_system(cls, v):
        """验证外部系统名称格式"""
        if not v or not v.strip():
            raise ValueError("外部系统名称不能为空")
        return v.strip()


class MaterialCodeMappingCreate(MaterialCodeMappingBase):
    """创建物料编码映射 Schema"""
    pass


class MaterialCodeMappingUpdate(BaseModel):
    """更新物料编码映射 Schema"""
    
    material_uuid: Optional[str] = Field(None, description="物料UUID（关联内部物料）")
    internal_code: Optional[str] = Field(None, max_length=50, description="内部编码（物料编码）")
    external_code: Optional[str] = Field(None, max_length=100, description="外部编码（外部系统的编码）")
    external_system: Optional[str] = Field(None, max_length=50, description="外部系统名称（如：ERP、WMS、MES等）")
    description: Optional[str] = Field(None, description="描述")
    is_active: Optional[bool] = Field(None, description="是否启用")


class MaterialCodeMappingResponse(MaterialCodeMappingBase):
    """物料编码映射响应 Schema"""
    
    id: int = Field(..., description="映射ID")
    uuid: str = Field(..., description="业务ID（UUID）")
    tenant_id: int = Field(..., description="组织ID")
    material_id: int = Field(..., description="物料ID（内部使用）")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    deleted_at: Optional[datetime] = Field(None, description="删除时间")
    
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        by_alias=True
    )


class MaterialCodeMappingListResponse(BaseModel):
    """物料编码映射列表响应 Schema"""
    
    items: List[MaterialCodeMappingResponse] = Field(..., description="映射列表")
    total: int = Field(..., description="总数")


class MaterialCodeConvertRequest(BaseModel):
    """物料编码转换请求 Schema"""
    
    external_code: str = Field(..., max_length=100, description="外部编码")
    external_system: str = Field(..., max_length=50, description="外部系统名称")


class MaterialCodeConvertResponse(BaseModel):
    """物料编码转换响应 Schema"""
    
    internal_code: str = Field(..., description="内部编码")
    material_uuid: str = Field(..., description="物料UUID")
    material_name: str = Field(..., description="物料名称")
    found: bool = Field(..., description="是否找到映射")


# ==================== 物料批号 Schema ====================

class MaterialBatchBase(BaseModel):
    """物料批号基础 Schema"""
    
    material_uuid: str = Field(..., description="物料UUID")
    batch_no: str = Field(..., max_length=100, description="批号（必填，同一物料下唯一）")
    production_date: Optional[date] = Field(None, description="生产日期（可选）")
    expiry_date: Optional[date] = Field(None, description="有效期（可选，用于有保质期的物料）")
    supplier_batch_no: Optional[str] = Field(None, max_length=100, description="供应商批号（可选）")
    quantity: Decimal = Field(0, description="批号数量（当前库存数量）")
    status: str = Field("in_stock", description="批号状态（在库、已出库、已过期、已报废等）")
    remark: Optional[str] = Field(None, description="备注（可选）")


class MaterialBatchCreate(MaterialBatchBase):
    """创建物料批号 Schema"""
    pass


class MaterialBatchUpdate(BaseModel):
    """更新物料批号 Schema"""
    
    production_date: Optional[date] = Field(None, description="生产日期（可选）")
    expiry_date: Optional[date] = Field(None, description="有效期（可选）")
    supplier_batch_no: Optional[str] = Field(None, max_length=100, description="供应商批号（可选）")
    quantity: Optional[Decimal] = Field(None, description="批号数量（当前库存数量）")
    status: Optional[str] = Field(None, description="批号状态")
    remark: Optional[str] = Field(None, description="备注（可选）")


class MaterialBatchResponse(MaterialBatchBase):
    """物料批号响应 Schema"""
    
    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: int = Field(..., alias="tenantId", description="租户ID")
    material_id: int = Field(..., alias="materialId", description="物料ID")
    material_name: Optional[str] = Field(None, alias="materialName", description="物料名称")
    created_at: datetime = Field(..., alias="createdAt", description="创建时间")
    updated_at: datetime = Field(..., alias="updatedAt", description="更新时间")
    deleted_at: Optional[datetime] = Field(None, alias="deletedAt", description="删除时间")
    
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        by_alias=True
    )


class MaterialBatchListResponse(BaseModel):
    """物料批号列表响应 Schema"""
    
    items: List[MaterialBatchResponse] = Field(..., description="批号列表")
    total: int = Field(..., description="总数")


# ==================== 物料序列号 Schema ====================

class MaterialSerialBase(BaseModel):
    """物料序列号基础 Schema"""
    
    material_uuid: str = Field(..., description="物料UUID")
    serial_no: str = Field(..., max_length=100, description="序列号（必填，全局唯一）")
    production_date: Optional[date] = Field(None, description="生产日期（可选）")
    factory_date: Optional[date] = Field(None, description="出厂日期（可选）")
    supplier_serial_no: Optional[str] = Field(None, max_length=100, description="供应商序列号（可选）")
    status: str = Field("in_stock", description="序列号状态（在库、已出库、已销售、已报废、已退货等）")
    remark: Optional[str] = Field(None, description="备注（可选）")


class MaterialSerialCreate(MaterialSerialBase):
    """创建物料序列号 Schema"""
    pass


class MaterialSerialUpdate(BaseModel):
    """更新物料序列号 Schema"""
    
    production_date: Optional[date] = Field(None, description="生产日期（可选）")
    factory_date: Optional[date] = Field(None, description="出厂日期（可选）")
    supplier_serial_no: Optional[str] = Field(None, max_length=100, description="供应商序列号（可选）")
    status: Optional[str] = Field(None, description="序列号状态")
    remark: Optional[str] = Field(None, description="备注（可选）")


class MaterialSerialResponse(MaterialSerialBase):
    """物料序列号响应 Schema"""
    
    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: int = Field(..., alias="tenantId", description="租户ID")
    material_id: int = Field(..., alias="materialId", description="物料ID")
    material_name: Optional[str] = Field(None, alias="materialName", description="物料名称")
    created_at: datetime = Field(..., alias="createdAt", description="创建时间")
    updated_at: datetime = Field(..., alias="updatedAt", description="更新时间")
    deleted_at: Optional[datetime] = Field(None, alias="deletedAt", description="删除时间")
    
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        by_alias=True
    )


class MaterialSerialListResponse(BaseModel):
    """物料序列号列表响应 Schema"""
    
    items: List[MaterialSerialResponse] = Field(..., description="序列号列表")
    total: int = Field(..., description="总数")

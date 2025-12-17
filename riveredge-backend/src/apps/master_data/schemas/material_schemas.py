"""
物料数据 Schema 模块

定义物料数据的 Pydantic Schema（物料分组、物料、BOM），用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator, ConfigDict
from typing import Optional, Dict, Any, List
from datetime import datetime
from decimal import Decimal


class MaterialGroupBase(BaseModel):
    """物料分组基础 Schema"""
    
    code: str = Field(..., max_length=50, description="分组编码")
    name: str = Field(..., max_length=200, description="分组名称")
    parent_id: Optional[int] = Field(None, description="父分组ID（用于层级结构）")
    description: Optional[str] = Field(None, description="描述")
    is_active: bool = Field(True, description="是否启用")
    
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
    parent_id: Optional[int] = Field(None, description="父分组ID")
    description: Optional[str] = Field(None, description="描述")
    is_active: Optional[bool] = Field(None, description="是否启用")
    
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
    
    code: str = Field(..., max_length=50, description="物料编码")
    name: str = Field(..., max_length=200, description="物料名称")
    group_id: Optional[int] = Field(None, description="物料分组ID")
    specification: Optional[str] = Field(None, max_length=500, description="规格")
    base_unit: str = Field(..., max_length=20, description="基础单位")
    units: Optional[Dict[str, Any]] = Field(None, description="多单位管理（JSON格式）")
    batch_managed: bool = Field(False, description="是否启用批号管理")
    variant_managed: bool = Field(False, description="是否启用变体管理")
    variant_attributes: Optional[Dict[str, Any]] = Field(None, description="变体属性（JSON格式）")
    description: Optional[str] = Field(None, description="描述")
    brand: Optional[str] = Field(None, max_length=100, description="品牌")
    model: Optional[str] = Field(None, max_length=100, description="型号")
    is_active: bool = Field(True, description="是否启用")
    
    @validator("code")
    def validate_code(cls, v):
        """验证编码格式"""
        if not v or not v.strip():
            raise ValueError("物料编码不能为空")
        return v.strip().upper()
    
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


class MaterialResponse(MaterialBase):
    """物料响应 Schema"""
    
    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: int = Field(..., alias="tenantId", description="租户ID")
    group_id: Optional[int] = Field(None, alias="groupId", description="物料分组ID")
    created_at: datetime = Field(..., alias="createdAt", description="创建时间")
    updated_at: datetime = Field(..., alias="updatedAt", description="更新时间")
    deleted_at: Optional[datetime] = Field(None, alias="deletedAt", description="删除时间")
    is_active: bool = Field(True, alias="isActive", description="是否启用")
    
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
    """BOM基础 Schema"""
    
    material_id: int = Field(..., description="主物料ID")
    component_id: int = Field(..., description="子物料ID")
    quantity: Decimal = Field(..., description="用量")
    unit: str = Field(..., max_length=20, description="单位")
    
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
        """验证单位格式"""
        if not v or not v.strip():
            raise ValueError("单位不能为空")
        return v.strip()
    
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
    
    material_id: Optional[int] = Field(None, description="主物料ID")
    component_id: Optional[int] = Field(None, description="子物料ID")
    quantity: Optional[Decimal] = Field(None, description="用量")
    unit: Optional[str] = Field(None, max_length=20, description="单位")
    
    # 版本控制
    version: Optional[str] = Field(None, max_length=50, description="BOM版本号")
    bom_code: Optional[str] = Field(None, max_length=100, description="BOM编码")
    
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
    """BOM子物料项创建 Schema（用于批量创建）"""
    
    component_id: int = Field(..., description="子物料ID")
    quantity: Decimal = Field(..., description="用量")
    unit: str = Field(..., max_length=20, description="单位")
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
        """验证单位格式"""
        if not v or not v.strip():
            raise ValueError("单位不能为空")
        return v.strip()


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


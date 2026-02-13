"""
工艺数据 Schema 模块

定义工艺数据的 Pydantic Schema（不良品、工序、工艺路线、作业程序），用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, field_validator, validator, ConfigDict
from typing import Optional, Dict, Any, List
from datetime import datetime


class DefectTypeBase(BaseModel):
    """不良品基础 Schema"""
    
    code: str = Field(..., max_length=50, description="不良品编码")
    name: str = Field(..., max_length=200, description="不良品名称")
    category: Optional[str] = Field(None, max_length=50, description="分类")
    description: Optional[str] = Field(None, description="描述")
    is_active: bool = Field(True, alias="isActive", description="是否启用")
    
    model_config = ConfigDict(populate_by_name=True)
    
    @field_validator("code")
    @classmethod
    def validate_code(cls, v: str) -> str:
        """验证编码格式"""
        if not v or not v.strip():
            raise ValueError("不良品编码不能为空")
        return v.strip().upper()
    
    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        """验证名称格式"""
        if not v or not v.strip():
            raise ValueError("不良品名称不能为空")
        return v.strip()


class DefectTypeCreate(DefectTypeBase):
    """创建不良品 Schema"""
    pass


class DefectTypeUpdate(BaseModel):
    """更新不良品 Schema"""
    
    code: Optional[str] = Field(None, max_length=50, description="不良品编码")
    name: Optional[str] = Field(None, max_length=200, description="不良品名称")
    category: Optional[str] = Field(None, max_length=50, description="分类")
    description: Optional[str] = Field(None, description="描述")
    is_active: Optional[bool] = Field(None, alias="isActive", description="是否启用")
    
    model_config = ConfigDict(populate_by_name=True)
    
    @field_validator("code")
    @classmethod
    def validate_code(cls, v: Optional[str]) -> Optional[str]:
        """验证编码格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("不良品编码不能为空")
        return v.strip().upper() if v else None
    
    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        """验证名称格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("不良品名称不能为空")
        return v.strip() if v else None


class DefectTypeResponse(DefectTypeBase):
    """不良品响应 Schema（含 alias 便于前端 camelCase 一致）"""
    
    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: int = Field(..., alias="tenantId", description="租户ID")
    created_at: datetime = Field(..., alias="createdAt", description="创建时间")
    updated_at: datetime = Field(..., alias="updatedAt", description="更新时间")
    deleted_at: Optional[datetime] = Field(None, alias="deletedAt", description="删除时间")
    
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class DefectTypeListResponse(BaseModel):
    """不良品列表分页响应"""
    data: List[DefectTypeResponse] = Field(..., description="列表数据")
    total: int = Field(..., ge=0, description="总条数")


class DefectTypeMinimal(BaseModel):
    """不良品项简要（工序绑定用）"""
    uuid: str = Field(..., description="UUID")
    code: str = Field(..., description="编码")
    name: str = Field(..., description="名称")


class OperationBase(BaseModel):
    """工序基础 Schema"""
    
    code: str = Field(..., max_length=50, description="工序编码")
    name: str = Field(..., max_length=200, description="工序名称")
    description: Optional[str] = Field(None, description="描述")
    reporting_type: str = Field("quantity", alias="reportingType", max_length=20, description="报工类型（quantity:按数量报工, status:按状态报工）")
    allow_jump: bool = Field(False, alias="allowJump", description="是否允许跳转（true:允许跳转，不依赖上道工序完成, false:不允许跳转，必须完成上道工序）")
    is_active: bool = Field(True, alias="isActive", description="是否启用")
    
    @field_validator("reporting_type")
    @classmethod
    def validate_reporting_type(cls, v: str) -> str:
        """验证报工类型"""
        if not v:
            return "quantity"
        allowed_types = ["quantity", "status"]
        if v not in allowed_types:
            raise ValueError(f"报工类型必须是: {', '.join(allowed_types)}")
        return v
    
    @field_validator("code")
    @classmethod
    def validate_code(cls, v: str) -> str:
        """验证编码格式"""
        if not v or not v.strip():
            raise ValueError("工序编码不能为空")
        return v.strip().upper()
    
    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        """验证名称格式"""
        if not v or not v.strip():
            raise ValueError("工序名称不能为空")
        return v.strip()


class OperationCreate(OperationBase):
    """创建工序 Schema"""
    defect_type_uuids: Optional[List[str]] = Field(None, alias="defectTypeUuids", description="允许绑定的不良品项 UUID 列表")
    default_operator_uuids: Optional[List[str]] = Field(None, alias="defaultOperatorUuids", description="默认生产人员（用户UUID列表）")
    model_config = ConfigDict(populate_by_name=True)


class OperationUpdate(BaseModel):
    """更新工序 Schema"""
    
    code: Optional[str] = Field(None, max_length=50, description="工序编码")
    name: Optional[str] = Field(None, max_length=200, description="工序名称")
    description: Optional[str] = Field(None, description="描述")
    reporting_type: Optional[str] = Field(None, alias="reportingType", max_length=20, description="报工类型（quantity:按数量报工, status:按状态报工）")
    allow_jump: Optional[bool] = Field(None, alias="allowJump", description="是否允许跳转（true:允许跳转，不依赖上道工序完成, false:不允许跳转，必须完成上道工序）")
    is_active: Optional[bool] = Field(None, alias="isActive", description="是否启用")
    defect_type_uuids: Optional[List[str]] = Field(None, alias="defectTypeUuids", description="允许绑定的不良品项 UUID 列表")
    default_operator_uuids: Optional[List[str]] = Field(None, alias="defaultOperatorUuids", description="默认生产人员（用户UUID列表）")
    model_config = ConfigDict(populate_by_name=True)
    
    @field_validator("reporting_type")
    @classmethod
    def validate_reporting_type(cls, v: Optional[str]) -> Optional[str]:
        """验证报工类型"""
        if v is not None and v not in ("quantity", "status"):
            raise ValueError("报工类型必须是: quantity, status")
        return v
    
    @field_validator("code")
    @classmethod
    def validate_code(cls, v: Optional[str]) -> Optional[str]:
        """验证编码格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("工序编码不能为空")
        return v.strip().upper() if v else None
    
    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        """验证名称格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("工序名称不能为空")
        return v.strip() if v else None


class OperationResponse(OperationBase):
    """工序响应 Schema"""
    
    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    deleted_at: Optional[datetime] = Field(None, description="删除时间")
    defect_types: List[DefectTypeMinimal] = Field(default_factory=list, description="允许绑定的不良品项")
    default_operator_ids: List[int] = Field(default_factory=list, description="默认生产人员（用户ID列表）")
    default_operator_uuids: List[str] = Field(default_factory=list, description="默认生产人员 UUID列表")
    default_operator_names: List[str] = Field(default_factory=list, description="默认生产人员姓名列表")
    
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class ProcessRouteBase(BaseModel):
    """工艺路线基础 Schema"""

    code: str = Field(..., max_length=50, description="工艺路线编码")
    name: str = Field(..., max_length=200, description="工艺路线名称")
    description: Optional[str] = Field(None, description="描述")
    version: str = Field("1.0", max_length=20, description="版本号（如：v1.0、v1.1）")
    version_description: Optional[str] = Field(None, description="版本说明")
    base_version: Optional[str] = Field(None, max_length=20, description="基于版本（从哪个版本创建）")
    effective_date: Optional[datetime] = Field(None, description="生效日期")
    operation_sequence: Optional[Dict[str, Any]] = Field(None, description="工序序列（JSON格式，支持子工艺路线）")
    parent_route_uuid: Optional[str] = Field(None, description="父工艺路线UUID（如果此工艺路线是子工艺路线）")
    parent_operation_uuid: Optional[str] = Field(None, max_length=100, description="父工序UUID（此子工艺路线所属的父工序）")
    level: int = Field(0, ge=0, le=3, description="嵌套层级（0为主工艺路线，1为第一层子工艺路线，最多3层）")
    is_active: bool = Field(True, description="是否启用")

    class Config:
        populate_by_name = True

    @validator("code")
    def validate_code(cls, v):
        """验证编码格式"""
        if not v or not v.strip():
            raise ValueError("工艺路线编码不能为空")
        return v.strip().upper()

    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if not v or not v.strip():
            raise ValueError("工艺路线名称不能为空")
        return v.strip()


class ProcessRouteCreate(ProcessRouteBase):
    """创建工艺路线 Schema"""
    pass


class ProcessRouteUpdate(BaseModel):
    """更新工艺路线 Schema"""
    
    code: Optional[str] = Field(None, max_length=50, description="工艺路线编码")
    name: Optional[str] = Field(None, max_length=200, description="工艺路线名称")
    description: Optional[str] = Field(None, description="描述")
    version: Optional[str] = Field(None, max_length=20, description="版本号")
    version_description: Optional[str] = Field(None, description="版本说明")
    base_version: Optional[str] = Field(None, max_length=20, description="基于版本")
    effective_date: Optional[datetime] = Field(None, description="生效日期")
    operation_sequence: Optional[Dict[str, Any]] = Field(None, description="工序序列（JSON格式）")
    is_active: Optional[bool] = Field(None, description="是否启用")
    
    @validator("code")
    def validate_code(cls, v):
        """验证编码格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("工艺路线编码不能为空")
        return v.strip().upper() if v else None
    
    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("工艺路线名称不能为空")
        return v.strip() if v else None


class ProcessRouteResponse(ProcessRouteBase):
    """工艺路线响应 Schema"""
    
    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: int = Field(..., description="租户ID")
    parent_route_uuid: Optional[str] = Field(None, description="父工艺路线UUID")
    level: int = Field(0, description="嵌套层级（0为主工艺路线，1-3为子工艺路线）")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    deleted_at: Optional[datetime] = Field(None, description="删除时间")
    
    class Config:
        from_attributes = True


# ==================== 级联查询相关 Schema ====================

class OperationTreeResponse(OperationResponse):
    """工序树形响应 Schema（用于级联查询）"""
    
    class Config:
        from_attributes = True
        populate_by_name = True
        by_alias = True


class ProcessRouteTreeResponse(ProcessRouteResponse):
    """工艺路线树形响应 Schema（包含工序列表）"""
    
    operations: List[OperationTreeResponse] = Field(default_factory=list, description="工序列表（按序列顺序）")
    
    class Config:
        from_attributes = True
        populate_by_name = True
        by_alias = True


# ==================== 工艺路线版本管理相关 Schema ====================

class ProcessRouteVersionCreate(BaseModel):
    """创建工艺路线新版本 Schema"""
    
    version: str = Field(..., max_length=20, description="版本号（如：v1.1）")
    version_description: Optional[str] = Field(None, description="版本说明")
    effective_date: Optional[datetime] = Field(None, description="生效日期（可选，默认为当前日期）")
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


class ProcessRouteVersionCompare(BaseModel):
    """工艺路线版本对比 Schema"""
    
    version1: str = Field(..., max_length=20, description="版本1")
    version2: str = Field(..., max_length=20, description="版本2")


# ==================== 工艺路线模板管理相关 Schema ====================

class ProcessRouteTemplateBase(BaseModel):
    """工艺路线模板基础 Schema"""
    
    code: str = Field(..., max_length=50, description="模板编码（组织内唯一）")
    name: str = Field(..., max_length=200, description="模板名称")
    category: Optional[str] = Field(None, max_length=50, description="模板分类（如：注塑类、组装类、包装类等）")
    description: Optional[str] = Field(None, description="模板描述")
    scope: str = Field(
        "all_materials",
        description="适用范围（all_materials:所有物料, all_groups:所有物料分组, specific_groups:特定物料分组）"
    )
    scope_groups: Optional[List[str]] = Field(None, description="适用范围物料分组UUID列表（当scope为specific_groups时使用）")
    process_route_config: Optional[Dict[str, Any]] = Field(None, description="工艺路线配置（JSON格式）")
    version: str = Field("1.0", max_length=20, description="模板版本号")
    version_description: Optional[str] = Field(None, description="版本说明")
    is_active: bool = Field(True, description="是否启用")
    
    @validator("scope")
    def validate_scope(cls, v):
        """验证适用范围"""
        allowed_scopes = ["all_materials", "all_groups", "specific_groups"]
        if v not in allowed_scopes:
            raise ValueError(f"适用范围必须是: {', '.join(allowed_scopes)}")
        return v


class ProcessRouteTemplateCreate(ProcessRouteTemplateBase):
    """创建工艺路线模板 Schema"""
    pass


class ProcessRouteTemplateUpdate(BaseModel):
    """更新工艺路线模板 Schema"""
    
    name: Optional[str] = Field(None, max_length=200, description="模板名称")
    category: Optional[str] = Field(None, max_length=50, description="模板分类")
    description: Optional[str] = Field(None, description="模板描述")
    scope: Optional[str] = Field(None, description="适用范围")
    scope_groups: Optional[List[str]] = Field(None, description="适用范围物料分组UUID列表")
    process_route_config: Optional[Dict[str, Any]] = Field(None, description="工艺路线配置")
    is_active: Optional[bool] = Field(None, description="是否启用")


class ProcessRouteTemplateResponse(ProcessRouteTemplateBase):
    """工艺路线模板响应 Schema"""
    
    id: int = Field(..., description="模板ID")
    uuid: str = Field(..., description="模板UUID")
    tenant_id: int = Field(..., description="组织ID")
    base_version: Optional[str] = Field(None, description="基于版本")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    deleted_at: Optional[datetime] = Field(None, description="删除时间")
    
    class Config:
        from_attributes = True
        populate_by_name = True


class ProcessRouteTemplateVersionCreate(BaseModel):
    """创建工艺路线模板新版本 Schema"""
    
    version: str = Field(..., max_length=20, description="版本号（如：v1.1）")
    version_description: Optional[str] = Field(None, description="版本说明")


class ProcessRouteFromTemplateCreate(BaseModel):
    """基于模板创建工艺路线 Schema"""
    
    template_uuid: str = Field(..., description="模板UUID")
    code: str = Field(..., max_length=50, description="工艺路线编码")
    name: str = Field(..., max_length=200, description="工艺路线名称")
    description: Optional[str] = Field(None, description="描述")
    is_active: bool = Field(True, description="是否启用")


class ProcessRouteVersionCompareResult(BaseModel):
    """工艺路线版本对比结果 Schema"""
    
    version1: str = Field(..., description="版本1")
    version2: str = Field(..., description="版本2")
    added_operations: List[Dict[str, Any]] = Field(default_factory=list, description="新增工序")
    removed_operations: List[Dict[str, Any]] = Field(default_factory=list, description="删除工序")
    modified_operations: List[Dict[str, Any]] = Field(default_factory=list, description="修改工序（包含变化详情）")
    sequence_changes: List[Dict[str, Any]] = Field(default_factory=list, description="工序顺序变化")


class SOPBase(BaseModel):
    """作业程序（SOP）基础 Schema — 工艺路线与 BOM 融合主数据，产出作业指导书与报工数据采集项"""
    
    code: str = Field(..., max_length=50, description="SOP编码")
    name: str = Field(..., max_length=200, description="SOP名称")
    operation_id: Optional[int] = Field(None, description="关联工序ID")
    version: Optional[str] = Field(None, max_length=20, description="版本号")
    content: Optional[str] = Field(None, description="SOP内容（支持富文本）")
    attachments: Optional[Dict[str, Any]] = Field(None, description="附件列表（JSON格式）")
    flow_config: Optional[Dict[str, Any]] = Field(None, description="流程配置（ProFlow JSON格式，作业指导步骤与顺序）")
    form_config: Optional[Dict[str, Any]] = Field(None, description="报工数据采集项（Formily Schema，数字/选择/文本/日期时间及必填与校验）")
    is_active: bool = Field(True, description="是否启用")
    # 阶段一：绑定与融合
    material_group_uuids: Optional[List[str]] = Field(None, description="绑定的物料组 UUID 列表")
    material_uuids: Optional[List[str]] = Field(None, description="绑定的具体物料 UUID 列表，匹配时优先于物料组")
    route_uuids: Optional[List[str]] = Field(None, description="载入的工艺路线 UUID 列表，作为融合输入")
    bom_load_mode: Optional[str] = Field("by_material", max_length=32, description="BOM载入方式：by_material/by_material_group/specific_bom")
    specific_bom_uuid: Optional[str] = Field(None, max_length=36, description="指定BOM的UUID（bom_load_mode=specific_bom时使用）")
    
    @validator("code")
    def validate_code(cls, v):
        """验证编码格式"""
        if not v or not v.strip():
            raise ValueError("SOP编码不能为空")
        return v.strip().upper()
    
    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if not v or not v.strip():
            raise ValueError("SOP名称不能为空")
        return v.strip()
    
    @validator("bom_load_mode")
    def validate_bom_load_mode(cls, v):
        """验证 BOM 载入方式"""
        if v is not None and v not in ("by_material", "by_material_group", "specific_bom"):
            raise ValueError("bom_load_mode 必须是 by_material、by_material_group 或 specific_bom")
        return v or "by_material"


class SOPCreate(SOPBase):
    """创建作业程序（SOP） Schema"""
    pass


class SOPBatchCreateFromRouteRequest(BaseModel):
    """按工艺路线批量创建 SOP 请求"""
    process_route_uuid: str = Field(..., description="工艺路线UUID")
    material_uuids: Optional[List[str]] = Field(None, description="绑定的物料UUID列表（可选）")
    material_group_uuids: Optional[List[str]] = Field(None, description="绑定的物料组UUID列表（可选）")


class SOPUpdate(BaseModel):
    """更新作业程序（SOP） Schema"""
    
    code: Optional[str] = Field(None, max_length=50, description="SOP编码")
    name: Optional[str] = Field(None, max_length=200, description="SOP名称")
    operation_id: Optional[int] = Field(None, description="关联工序ID")
    version: Optional[str] = Field(None, max_length=20, description="版本号")
    content: Optional[str] = Field(None, description="SOP内容（支持富文本）")
    attachments: Optional[Dict[str, Any]] = Field(None, description="附件列表（JSON格式）")
    flow_config: Optional[Dict[str, Any]] = Field(None, description="流程配置（ProFlow JSON格式）")
    form_config: Optional[Dict[str, Any]] = Field(None, description="报工数据采集项（Formily Schema）")
    is_active: Optional[bool] = Field(None, description="是否启用")
    material_group_uuids: Optional[List[str]] = Field(None, description="绑定的物料组 UUID 列表")
    material_uuids: Optional[List[str]] = Field(None, description="绑定的具体物料 UUID 列表")
    route_uuids: Optional[List[str]] = Field(None, description="载入的工艺路线 UUID 列表")
    bom_load_mode: Optional[str] = Field(None, max_length=32, description="BOM载入方式")
    specific_bom_uuid: Optional[str] = Field(None, max_length=36, description="指定BOM的UUID")
    
    @validator("bom_load_mode")
    def validate_bom_load_mode_update(cls, v):
        if v is not None and v not in ("by_material", "by_material_group", "specific_bom"):
            raise ValueError("bom_load_mode 必须是 by_material、by_material_group 或 specific_bom")
        return v
    
    @validator("code")
    def validate_code(cls, v):
        """验证编码格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("SOP编码不能为空")
        return v.strip().upper() if v else None
    
    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("SOP名称不能为空")
        return v.strip() if v else None


class SOPResponse(SOPBase):
    """作业程序（SOP）响应 Schema"""
    
    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    deleted_at: Optional[datetime] = Field(None, description="删除时间")
    
    class Config:
        from_attributes = True


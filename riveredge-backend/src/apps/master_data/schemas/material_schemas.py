"""
物料数据 Schema 模块

定义物料数据的 Pydantic Schema（物料分组、物料、BOM），用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator, model_validator, ConfigDict
from typing import Optional, Dict, Any, List, Literal
from datetime import datetime, date
from decimal import Decimal

from apps.master_data.constants.material_source_type import (
    is_canonical_material_source_type,
    normalize_material_source_type,
)


class InspectionStagePolicySchema(BaseModel):
    """单场景质检策略。"""

    mode: str = Field("none", description="none|simple|plan")
    plan_id: Optional[int] = Field(None, alias="planId", description="方案质检时的检验方案 ID")

    model_config = ConfigDict(populate_by_name=True)


class MaterialInspectionStagesSchema(BaseModel):
    """物料分场景质检策略。"""

    iqc: Optional[InspectionStagePolicySchema] = Field(None, description="来料 IQC")
    fqc: Optional[InspectionStagePolicySchema] = Field(None, description="成品 FQC")
    oqc: Optional[InspectionStagePolicySchema] = Field(None, description="出货 OQC")

    model_config = ConfigDict(populate_by_name=True)


class MaterialGroupBase(BaseModel):
    """物料分组基础 Schema"""
    
    code: str = Field(..., max_length=50, description="分组编号（参与物料编号生成）")
    alias: Optional[str] = Field(None, max_length=100, description="分组代号（英文展示名，可选）")
    name: str = Field(..., max_length=200, description="分组名称")
    parent_id: Optional[int] = Field(None, alias="parentId", description="父分组ID（用于层级结构）")
    description: Optional[str] = Field(None, description="描述")
    is_active: bool = Field(True, alias="isActive", description="是否启用")
    
    model_config = ConfigDict(
        populate_by_name=True,  # 允许同时使用字段名和别名
    )
    
    @validator("code")
    def validate_code(cls, v):
        """验证编号格式"""
        if not v or not v.strip():
            raise ValueError("分组编号不能为空")
        return v.strip().upper()
    
    @validator("alias")
    def validate_alias(cls, v):
        """验证代号格式"""
        if v is None:
            return None
        stripped = v.strip()
        return stripped if stripped else None
    
    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if not v or not v.strip():
            raise ValueError("分组名称不能为空")
        return v.strip()


class MaterialGroupCreate(MaterialGroupBase):
    """创建物料分组 Schema"""

    process_route_id: Optional[int] = Field(
        None,
        alias="processRouteId",
        description="默认工艺路线ID（组内物料未单独指派时使用）",
    )
    inspection_stages: Optional[MaterialInspectionStagesSchema] = Field(
        None,
        alias="inspectionStages",
        description="分场景默认质检策略（组内物料未单独配置时使用）",
    )


class MaterialGroupUpdate(BaseModel):
    """更新物料分组 Schema"""
    
    code: Optional[str] = Field(None, max_length=50, description="分组编号")
    alias: Optional[str] = Field(None, max_length=100, description="分组代号（英文展示名，可选）")
    name: Optional[str] = Field(None, max_length=200, description="分组名称")
    parent_id: Optional[int] = Field(None, alias="parentId", description="父分组ID")
    description: Optional[str] = Field(None, description="描述")
    is_active: Optional[bool] = Field(None, alias="isActive", description="是否启用")
    process_route_id: Optional[int] = Field(
        None,
        alias="processRouteId",
        description="默认工艺路线ID；传 null 可清空",
    )
    inspection_stages: Optional[MaterialInspectionStagesSchema] = Field(
        None,
        alias="inspectionStages",
        description="分场景默认质检策略；传 null 可清空",
    )
    
    model_config = ConfigDict(
        populate_by_name=True,  # 允许同时使用字段名和别名
    )
    
    @validator("code")
    def validate_code(cls, v):
        """验证编号格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("分组编号不能为空")
        return v.strip().upper() if v else None
    
    @validator("alias")
    def validate_alias(cls, v):
        """验证代号格式"""
        if v is None:
            return None
        stripped = v.strip()
        return stripped if stripped else None
    
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
    inspection_stages: Optional[MaterialInspectionStagesSchema] = Field(
        None, alias="inspectionStages", description="分场景默认质检策略"
    )
    created_at: datetime = Field(..., alias="createdAt", description="创建时间")
    updated_at: datetime = Field(..., alias="updatedAt", description="更新时间")
    created_by_name: Optional[str] = Field(None, alias="createdByName", description="创建人姓名")
    updated_by_name: Optional[str] = Field(None, alias="updatedByName", description="更新人姓名")
    deleted_at: Optional[datetime] = Field(None, alias="deletedAt", description="删除时间")
    is_active: bool = Field(True, alias="isActive", description="是否启用")
    
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        by_alias=True
    )


class MaterialBase(BaseModel):
    """物料基础 Schema"""
    
    main_code: Optional[str] = Field(None, alias="mainCode", max_length=50, description="主编码（系统自动生成，格式：MAT-{分组}-{序号}）")
    code: Optional[str] = Field(None, max_length=50, description="物料编码（已废弃，保留用于向后兼容，建议使用部门编码）")
    name: str = Field(..., max_length=200, description="物料名称")
    group_id: Optional[int] = Field(None, alias="groupId", description="物料分组ID")
    specification: Optional[str] = Field(None, max_length=500, description="规格")
    base_unit: str = Field(..., alias="baseUnit", max_length=20, description="基础单位")
    units: Optional[Dict[str, Any]] = Field(None, description="多单位管理（JSON格式）")
    batch_managed: bool = Field(False, alias="batchManaged", description="是否启用批号管理")
    default_batch_rule_id: Optional[int] = Field(None, alias="defaultBatchRuleId", description="默认批号规则ID（可选）")
    serial_managed: bool = Field(False, alias="serialManaged", description="是否启用序列号管理")
    default_serial_rule_id: Optional[int] = Field(None, alias="defaultSerialRuleId", description="默认序列号规则ID（可选）")
    variant_managed: bool = Field(False, alias="variantManaged", description="是否启用属性管理")
    variant_attributes: Optional[Dict[str, Any]] = Field(None, alias="variantAttributes", description="属性（JSON格式，如颜色、尺寸等）")
    description: Optional[str] = Field(None, description="描述")
    brand: Optional[str] = Field(None, max_length=100, description="品牌")
    model: Optional[str] = Field(None, max_length=100, description="型号")
    texture: Optional[str] = Field(None, max_length=100, description="材质（如：钢、塑料、铝合金等）")
    images: Optional[List[str]] = Field(None, description="物料附件文件 UUID 列表（图片、PDF、DWG 等）")
    weight: Optional[Decimal] = Field(None, ge=0, description="重量 (kg)")
    volume: Optional[Decimal] = Field(None, ge=0, description="体积 (m³)")
    barcode: Optional[str] = Field(None, max_length=100, description="条码/GTIN/EAN")
    shelf_life_managed: bool = Field(False, alias="shelfLifeManaged", description="是否启用保质期管理")
    shelf_life_days: Optional[int] = Field(None, alias="shelfLifeDays", ge=1, description="保质期天数")
    is_giftable: bool = Field(False, alias="isGiftable", description="是否允许作为销售赠品")
    reference_cost: Optional[Decimal] = Field(None, alias="referenceCost", ge=0, description="参考成本")
    country_of_origin: Optional[str] = Field(
        None, alias="countryOfOrigin", max_length=100, description="原产国"
    )
    customs_code: Optional[str] = Field(None, alias="customsCode", max_length=50, description="海关编码")
    is_active: bool = Field(True, alias="isActive", description="是否启用")
    
    # 部门编码列表（用于创建时输入）
    department_codes: Optional[List[Dict[str, Any]]] = Field(None, alias="departmentCodes", description="部门编码列表，格式：[{'code_type': 'SALE', 'code': 'SALE-A001', 'department': '销售部'}]")
    
    # 客户编码列表（用于创建时输入）
    customer_codes: Optional[List[Dict[str, Any]]] = Field(None, alias="customerCodes", description="客户编码列表，格式：[{'customer_id': 1, 'code': 'CUST-A-PART-12345', 'description': '描述'}]")
    
    # 供应商编码列表（用于创建时输入）
    supplier_codes: Optional[List[Dict[str, Any]]] = Field(None, alias="supplierCodes", description="供应商编码列表，格式：[{'supplier_id': 1, 'code': 'SUP-B-MAT-67890', 'description': '描述'}]")
    
    # 默认值设置（用于创建时输入）
    defaults: Optional[Dict[str, Any]] = Field(None, description="默认值设置（JSON格式），包含财务、采购、销售、库存、生产的默认值")
    
    # 物料来源控制（读取可为空：历史行尚未维护；创建必填见 MaterialCreate）
    source_type: Optional[str] = Field(
        None,
        alias="sourceType",
        max_length=20,
        description="物料来源类型（Make/Buy/Outsource/Phantom/CustomerProvided/Gift/Service）",
    )
    source_config: Optional[Dict[str, Any]] = Field(None, alias="sourceConfig", description="物料来源相关配置（JSON格式），自制件含 manufacturing_mode、工艺路线、BOM等；采购件含供应商；委外件含委外供应商/工序等")
    
    # 质检选项（简易质检：只管合格数量；方案质检：与快制造质检模块联动）
    inspection_mode: Optional[str] = Field("none", alias="inspectionMode", max_length=20, description="质检模式（legacy，由 inspection_stages 同步）")
    default_inspection_plan_id: Optional[int] = Field(None, alias="defaultInspectionPlanId", description="默认质检方案ID（legacy）")
    inspection_stages: Optional[MaterialInspectionStagesSchema] = Field(
        None, alias="inspectionStages", description="分场景质检策略 JSON"
    )

    # 超报（相对工单计划数量）
    over_report_mode: str = Field("none", alias="overReportMode", max_length=20, description="超报模式：none/fixed/percent")
    over_report_value: Decimal = Field(Decimal("0"), alias="overReportValue", description="超报值：fixed 为额外数量，percent 为百分数")
    
    model_config = ConfigDict(
        populate_by_name=True,  # 允许同时使用字段名和别名
    )
    
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

    @validator("source_type")
    def normalize_source_type_optional(cls, v):
        """读取/共享字段：空则保持空；Configure 归并为 Buy；不在此强制必填。"""
        if v is None:
            return None
        raw = str(v).strip()
        if not raw:
            return None
        return normalize_material_source_type(raw)


class MaterialCreate(MaterialBase):
    """创建物料 Schema（来源类型必填且须为规范值）"""

    source_type: str = Field(
        ...,
        alias="sourceType",
        max_length=20,
        description="物料来源类型（Make/Buy/Outsource/Phantom/CustomerProvided/Gift/Service）",
    )

    @validator("source_type")
    def validate_source_type_required(cls, v):
        if v is None or not str(v).strip():
            raise ValueError("物料来源类型不能为空")
        normalized = normalize_material_source_type(v)
        if not normalized or not is_canonical_material_source_type(normalized):
            raise ValueError(f"无效的物料来源类型: {v}")
        return normalized


class MaterialUpdate(BaseModel):
    """更新物料 Schema"""
    
    # 允许请求体带回原主编码；服务层校验不可改并在落库前剔除
    main_code: Optional[str] = Field(
        None,
        alias="mainCode",
        max_length=50,
        description="主编码（创建后不可修改；可带回原值）",
    )
    code: Optional[str] = Field(None, max_length=50, description="物料编码")
    name: Optional[str] = Field(None, max_length=200, description="物料名称")
    group_id: Optional[int] = Field(None, description="物料分组ID")
    process_route_id: Optional[int] = Field(None, alias="processRouteId", description="默认工艺路线ID（自制件时使用）")
    specification: Optional[str] = Field(None, max_length=500, description="规格")
    base_unit: Optional[str] = Field(None, max_length=20, description="基础单位")
    units: Optional[Dict[str, Any]] = Field(None, description="多单位管理（JSON格式）")
    batch_managed: Optional[bool] = Field(None, description="是否启用批号管理")
    default_batch_rule_id: Optional[int] = Field(None, alias="defaultBatchRuleId", description="默认批号规则ID（可选）")
    serial_managed: Optional[bool] = Field(None, description="是否启用序列号管理")
    default_serial_rule_id: Optional[int] = Field(None, alias="defaultSerialRuleId", description="默认序列号规则ID（可选）")
    variant_managed: Optional[bool] = Field(None, description="是否启用属性管理")
    variant_attributes: Optional[Dict[str, Any]] = Field(None, description="属性（JSON格式）")
    description: Optional[str] = Field(None, description="描述")
    brand: Optional[str] = Field(None, max_length=100, description="品牌")
    model: Optional[str] = Field(None, max_length=100, description="型号")
    texture: Optional[str] = Field(None, max_length=100, description="材质")
    images: Optional[List[str]] = Field(None, description="物料附件文件 UUID 列表（图片、PDF、DWG 等）")
    weight: Optional[Decimal] = Field(None, ge=0, description="重量 (kg)")
    volume: Optional[Decimal] = Field(None, ge=0, description="体积 (m³)")
    barcode: Optional[str] = Field(None, max_length=100, description="条码/GTIN/EAN")
    shelf_life_managed: Optional[bool] = Field(None, alias="shelfLifeManaged", description="是否启用保质期管理")
    shelf_life_days: Optional[int] = Field(None, alias="shelfLifeDays", ge=1, description="保质期天数")
    is_giftable: Optional[bool] = Field(None, alias="isGiftable", description="是否允许作为销售赠品")
    reference_cost: Optional[Decimal] = Field(None, alias="referenceCost", ge=0, description="参考成本")
    country_of_origin: Optional[str] = Field(None, alias="countryOfOrigin", max_length=100, description="原产国")
    customs_code: Optional[str] = Field(None, alias="customsCode", max_length=50, description="海关编码")
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
    source_type: Optional[str] = Field(None, alias="sourceType", max_length=20, description="物料来源类型（Make/Buy/Outsource/Phantom/CustomerProvided/Gift/Service）")
    source_config: Optional[Dict[str, Any]] = Field(None, alias="sourceConfig", description="物料来源相关配置（JSON格式）")

    # 质检选项
    inspection_mode: Optional[str] = Field(None, alias="inspectionMode", max_length=20, description="质检模式（legacy）")
    default_inspection_plan_id: Optional[int] = Field(None, alias="defaultInspectionPlanId", description="默认质检方案ID（legacy）")
    inspection_stages: Optional[MaterialInspectionStagesSchema] = Field(
        None, alias="inspectionStages", description="分场景质检策略"
    )
    over_report_mode: Optional[str] = Field(None, alias="overReportMode", description="超报模式：none/fixed/percent")
    over_report_value: Optional[Decimal] = Field(None, alias="overReportValue", description="超报值")

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

    @validator("source_type")
    def validate_source_type_on_update(cls, v):
        """更新时若传入 source_type，须为规范非空值，禁止清空。"""
        if v is None:
            return None
        raw = str(v).strip()
        if not raw:
            raise ValueError("物料来源类型不能为空")
        normalized = normalize_material_source_type(raw)
        if not normalized or not is_canonical_material_source_type(normalized):
            raise ValueError(f"无效的物料来源类型: {v}")
        return normalized


class MaterialBulkTrackingRequest(BaseModel):
    """批量更新物料批号/序列号管理开关及默认规则"""

    material_uuids: List[str] = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="物料 UUID 列表",
    )
    batch_managed: Optional[bool] = Field(
        None,
        description="是否更新批号管理；未传则不改该项",
    )
    default_batch_rule_id: Optional[int] = Field(
        None,
        alias="defaultBatchRuleId",
        description="默认批号规则 ID（启用批号时可选，null 表示跟随系统默认规则）",
    )
    serial_managed: Optional[bool] = Field(
        None,
        description="是否更新序列号管理；未传则不改该项",
    )
    default_serial_rule_id: Optional[int] = Field(
        None,
        alias="defaultSerialRuleId",
        description="默认序列号规则 ID（启用序列号时可选，null 表示跟随系统默认规则）",
    )

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="after")
    def at_least_one_tracking_field(self):
        if self.batch_managed is None and self.serial_managed is None:
            raise ValueError("batch_managed 与 serial_managed 至少指定一项")
        return self


class MaterialBulkVariantRequest(BaseModel):
    """批量开启/关闭物料属性管理（不批量写入属性值）"""

    material_uuids: List[str] = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="物料 UUID 列表",
    )
    variant_managed: bool = Field(
        ...,
        alias="variantManaged",
        description="是否启用属性管理；false 时清空 variant_attributes",
    )

    model_config = ConfigDict(populate_by_name=True)


class MaterialGenerateVariantsRequest(BaseModel):
    """按属性枚举笛卡尔积批量生成属性 SKU 行"""

    attribute_names: Optional[List[str]] = Field(
        None,
        alias="attributeNames",
        description="参与组合的属性名；为空则使用全部启用的枚举型属性",
    )
    skip_existing: bool = Field(True, alias="skipExisting", description="跳过已存在的属性组合")

    model_config = ConfigDict(populate_by_name=True)


class MaterialGenerateVariantsResponse(BaseModel):
    """批量生成属性 SKU 结果"""

    created_count: int = Field(..., alias="createdCount")
    skipped_count: int = Field(..., alias="skippedCount")
    failed_count: int = Field(..., alias="failedCount")
    created_uuids: List[str] = Field(default_factory=list, alias="createdUuids")
    message: str = Field(..., description="摘要说明")

    model_config = ConfigDict(populate_by_name=True)


class MaterialMaterializeVariantRequest(BaseModel):
    """将临时属性组合物化为属性 SKU 行（查找或创建）"""

    master_material_uuid: Optional[str] = Field(None, alias="masterMaterialUuid")
    main_code: Optional[str] = Field(None, alias="mainCode")
    variant_attributes: Dict[str, Any] = Field(..., alias="variantAttributes")
    create_if_missing: bool = Field(True, alias="createIfMissing")

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="after")
    def validate_lookup_key(self) -> "MaterialMaterializeVariantRequest":
        if not self.master_material_uuid and not self.main_code:
            raise ValueError("masterMaterialUuid 与 mainCode 至少提供一个")
        if not self.variant_attributes:
            raise ValueError("variantAttributes 不能为空")
        return self


class MaterialBulkTrackingResponse(BaseModel):
    """批量更新批号/序列号管理结果"""

    updated_count: int = Field(..., description="成功更新的物料数量")
    requested_count: int = Field(..., description="请求中的 UUID 数量（去重后）")
    not_found_uuids: List[str] = Field(default_factory=list, description="未找到或未匹配的 UUID")

    model_config = ConfigDict(populate_by_name=True)


class MaterialBatchDeleteFailedItem(BaseModel):
    """批量删除物料单条失败原因"""

    uuid: str = Field(..., description="物料 UUID")
    reason: str = Field(..., description="失败原因")


class MaterialBatchDeleteRequest(BaseModel):
    """批量删除物料（软删除）"""

    material_uuids: List[str] = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="物料 UUID 列表",
    )

    model_config = ConfigDict(populate_by_name=True)


class MaterialBatchDeleteResponse(BaseModel):
    """批量删除物料结果"""

    deleted_count: int = Field(..., description="成功软删除的物料数量")
    failed_count: int = Field(..., description="失败数量（不存在或仍被 BOM 引用等）")
    failed_items: List[MaterialBatchDeleteFailedItem] = Field(
        default_factory=list,
        description="失败明细（与请求去重后的 UUID 对齐）",
    )

    model_config = ConfigDict(populate_by_name=True)


class MaterialBatchMoveGroupRequest(BaseModel):
    """批量移动物料分组"""

    material_uuids: List[str] = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="物料 UUID 列表",
    )
    group_id: int = Field(..., alias="groupId", description="目标物料分组 ID")

    model_config = ConfigDict(populate_by_name=True)


class MaterialBatchMoveGroupResponse(BaseModel):
    """批量移动物料分组结果"""

    updated_count: int = Field(..., description="成功更新的物料数量")
    requested_count: int = Field(..., description="请求中的 UUID 数量（去重后）")
    not_found_uuids: List[str] = Field(default_factory=list, description="未找到或未匹配的 UUID")

    model_config = ConfigDict(populate_by_name=True)


class MaterialBatchUpdateProcessRouteRequest(BaseModel):
    """批量更新物料工艺路线"""

    material_uuids: List[str] = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="物料 UUID 列表",
    )
    process_route_id: Optional[int] = Field(
        None,
        alias="processRouteId",
        description="工艺路线 ID；null 表示清除绑定",
    )

    model_config = ConfigDict(populate_by_name=True)


class MaterialBatchUpdateSourceTypeRequest(BaseModel):
    """批量更新物料来源类型"""

    material_uuids: List[str] = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="物料 UUID 列表",
    )
    source_type: str = Field(..., alias="sourceType", max_length=20, description="物料来源类型")

    model_config = ConfigDict(populate_by_name=True)


class MaterialBulkDefaultsPatchRequest(BaseModel):
    """批量合并更新物料 defaults JSON 中的部分字段（未传字段保持原值）。"""

    material_uuids: List[str] = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="物料 UUID 列表",
    )
    default_tax_rate: Optional[int] = Field(
        None,
        alias="defaultTaxRate",
        ge=0,
        le=100,
        description="默认税率（百分比，如 13 表示 13%）",
    )
    default_warehouse_ids: Optional[List[int]] = Field(
        None,
        alias="defaultWarehouseIds",
        description="默认仓库 ID 列表（按顺序写入 priority）；传空列表表示清除默认仓库",
    )
    safety_stock: Optional[Decimal] = Field(
        None,
        alias="safetyStock",
        ge=0,
        description="安全库存",
    )
    max_stock: Optional[Decimal] = Field(
        None,
        alias="maxStock",
        ge=0,
        description="最大库存",
    )
    default_sale_price: Optional[Decimal] = Field(
        None,
        alias="defaultSalePrice",
        ge=0,
        description="默认销售价格",
    )
    default_location: Optional[str] = Field(
        None,
        alias="defaultLocation",
        max_length=200,
        description="默认库位",
    )

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="after")
    def at_least_one_patch_field(self) -> "MaterialBulkDefaultsPatchRequest":
        if (
            self.default_tax_rate is None
            and self.default_warehouse_ids is None
            and self.safety_stock is None
            and self.max_stock is None
            and self.default_sale_price is None
            and self.default_location is None
        ):
            raise ValueError("至少指定一项要批量更新的默认值字段")
        return self


class MaterialBatchFieldUpdateResponse(BaseModel):
    """批量更新物料字段（工艺路线 / 来源类型等）结果"""

    updated_count: int = Field(..., description="成功更新的物料数量")
    requested_count: int = Field(..., description="请求中的 UUID 数量（去重后）")
    not_found_uuids: List[str] = Field(default_factory=list, description="未找到或未匹配的 UUID")

    model_config = ConfigDict(populate_by_name=True)


class MaterialBulkInspectionPatchItem(BaseModel):
    """批量更新单条物料质检选项（分场景策略 / 超报）。未传字段保持原值。"""

    material_uuid: str = Field(..., alias="materialUuid", description="物料 UUID")
    inspection_stages: Optional[MaterialInspectionStagesSchema] = Field(
        None,
        alias="inspectionStages",
        description="分场景质检策略（仅覆盖传入的场景）",
    )
    over_report_mode: Optional[str] = Field(
        None,
        alias="overReportMode",
        max_length=20,
        description="超报方式：none|fixed|percent",
    )
    over_report_value: Optional[Decimal] = Field(
        None,
        alias="overReportValue",
        ge=0,
        description="超报数值（固定值或百分比）",
    )

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="after")
    def at_least_one_patch_field(self) -> "MaterialBulkInspectionPatchItem":
        if (
            self.inspection_stages is None
            and self.over_report_mode is None
            and self.over_report_value is None
        ):
            raise ValueError("至少指定一项质检选项字段")
        return self


class MaterialBulkInspectionPatchRequest(BaseModel):
    """批量更新物料质检选项（导入 / 批量调整）。"""

    items: List[MaterialBulkInspectionPatchItem] = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="按物料的质检选项补丁列表",
    )

    model_config = ConfigDict(populate_by_name=True)


class MaterialBulkInspectionFailedItem(BaseModel):
    """批量质检选项更新失败项"""

    material_uuid: str = Field(..., alias="materialUuid", description="物料 UUID")
    reason: str = Field(..., description="失败原因")

    model_config = ConfigDict(populate_by_name=True)


class MaterialBulkInspectionPatchResponse(BaseModel):
    """批量更新物料质检选项结果"""

    updated_count: int = Field(..., description="成功更新数量")
    requested_count: int = Field(..., description="请求条目数")
    failed_items: List[MaterialBulkInspectionFailedItem] = Field(
        default_factory=list,
        description="失败明细",
    )

    model_config = ConfigDict(populate_by_name=True)


class MaterialBulkCreateFailedItem(BaseModel):
    """批量创建物料失败项（index 与请求 items 下标对齐，从 0 起）"""

    index: int = Field(..., description="请求 items 下标（从 0 起）")
    reason: str = Field(..., description="失败原因")
    main_code: Optional[str] = Field(None, alias="mainCode", description="尝试创建的主编码（若有）")

    model_config = ConfigDict(populate_by_name=True)


class MaterialBulkCreateRequest(BaseModel):
    """批量创建物料（导入分片；单次建议 ≤200，避免网关超时）"""

    items: List[MaterialCreate] = Field(
        ...,
        min_length=1,
        max_length=200,
        description="待创建物料列表（单次最多 200）",
    )

    model_config = ConfigDict(populate_by_name=True)


class MaterialBulkCreateResponse(BaseModel):
    """批量创建物料结果"""

    created_count: int = Field(..., alias="createdCount", description="成功创建数量")
    failed_count: int = Field(..., alias="failedCount", description="失败数量")
    requested_count: int = Field(..., alias="requestedCount", description="请求条目数")
    created_uuids: List[str] = Field(
        default_factory=list,
        alias="createdUuids",
        description="成功创建的物料 UUID",
    )
    failed_items: List[MaterialBulkCreateFailedItem] = Field(
        default_factory=list,
        alias="failedItems",
        description="失败明细",
    )

    model_config = ConfigDict(populate_by_name=True, by_alias=True)


class MaterialRewriteMainCodesFailedItem(BaseModel):
    """试运营模式：重写物料主编码单条失败原因"""

    uuid: str = Field(..., description="物料 UUID")
    reason: str = Field(..., description="失败原因")


class MaterialRewriteMainCodesRequest(BaseModel):
    """按物料所属末级分组编号重写主编码"""

    material_uuids: Optional[List[str]] = Field(
        None,
        max_length=2000,
        description="物料 UUID 列表；与 groupId 二选一或同时提供时优先使用本列表",
    )
    group_id: Optional[int] = Field(
        None,
        alias="groupId",
        description="物料分组 ID：重写该分组及子分组下全部物料（无 material_uuids 时生效）",
    )
    reset_sequence: bool = Field(
        False,
        description="重写前是否按末级分组重置各分组的流水号（从初始值重新计数）",
    )

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="after")
    def _validate_scope(self) -> "MaterialRewriteMainCodesRequest":
        uuids = [u for u in (self.material_uuids or []) if u and str(u).strip()]
        if not uuids and self.group_id is None:
            raise ValueError("请提供 material_uuids 或 groupId")
        return self


class MaterialRewriteMainCodesResponse(BaseModel):
    """试运营模式：重写物料主编码结果"""

    updated_count: int = Field(..., description="成功重写的主编码族数量（含属性变体族）")
    updated_material_count: int = Field(..., description="实际更新的物料行数")
    requested_count: int = Field(..., description="请求范围内待处理的物料数量")
    failed_count: int = Field(..., description="失败条数")
    failed_items: List[MaterialRewriteMainCodesFailedItem] = Field(
        default_factory=list,
        description="失败明细",
    )

    model_config = ConfigDict(populate_by_name=True)


class MaterialCodeAliasResponse(BaseModel):
    """物料编码别名响应 Schema"""
    
    id: int = Field(..., description="主键ID")
    code_type: str = Field(..., alias="codeType", description="编码类型")
    code: str = Field(..., description="编码（部门编码、客户编码或供应商编码）")
    department: Optional[str] = Field(None, description="部门名称（可选，用于部门编码）")
    external_entity_type: Optional[str] = Field(
        None, alias="externalEntityType", description="外部实体类型（customer/supplier，用于客户编码和供应商编码）"
    )
    external_entity_id: Optional[int] = Field(
        None, alias="externalEntityId", description="外部实体ID（客户ID或供应商ID）"
    )
    description: Optional[str] = Field(None, description="描述")
    name: Optional[str] = Field(None, description="名称（客户品名/供应商品名等）")
    is_primary: bool = Field(False, alias="isPrimary", description="是否为主要编码")
    
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


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
    created_by_name: Optional[str] = Field(None, alias="createdByName", description="创建人姓名")
    updated_by_name: Optional[str] = Field(None, alias="updatedByName", description="更新人姓名")
    deleted_at: Optional[datetime] = Field(None, alias="deletedAt", description="删除时间")
    is_active: bool = Field(True, alias="isActive", description="是否启用")
    
    # 默认值设置（从数据库加载）
    defaults: Optional[Dict[str, Any]] = Field(None, description="默认值设置（JSON格式）")
    
    # 质检选项
    inspection_mode: Optional[str] = Field("none", alias="inspectionMode", description="质检模式（legacy）")
    default_inspection_plan_id: Optional[int] = Field(None, alias="defaultInspectionPlanId", description="默认质检方案ID（legacy）")
    default_inspection_plan_name: Optional[str] = Field(None, alias="defaultInspectionPlanName", description="默认质检方案名称（冗余）")
    inspection_stages: Optional[MaterialInspectionStagesSchema] = Field(
        None, alias="inspectionStages", description="分场景质检策略"
    )
    
    # 编码别名列表（可选，需要时加载）
    code_aliases: Optional[List[MaterialCodeAliasResponse]] = Field(None, description="编码别名列表")

    # 树形列表：属性 SKU 子行（仅 treeView 请求时填充）
    children: Optional[List["MaterialResponse"]] = Field(None, description="属性 SKU 子行")
    
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        by_alias=True
    )


MaterialResponse.model_rebuild()


class MaterialMaterializeVariantResponse(BaseModel):
    """物化属性组合结果"""

    material: MaterialResponse
    created: bool = Field(..., description="是否新建 SKU 行")
    matched_existing: bool = Field(..., alias="matchedExisting", description="是否匹配已有 SKU")

    model_config = ConfigDict(populate_by_name=True)


# ==================== 级联查询响应 Schema ====================

class MaterialTreeResponse(MaterialResponse):
    """物料树形响应 Schema（用于级联查询）"""
    pass


class MaterialGroupTreeResponse(MaterialGroupResponse):
    """物料分组树形响应 Schema（用于级联查询）"""
    
    children: List["MaterialGroupTreeResponse"] = Field(default_factory=list, alias="children", description="子分组列表")
    materials: List[MaterialTreeResponse] = Field(default_factory=list, alias="materials", description="物料列表")
    material_count: int = Field(
        0,
        alias="materialCount",
        description="本组及下级树形列表主行数（主物料 + 主物料不在范围内的孤儿属性 SKU）",
    )
    
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        by_alias=True
    )


class MaterialGroupTreeListResponse(BaseModel):
    """物料分组树列表响应（含未分组/合计数量）"""

    items: List[MaterialGroupTreeResponse] = Field(default_factory=list, description="根分组树")
    ungrouped_material_count: int = Field(
        0,
        alias="ungroupedMaterialCount",
        description="未分组物料数量",
    )
    total_material_count: int = Field(
        0,
        alias="totalMaterialCount",
        description="全部物料数量（含未分组）",
    )

    model_config = ConfigDict(
        populate_by_name=True,
        by_alias=True,
    )


class BOMBase(BaseModel):
    """
    BOM基础 Schema
    
    根据《工艺路线和标准作业流程优化设计规范.md》设计。
    """
    
    material_id: int = Field(..., description="主物料ID（父件）")
    component_id: int = Field(..., description="子物料ID（子件）")
    quantity: Decimal = Field(..., description="用量（必填，数字）")
    base_quantity: Decimal = Field(
        default=Decimal("1"),
        description="基准数量（本版本用量对应的成品基数）",
    )
    unit: Optional[str] = Field(None, max_length=20, description="单位（可选，如：个、kg、m等）")
    
    # 损耗率和必选标识（根据优化设计规范新增）
    waste_rate: Decimal = Field(
        default=Decimal("0.00"),
        description="损耗率（百分比，如：5.00表示5%，用于计算实际用料数量）"
    )
    is_required: bool = Field(default=True, description="是否必选（是/否，默认：是）")
    issue_method: str = Field(
        default="pick",
        max_length=20,
        description="发料方式：pick=领料配料, backflush=倒冲, none=不发料",
    )
    level: int = Field(default=0, description="层级深度（0为顶层，用于多层级BOM展开）")
    path: Optional[str] = Field(None, max_length=500, description="层级路径（如：1/2/3，用于快速查询和排序）")
    
    # 版本控制
    version: str = Field("1.0", max_length=50, description="BOM版本号")
    bom_code: Optional[str] = Field(None, max_length=100, description="BOM编码")
    bom_name: Optional[str] = Field(None, max_length=200, description="BOM名称（可空）")
    is_default: bool = Field(False, description="是否为默认版本（每个物料至多一个）")
    
    # 有效期管理
    effective_date: Optional[datetime] = Field(None, description="生效日期")
    expiry_date: Optional[datetime] = Field(None, description="失效日期")
    
    # 失效标记（人为设为失效）
    is_obsolete: bool = Field(False, description="是否已失效（人为设置）")
    obsoleted_at: Optional[datetime] = Field(None, description="失效时间")
    obsolete_reason: Optional[str] = Field(None, max_length=500, description="失效原因")
    
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
    
    # 配置位管理（与替代料互斥）
    is_configurable: bool = Field(False, description="是否为配置位（用户在下单/开工单时选择）")
    configurable_group_id: Optional[int] = Field(None, description="配置位组ID（同组多行=该位置的可选物料）")
    is_default_configurable: bool = Field(False, description="配置位组内是否为默认选项")
    
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

    @validator("base_quantity")
    def validate_base_quantity(cls, v):
        """验证基准数量"""
        if v is None:
            return Decimal("1")
        if v <= 0:
            raise ValueError("基准数量必须大于0")
        return v

    @validator("bom_name")
    def validate_bom_name(cls, v):
        if v is None:
            return None
        stripped = str(v).strip()
        return stripped or None
    
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
    
    @model_validator(mode="after")
    def validate_configurable_vs_alternative(self):
        """配置位与替代料互斥"""
        if self.is_configurable and self.is_alternative:
            raise ValueError("配置位与替代料互斥，不能同时启用")
        return self


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
    is_required: Optional[bool] = Field(None, description="是否必选")
    issue_method: Optional[str] = Field(
        None,
        max_length=20,
        description="发料方式：pick=领料配料, backflush=倒冲, none=不发料",
    )
    
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
    
    # 失效标记
    is_obsolete: Optional[bool] = Field(None, description="是否已失效")
    obsoleted_at: Optional[datetime] = Field(None, description="失效时间")
    obsolete_reason: Optional[str] = Field(None, max_length=500, description="失效原因")
    
    # 替代料管理
    is_alternative: Optional[bool] = Field(None, description="是否为替代料")
    alternative_group_id: Optional[int] = Field(None, description="替代料组ID")
    priority: Optional[int] = Field(None, description="优先级")
    
    # 配置位管理
    is_configurable: Optional[bool] = Field(None, description="是否为配置位")
    configurable_group_id: Optional[int] = Field(None, description="配置位组ID")
    is_default_configurable: Optional[bool] = Field(None, description="配置位组内是否为默认选项")
    
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
    
    @validator("expiry_date")
    def validate_expiry_date(cls, v, values):
        """验证失效日期必须晚于生效日期"""
        if v and "effective_date" in values and values.get("effective_date"):
            if v <= values["effective_date"]:
                raise ValueError("失效日期必须晚于生效日期")
        return v

    @model_validator(mode="after")
    def validate_configurable_vs_alternative(self):
        """配置位与替代料互斥"""
        is_alt = self.is_alternative if self.is_alternative is not None else False
        is_cfg = self.is_configurable if self.is_configurable is not None else False
        if is_alt and is_cfg:
            raise ValueError("配置位与替代料互斥，不能同时启用")
        return self


class BOMResponse(BOMBase):
    """BOM响应 Schema"""
    
    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    created_by: Optional[int] = Field(None, description="创建人ID")
    created_by_name: Optional[str] = Field(None, description="创建人姓名")
    updated_by: Optional[int] = Field(None, description="更新人ID")
    updated_by_name: Optional[str] = Field(None, description="更新人姓名")
    deleted_at: Optional[datetime] = Field(None, description="删除时间")
    
    class Config:
        from_attributes = True


class BOMGroupSummary(BaseModel):
    """BOM 分组摘要（按 material_id + version 一组，用于列表树按需加载）"""
    material_id: int = Field(..., description="主物料ID")
    version: str = Field(..., description="版本号")
    bom_code: Optional[str] = Field(None, max_length=100, description="BOM编码")
    approval_status: str = Field(..., description="审核状态")
    is_default: bool = Field(False, description="是否默认版本")
    is_obsolete: bool = Field(False, description="是否已失效")
    item_count: int = Field(..., description="该版本子件数量")
    bom_name: Optional[str] = Field(None, description="BOM名称")
    base_quantity: Optional[Decimal] = Field(None, description="基准数量")


class BOMGroupListResponse(BaseModel):
    """BOM 分组列表（按主物料分页，data 含该页物料的全部版本）"""
    data: List[BOMGroupSummary]
    total: int
    success: bool = True


class BOMMaterialVersionItem(BaseModel):
    """批量拉取 BOM 子件时的 (material_id, version) 项"""
    material_id: int = Field(..., description="主物料ID")
    version: str = Field("1.0", description="版本号")


class BOMBatchItemsRequest(BaseModel):
    """批量按物料+版本拉取 BOM 子件明细的请求体"""
    items: List[BOMMaterialVersionItem] = Field(..., description="(material_id, version) 列表")
    include_obsolete: bool = Field(False, description="是否包含已失效版本")


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
    issue_method: str = Field(
        default="pick",
        max_length=20,
        description="发料方式：pick=领料配料, backflush=倒冲, none=不发料",
    )
    
    is_alternative: bool = Field(False, description="是否为替代料")
    alternative_group_id: Optional[int] = Field(None, description="替代料组ID")
    priority: int = Field(0, description="优先级（数字越小优先级越高）")
    is_configurable: bool = Field(False, description="是否为配置位")
    configurable_group_id: Optional[int] = Field(None, description="配置位组ID")
    is_default_configurable: bool = Field(False, description="配置位组内是否为默认选项")
    description: Optional[str] = Field(None, description="描述")
    remark: Optional[str] = Field(None, description="备注")
    source_type: Optional[str] = Field(
        None,
        max_length=20,
        description="已废弃：子件来源类型以物料主数据为唯一真源，本字段不再参与回写",
    )

    @model_validator(mode="after")
    def validate_configurable_vs_alternative(self):
        """配置位与替代料互斥"""
        if self.is_configurable and self.is_alternative:
            raise ValueError("配置位与替代料互斥，不能同时启用")
        return self
    
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

    @validator("source_type")
    def validate_source_type(cls, v):
        """更新时若传入 source_type，须为规范非空值，禁止清空。"""
        if v is None:
            return None
        raw = str(v).strip()
        if not raw:
            raise ValueError("物料来源类型不能为空")
        normalized = normalize_material_source_type(raw)
        if not normalized or not is_canonical_material_source_type(normalized):
            raise ValueError(f"无效的物料来源类型: {raw}")
        return normalized


class BOMBatchCreate(BaseModel):
    """批量创建BOM Schema"""
    
    material_id: int = Field(..., description="主物料ID")
    items: List[BOMItemCreate] = Field(..., min_items=1, description="子物料项列表")
    base_quantity: Decimal = Field(
        default=Decimal("1"),
        gt=0,
        description="基准数量（本版本用量对应的成品基数）",
    )
    
    # 版本控制
    version: str = Field("1.0", max_length=50, description="BOM版本号")
    bom_code: Optional[str] = Field(None, max_length=100, description="BOM编码")
    
    # 有效期管理
    effective_date: Optional[datetime] = Field(None, description="生效日期")
    expiry_date: Optional[datetime] = Field(None, description="失效日期")
    
    # 扩展信息
    description: Optional[str] = Field(None, description="描述")
    remark: Optional[str] = Field(None, description="备注")
    is_active: bool = Field(True, description="是否启用")
    bom_name: Optional[str] = Field(None, max_length=200, description="BOM名称（可空，未传则自动生成）")
    
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
    version: Optional[str] = Field(None, max_length=50, description="BOM版本号（可选，同父件须一致）")
    bom_code: Optional[str] = Field(None, max_length=100, description="BOM编号（可选，同父件须一致）")
    bom_name: Optional[str] = Field(None, max_length=200, description="BOM名称（可选，同父件须一致，可空）")
    component_code: str = Field(..., description="子件编码（支持任意部门编码：PROD-A001、主编码MAT-SEMI-0001）")
    quantity: Decimal = Field(..., description="子件数量（必填，数字）")
    base_quantity: Optional[Decimal] = Field(
        None,
        description="基准数量（可选，同父件须一致；未填则用导入批次默认值）",
    )
    unit: Optional[str] = Field(None, description="子件单位（可选，如：个、kg、m等）")
    waste_rate: Optional[Decimal] = Field(None, description="损耗率（可选，百分比，如：5%表示5.00）")
    is_required: Optional[bool] = Field(True, description="是否必选（可选，是/否，默认：是）")
    is_active: Optional[bool] = Field(True, description="是否启用（可选，是/否，默认：是）")
    is_configurable: Optional[bool] = Field(False, description="是否为配置位（用户在下单/开工单时选择）")
    configurable_group_id: Optional[int] = Field(None, description="配置位组ID（同组多行=该位置的可选物料）")
    is_default_configurable: Optional[bool] = Field(False, description="配置位组内是否为默认选项")
    is_alternative: Optional[bool] = Field(False, description="是否为替代料（同组替代料生产时择一）")
    alternative_group_id: Optional[int] = Field(None, description="替代料组ID（同组填相同ID）")
    priority: Optional[int] = Field(0, description="优先级（数字越小越优先，替代料顺序）")
    issue_method: Optional[str] = Field(
        "pick",
        max_length=20,
        description="发料方式：pick=领料配料, backflush=倒冲, none=不发料",
    )
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

    @validator("issue_method")
    def validate_issue_method(cls, v):
        if v is None:
            return "pick"
        im = str(v).strip().lower()
        if im not in ("pick", "backflush", "none"):
            raise ValueError("发料方式必须为 pick、backflush 或 none")
        return im


class BOMBatchImport(BaseModel):
    """
    BOM批量导入 Schema（用于universheet批量导入）
    
    根据《工艺路线和标准作业流程优化设计规范.md》设计。
    支持使用任意部门编码，系统自动映射到主编码。
    """
    
    items: List[BOMBatchImportItem] = Field(..., min_items=1, description="BOM导入项列表")
    base_quantity: Decimal = Field(
        default=Decimal("1"),
        gt=0,
        description="基准数量（本版本用量对应的成品基数，行级未指定时使用）",
    )
    version: Optional[str] = Field("1.0", max_length=50, description="BOM版本号（可选，默认：1.0）")
    bom_code: Optional[str] = Field(None, max_length=100, description="BOM编码（可选）")
    bom_name: Optional[str] = Field(None, max_length=200, description="BOM名称（可空，未传则自动生成）")
    effective_date: Optional[datetime] = Field(None, description="生效日期（可选）")
    description: Optional[str] = Field(None, description="描述（可选）")
    version_remark: Optional[str] = Field(None, description="版本变更备注（可选，写入本版本所有BOM行）")
    
    @validator("items")
    def validate_items(cls, v):
        """验证导入项列表"""
        if not v or len(v) == 0:
            raise ValueError("至少需要添加一个BOM导入项")
        return v


RelationImportEntity = Literal["material", "processRoute", "operation", "performance"]
RelationImportWriteStrategy = Literal["upsert", "create_only", "link_only", "strict_fail"]


class BOMRelationImportRequest(BaseModel):
    """BOM 高级关联导入请求。"""

    rows: List[List[str]] = Field(..., min_items=1, description="二维表数据，含表头与示例行")
    entities: List[RelationImportEntity] = Field(
        default_factory=list,
        description="参与关联导入的实体：material/processRoute/operation/performance",
    )
    write_strategy: RelationImportWriteStrategy = Field(
        "upsert",
        description="写入策略：upsert/create_only/link_only/strict_fail",
    )
    dry_run: bool = Field(False, description="是否仅预检")

    @validator("entities")
    def validate_entities(cls, v):
        if not v:
            raise ValueError("至少选择一个关联实体")
        return list(dict.fromkeys(v))


class BOMRelationImportSummary(BaseModel):
    created: int = Field(0, description="新增条数")
    updated: int = Field(0, description="更新条数")
    linked: int = Field(0, description="关联条数")
    failed: int = Field(0, description="失败条数")


class BOMRelationImportResponse(BaseModel):
    success: bool = Field(True, description="是否成功")
    message: Optional[str] = Field(None, description="提示消息")
    summary: BOMRelationImportSummary = Field(default_factory=BOMRelationImportSummary, description="汇总")
    errors: List[str] = Field(default_factory=list, description="错误列表")
    warnings: List[str] = Field(default_factory=list, description="警告列表")


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
    created_by: Optional[int] = Field(None, description="创建人ID")
    created_by_name: Optional[str] = Field(None, description="创建人姓名")
    updated_by: Optional[int] = Field(None, description="更新人ID")
    updated_by_name: Optional[str] = Field(None, description="更新人姓名")
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
    
    material_uuid: str = Field(..., alias="materialUuid", description="物料UUID")
    batch_no: str = Field(..., alias="batchNo", max_length=100, description="批号（必填，同一物料下唯一）")
    production_date: Optional[date] = Field(None, alias="productionDate", description="生产日期（可选）")
    expiry_date: Optional[date] = Field(None, alias="expiryDate", description="有效期（可选，用于有保质期的物料）")
    supplier_batch_no: Optional[str] = Field(None, alias="supplierBatchNo", max_length=100, description="供应商批号（可选）")
    quantity: Decimal = Field(0, description="批号数量（当前库存数量）")
    status: str = Field("in_stock", description="批号状态（在库、已出库、已过期、已报废等）")
    quality_status: str = Field(
        "qualified",
        alias="qualityStatus",
        description="库存质量态（qualified=可售放行, pending_qc=待检, quarantine=隔离, unqualified=不合格未处置）",
    )
    remark: Optional[str] = Field(None, description="备注（可选）")

    model_config = ConfigDict(populate_by_name=True)


class MaterialBatchCreate(MaterialBatchBase):
    """创建物料批号 Schema"""
    pass


class MaterialBatchUpdate(BaseModel):
    """更新物料批号 Schema"""
    
    production_date: Optional[date] = Field(None, alias="productionDate", description="生产日期（可选）")
    expiry_date: Optional[date] = Field(None, alias="expiryDate", description="有效期（可选）")
    supplier_batch_no: Optional[str] = Field(None, alias="supplierBatchNo", max_length=100, description="供应商批号（可选）")
    quantity: Optional[Decimal] = Field(None, description="批号数量（当前库存数量）")
    status: Optional[str] = Field(None, description="批号状态")
    remark: Optional[str] = Field(None, description="备注（可选）")

    model_config = ConfigDict(populate_by_name=True)


class GenerateBatchNoRequest(BaseModel):
    """
    生成批号请求（使用 JSON Body，避免仅依赖 Query 时在 POST 上被代理/网关丢弃 preview 参数）。
    """

    material_uuid: str = Field(..., description="物料UUID")
    rule_id: Optional[int] = Field(None, description="批号规则ID（可选，优先于物料默认规则）")
    rule_uuid: Optional[str] = Field(None, description="批号规则UUID（可选）")
    supplier_code: Optional[str] = Field(None, description="供应商编码（可选，用于规则变量）")
    preview: bool = Field(False, description="为 True 时不占用流水号，仅用于界面预览")
    preview_offset: int = Field(0, ge=0, description="预览时同一单据内多行同物料递增值（0,1,2…）")


class MaterialBatchResponse(MaterialBatchBase):
    """物料批号响应 Schema"""
    
    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: int = Field(..., alias="tenantId", description="租户ID")
    material_id: int = Field(..., alias="materialId", description="物料ID")
    material_name: Optional[str] = Field(None, alias="materialName", description="物料名称")
    material_code: Optional[str] = Field(None, alias="materialCode", description="物料编码")
    material_model: Optional[str] = Field(None, alias="materialModel", description="物料型号")
    created_at: datetime = Field(..., alias="createdAt", description="创建时间")
    updated_at: datetime = Field(..., alias="updatedAt", description="更新时间")
    created_by_name: Optional[str] = Field(None, alias="createdByName", description="创建人姓名")
    updated_by_name: Optional[str] = Field(None, alias="updatedByName", description="更新人姓名")
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
    
    material_uuid: str = Field(..., alias="materialUuid", description="物料UUID")
    serial_no: str = Field(..., alias="serialNo", max_length=100, description="序列号（必填，全局唯一）")
    production_date: Optional[date] = Field(None, alias="productionDate", description="生产日期（可选）")
    factory_date: Optional[date] = Field(None, alias="factoryDate", description="出厂日期（可选）")
    supplier_serial_no: Optional[str] = Field(None, alias="supplierSerialNo", max_length=100, description="供应商序列号（可选）")
    status: str = Field("in_stock", description="序列号状态（在库、已出库、已销售、已报废、已退货等）")
    remark: Optional[str] = Field(None, description="备注（可选）")

    model_config = ConfigDict(populate_by_name=True)


class MaterialSerialCreate(MaterialSerialBase):
    """创建物料序列号 Schema"""
    pass


class MaterialSerialUpdate(BaseModel):
    """更新物料序列号 Schema"""
    
    production_date: Optional[date] = Field(None, alias="productionDate", description="生产日期（可选）")
    factory_date: Optional[date] = Field(None, alias="factoryDate", description="出厂日期（可选）")
    supplier_serial_no: Optional[str] = Field(None, alias="supplierSerialNo", max_length=100, description="供应商序列号（可选）")
    status: Optional[str] = Field(None, description="序列号状态")
    remark: Optional[str] = Field(None, description="备注（可选）")

    model_config = ConfigDict(populate_by_name=True)


class MaterialSerialResponse(MaterialSerialBase):
    """物料序列号响应 Schema"""
    
    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: int = Field(..., alias="tenantId", description="租户ID")
    material_id: int = Field(..., alias="materialId", description="物料ID")
    material_name: Optional[str] = Field(None, alias="materialName", description="物料名称")
    material_code: Optional[str] = Field(None, alias="materialCode", description="物料编码")
    material_model: Optional[str] = Field(None, alias="materialModel", description="物料型号")
    created_at: datetime = Field(..., alias="createdAt", description="创建时间")
    updated_at: datetime = Field(..., alias="updatedAt", description="更新时间")
    created_by_name: Optional[str] = Field(None, alias="createdByName", description="创建人姓名")
    updated_by_name: Optional[str] = Field(None, alias="updatedByName", description="更新人姓名")
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


class MaterialListResponse(BaseModel):
    """物料列表响应 Schema"""
    
    items: List[MaterialResponse] = Field(..., description="物料列表")
    total: int = Field(..., description="总数")

    model_config = ConfigDict(
        populate_by_name=True,
        by_alias=True
    )

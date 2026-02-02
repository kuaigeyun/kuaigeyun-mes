"""
模具模型模块

定义模具和模具使用记录数据模型，支持多组织隔离。

Author: Luigi Lu
Date: 2026-01-05
"""

from tortoise import fields
from core.models.base import BaseModel


class Mold(BaseModel):
    """
    模具模型
    
    用于管理模具基础信息，支持多组织隔离。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        code: 模具编码（组织内唯一）
        name: 模具名称
        type: 模具类型（注塑模具、压铸模具、冲压模具、其他）
        category: 模具分类
        brand: 品牌
        model: 型号
        serial_number: 序列号
        manufacturer: 制造商
        supplier: 供应商
        purchase_date: 采购日期
        installation_date: 安装日期
        warranty_period: 保修期（月）
        technical_parameters: 技术参数（JSON格式）
        status: 模具状态（正常、维修中、停用、报废）
        total_usage_count: 累计使用次数
        is_active: 是否启用
        description: 描述
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "core_molds"
        indexes = [
            ("tenant_id",),
            ("code",),
            ("uuid",),
            ("type",),
            ("status",),
        ]
        unique_together = [("tenant_id", "code")]
    
    # 主键（BaseModel 不包含 id 字段，需要自己定义）
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    code = fields.CharField(max_length=50, description="模具编码（组织内唯一）")
    name = fields.CharField(max_length=200, description="模具名称")
    type = fields.CharField(max_length=50, null=True, description="模具类型（注塑模具、压铸模具、冲压模具、其他）")
    category = fields.CharField(max_length=50, null=True, description="模具分类")
    
    # 模具详细信息
    brand = fields.CharField(max_length=100, null=True, description="品牌")
    model = fields.CharField(max_length=100, null=True, description="型号")
    serial_number = fields.CharField(max_length=100, null=True, description="序列号")
    manufacturer = fields.CharField(max_length=200, null=True, description="制造商")
    supplier = fields.CharField(max_length=200, null=True, description="供应商")
    
    # 日期信息
    purchase_date = fields.DateField(null=True, description="采购日期")
    installation_date = fields.DateField(null=True, description="安装日期")
    warranty_period = fields.IntField(null=True, description="保修期（月）")
    
    # 技术参数（JSON格式）
    technical_parameters = fields.JSONField(null=True, description="技术参数（JSON格式）")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="正常", description="模具状态（正常、维修中、停用、校验中、报废）")
    total_usage_count = fields.IntField(default=0, description="累计使用次数")
    is_active = fields.BooleanField(default=True, description="是否启用")
    
    # 维保及校验扩展
    maintenance_interval = fields.IntField(null=True, description="保养间隔（使用次数）")
    needs_calibration = fields.BooleanField(default=False, description="是否需要校验")
    calibration_period = fields.IntField(null=True, description="校验周期（天）")
    last_calibration_date = fields.DateField(null=True, description="上次校验日期")
    next_calibration_date = fields.DateField(null=True, description="下次校验日期")
    
    description = fields.TextField(null=True, description="描述")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.code} - {self.name}"


class MoldUsage(BaseModel):
    """
    模具使用记录模型
    
    用于管理模具使用记录，支持多组织隔离。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        usage_no: 使用记录编号（组织内唯一）
        mold_id: 模具ID（关联模具）
        mold_uuid: 模具UUID
        mold_name: 模具名称
        mold_code: 模具编码
        source_type: 来源类型（生产订单、工单）
        source_id: 来源ID
        source_no: 来源编号
        usage_date: 使用日期
        usage_count: 使用次数
        operator_id: 操作人员ID（用户ID）
        operator_name: 操作人员姓名
        status: 使用状态（使用中、已归还、已报废）
        return_date: 归还日期
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "core_mold_usages"
        indexes = [
            ("tenant_id",),
            ("usage_no",),
            ("mold_id",),
            ("mold_uuid",),
            ("source_type",),
            ("usage_date",),
            ("status",),
        ]
        unique_together = [("tenant_id", "usage_no")]
    
    # 主键（BaseModel 不包含 id 字段，需要自己定义）
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    usage_no = fields.CharField(max_length=100, description="使用记录编号（组织内唯一）")
    
    # 关联模具
    mold_id = fields.IntField(description="模具ID（关联模具）")
    mold_uuid = fields.CharField(max_length=36, description="模具UUID")
    mold_name = fields.CharField(max_length=200, description="模具名称")
    mold_code = fields.CharField(max_length=100, null=True, description="模具编码")
    
    # 来源信息
    source_type = fields.CharField(max_length=50, null=True, description="来源类型（生产订单、工单）")
    source_id = fields.IntField(null=True, description="来源ID")
    source_no = fields.CharField(max_length=100, null=True, description="来源编号")
    
    # 使用信息
    usage_date = fields.DatetimeField(description="使用日期")
    usage_count = fields.IntField(default=1, description="使用次数")
    operator_id = fields.IntField(null=True, description="操作人员ID（用户ID）")
    operator_name = fields.CharField(max_length=100, null=True, description="操作人员姓名")
    
    # 状态
    status = fields.CharField(max_length=50, default="使用中", description="使用状态（使用中、已归还、已报废）")
    return_date = fields.DatetimeField(null=True, description="归还日期")
    remark = fields.TextField(null=True, description="备注")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.usage_no} - {self.mold_name}"


class MoldCalibration(BaseModel):
    """
    模具校验记录
    """
    class Meta:
        table = "core_mold_calibrations"
        indexes = [("tenant_id",), ("mold_id",), ("calibration_date",)]

    id = fields.IntField(pk=True)
    mold_id = fields.IntField()
    mold_uuid = fields.CharField(max_length=36)
    calibration_date = fields.DateField(description="校验日期")
    result = fields.CharField(max_length=50, description="校验结果（合格、不合格、准用）")
    certificate_no = fields.CharField(max_length=100, null=True, description="证书编号")
    expiry_date = fields.DateField(null=True, description="有效期至")
    attachment_uuid = fields.CharField(max_length=36, null=True, description="附件ID")
    remark = fields.TextField(null=True)
    deleted_at = fields.DatetimeField(null=True)


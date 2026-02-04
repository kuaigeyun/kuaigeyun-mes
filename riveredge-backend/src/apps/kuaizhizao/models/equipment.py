"""
设备模型模块

定义设备数据模型，支持多组织隔离。

Author: Luigi Lu
Date: 2026-01-05
"""

from tortoise import fields
from typing import Optional, Dict, Any
from core.models.base import BaseModel


class Equipment(BaseModel):
    """
    设备模型
    
    用于管理生产设备的基础信息，包括设备编码、名称、类型、技术参数、供应商信息等。
    支持多组织隔离，每个组织的设备相互独立。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        code: 设备编码（组织内唯一）
        name: 设备名称
        type: 设备类型（如：加工设备、检测设备、包装设备等）
        category: 设备分类（如：CNC、注塑机、冲压机等）
        brand: 品牌
        model: 型号
        serial_number: 序列号
        manufacturer: 制造商
        supplier: 供应商
        purchase_date: 采购日期
        installation_date: 安装日期
        warranty_period: 保修期（月）
        technical_parameters: 技术参数（JSON格式）
        workstation_id: 关联工位ID（可选，关联到工位）
        workstation_code: 工位编码
        workstation_name: 工位名称
        status: 设备状态（正常、维修中、停用、报废）
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
        table = "apps_kuaizhizao_equipment"
        table_description = "快格轻制造 - 设备"
        indexes = [
            ("tenant_id",),
            ("code",),
            ("uuid",),
            ("type",),
            ("category",),
            ("workstation_id",),
            ("work_center_id",),
            ("status",),
        ]
        unique_together = [("tenant_id", "code")]
    
    # 主键（BaseModel 不包含 id 字段，需要自己定义）
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    code = fields.CharField(max_length=50, description="设备编码（组织内唯一）")
    name = fields.CharField(max_length=200, description="设备名称")
    type = fields.CharField(max_length=50, null=True, description="设备类型（如：加工设备、检测设备、包装设备等）")
    category = fields.CharField(max_length=50, null=True, description="设备分类（如：CNC、注塑机、冲压机等）")
    
    # 设备详细信息
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
    
    # 关联工位（可选）
    workstation_id = fields.IntField(null=True, description="关联工位ID（可选，关联到工位）")
    workstation_code = fields.CharField(max_length=50, null=True, description="工位编码")
    workstation_name = fields.CharField(max_length=200, null=True, description="工位名称")
    
    # 关联工作中心（可选）
    work_center_id = fields.IntField(null=True, description="关联工作中心ID（可选，关联到工作中心）")
    work_center_code = fields.CharField(max_length=50, null=True, description="工作中心编码")
    work_center_name = fields.CharField(max_length=200, null=True, description="工作中心名称")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="正常", description="设备状态（正常、维修中、停用、校验中、报废）")
    is_active = fields.BooleanField(default=True, description="是否启用")
    
    # 运行及校验扩展
    total_running_hours = fields.IntField(default=0, description="累计运行小时数")
    total_cycle_count = fields.IntField(default=0, description="累计循环次数/冲压次数")
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


class EquipmentCalibration(BaseModel):
    """
    设备校验/计量记录
    """
    class Meta:
        table = "apps_kuaizhizao_equipment_calibrations"
        table_description = "快格轻制造 - 设备校准记录"
        indexes = [("tenant_id",), ("equipment_id",), ("calibration_date",)]

    id = fields.IntField(pk=True)
    equipment_id = fields.IntField()
    equipment_uuid = fields.CharField(max_length=36)
    calibration_date = fields.DateField(description="校验日期")
    result = fields.CharField(max_length=50, description="校验结果（合格、不合格、限制使用）")
    certificate_no = fields.CharField(max_length=100, null=True, description="证书编号")
    expiry_date = fields.DateField(null=True, description="有效期至")
    attachment_uuid = fields.CharField(max_length=36, null=True, description="报告附件ID")
    remark = fields.TextField(null=True)
    deleted_at = fields.DatetimeField(null=True)


"""
设备故障维修模型模块

定义设备故障和维修记录数据模型，支持多组织隔离。

Author: Luigi Lu
Date: 2026-01-05
"""

from tortoise import fields
from core.models.base import BaseModel


class EquipmentFault(BaseModel):
    """
    设备故障记录模型
    
    用于管理设备故障记录，支持多组织隔离。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        fault_no: 故障记录编号（组织内唯一）
        equipment_id: 设备ID（关联设备）
        equipment_uuid: 设备UUID
        equipment_name: 设备名称
        fault_date: 故障发生日期
        fault_type: 故障类型（机械故障、电气故障、软件故障、其他）
        fault_description: 故障描述
        fault_level: 故障级别（轻微、一般、严重、紧急）
        reporter_id: 报告人ID（用户ID）
        reporter_name: 报告人姓名
        status: 故障状态（待处理、处理中、已修复、已关闭）
        repair_required: 是否需要维修
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaizhizao_equipment_faults"
        table_description = "快格轻制造 - 设备故障"
        indexes = [
            ("tenant_id",),
            ("fault_no",),
            ("equipment_id",),
            ("equipment_uuid",),
            ("fault_date",),
            ("status",),
        ]
        unique_together = [("tenant_id", "fault_no")]
    
    # 主键（BaseModel 不包含 id 字段，需要自己定义）
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    fault_no = fields.CharField(max_length=100, description="故障记录编号（组织内唯一）")
    
    # 关联设备
    equipment_id = fields.IntField(description="设备ID（关联设备）")
    equipment_uuid = fields.CharField(max_length=36, description="设备UUID")
    equipment_name = fields.CharField(max_length=200, description="设备名称")
    
    # 故障信息
    fault_date = fields.DatetimeField(description="故障发生日期")
    fault_type = fields.CharField(max_length=50, description="故障类型（机械故障、电气故障、软件故障、其他）")
    fault_description = fields.TextField(description="故障描述")
    fault_level = fields.CharField(max_length=50, description="故障级别（轻微、一般、严重、紧急）")
    
    # 报告人
    reporter_id = fields.IntField(null=True, description="报告人ID（用户ID）")
    reporter_name = fields.CharField(max_length=100, null=True, description="报告人姓名")
    
    # 状态
    status = fields.CharField(max_length=50, default="待处理", description="故障状态（待处理、处理中、已修复、已关闭）")
    repair_required = fields.BooleanField(default=True, description="是否需要维修")
    remark = fields.TextField(null=True, description="备注")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.fault_no} - {self.equipment_name}"


class EquipmentRepair(BaseModel):
    """
    设备维修记录模型
    
    用于管理设备维修记录，支持多组织隔离。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        repair_no: 维修记录编号（组织内唯一）
        equipment_fault_id: 设备故障ID（关联故障记录）
        equipment_fault_uuid: 设备故障UUID
        equipment_id: 设备ID（关联设备）
        equipment_uuid: 设备UUID
        equipment_name: 设备名称
        repair_date: 维修日期
        repair_type: 维修类型（现场维修、返厂维修、委外维修）
        repair_description: 维修描述
        repair_cost: 维修成本
        repair_parts: 维修备件（JSON格式）
        repairer_id: 维修人员ID（用户ID）
        repairer_name: 维修人员姓名
        repair_duration: 维修时长（小时）
        status: 维修状态（进行中、已完成、已取消）
        repair_result: 维修结果（成功、失败、部分成功）
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaizhizao_equipment_repairs"
        table_description = "快格轻制造 - 设备维修记录"
        indexes = [
            ("tenant_id",),
            ("repair_no",),
            ("equipment_fault_id",),
            ("equipment_id",),
            ("repair_date",),
            ("status",),
        ]
        unique_together = [("tenant_id", "repair_no")]
    
    # 主键（BaseModel 不包含 id 字段，需要自己定义）
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    repair_no = fields.CharField(max_length=100, description="维修记录编号（组织内唯一）")
    
    # 关联故障记录
    equipment_fault_id = fields.IntField(null=True, description="设备故障ID（关联故障记录）")
    equipment_fault_uuid = fields.CharField(max_length=36, null=True, description="设备故障UUID")
    
    # 关联设备
    equipment_id = fields.IntField(description="设备ID（关联设备）")
    equipment_uuid = fields.CharField(max_length=36, description="设备UUID")
    equipment_name = fields.CharField(max_length=200, description="设备名称")
    
    # 维修信息
    repair_date = fields.DatetimeField(description="维修日期")
    repair_type = fields.CharField(max_length=50, description="维修类型（现场维修、返厂维修、委外维修）")
    repair_description = fields.TextField(description="维修描述")
    repair_cost = fields.DecimalField(max_digits=10, decimal_places=2, null=True, description="维修成本")
    repair_parts = fields.JSONField(null=True, description="维修备件（JSON格式）")
    repairer_id = fields.IntField(null=True, description="维修人员ID（用户ID）")
    repairer_name = fields.CharField(max_length=100, null=True, description="维修人员姓名")
    repair_duration = fields.DecimalField(max_digits=10, decimal_places=2, null=True, description="维修时长（小时）")
    
    # 状态
    status = fields.CharField(max_length=50, default="进行中", description="维修状态（进行中、已完成、已取消）")
    repair_result = fields.CharField(max_length=50, null=True, description="维修结果（成功、失败、部分成功）")
    remark = fields.TextField(null=True, description="备注")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.repair_no} - {self.equipment_name}"


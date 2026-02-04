"""
工装模型模块

定义工装及其生命周期相关的记录模型（领用、维保、校验），支持多组织隔离。

Author: Antigravity
Date: 2026-02-02
"""

from tortoise import fields
from core.models.base import BaseModel


class Tool(BaseModel):
    """
    工装基础信息模型
    
    用于管理工装（夹具、治具、检具、刀具等）的基础信息。
    """
    
    class Meta:
        table = "apps_kuaizhizao_tools"
        table_description = "快格轻制造 - 工装"
        indexes = [
            ("tenant_id",),
            ("code",),
            ("type",),
            ("status",),
        ]
        unique_together = [("tenant_id", "code")]
    
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    code = fields.CharField(max_length=50, description="工装编码")
    name = fields.CharField(max_length=200, description="工装名称")
    type = fields.CharField(max_length=50, null=True, description="工装类型（夹具、治具、检具、刀具、其他）")
    spec = fields.CharField(max_length=200, null=True, description="规格型号")
    
    # 制造/供应信息
    manufacturer = fields.CharField(max_length=200, null=True, description="制造商")
    supplier = fields.CharField(max_length=200, null=True, description="供应商")
    purchase_date = fields.DateField(null=True, description="采购日期")
    warranty_expiry = fields.DateField(null=True, description="保修到期日")
    
    # 生命周期控制
    status = fields.CharField(max_length=50, default="正常", description="工装状态（正常、领用中、维修中、校验中、停用、报废）")
    is_active = fields.BooleanField(default=True, description="是否启用")
    
    # 维保设置
    maintenance_period = fields.IntField(null=True, description="保养周期（天）")
    last_maintenance_date = fields.DateField(null=True, description="上次保养日期")
    next_maintenance_date = fields.DateField(null=True, description="下次保养日期")
    
    # 校验设置（特别是针对检具）
    needs_calibration = fields.BooleanField(default=False, description="是否需要校验")
    calibration_period = fields.IntField(null=True, description="校验周期（天）")
    last_calibration_date = fields.DateField(null=True, description="上次校验日期")
    next_calibration_date = fields.DateField(null=True, description="下次校验日期")
    
    # 统计信息
    total_usage_count = fields.IntField(default=0, description="累计使用次数")
    
    description = fields.TextField(null=True, description="备注说明")
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        return f"{self.code} - {self.name}"


class ToolUsage(BaseModel):
    """
    工装领用归还记录
    """
    
    class Meta:
        table = "apps_kuaizhizao_tool_usages"
        table_description = "快格轻制造 - 工装领用归还记录"
        indexes = [
            ("tenant_id",),
            ("tool_id",),
            ("status",),
        ]
    
    id = fields.IntField(pk=True)
    tool_id = fields.IntField(description="工装ID")
    tool_uuid = fields.CharField(max_length=36, description="工装UUID")
    
    # 业务关联
    usage_no = fields.CharField(max_length=100, description="领用单号")
    operator_id = fields.IntField(null=True, description="领用人ID")
    operator_name = fields.CharField(max_length=100, null=True, description="领用人姓名")
    department_name = fields.CharField(max_length=100, null=True, description="领用部门")
    
    source_type = fields.CharField(max_length=50, null=True, description="来源业务类型（工单等）")
    source_no = fields.CharField(max_length=100, null=True, description="来源业务单号")
    
    # 过程信息
    checkout_date = fields.DatetimeField(description="领用时间")
    checkin_date = fields.DatetimeField(null=True, description="归还时间")
    
    status = fields.CharField(max_length=50, default="使用中", description="状态（使用中、已归还）")
    remark = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True)


class ToolMaintenance(BaseModel):
    """
    工装维保记录
    """
    
    class Meta:
        table = "apps_kuaizhizao_tool_maintenances"
        table_description = "快格轻制造 - 工装维保记录"

    id = fields.IntField(pk=True)
    tool_id = fields.IntField()
    tool_uuid = fields.CharField(max_length=36)
    
    maintenance_type = fields.CharField(max_length=50, description="维保类型（日常保养、定期保养、故障维修）")
    maintenance_date = fields.DateField(description="维保日期")
    executor = fields.CharField(max_length=100, null=True, description="执行人")
    content = fields.TextField(null=True, description="维保内容")
    result = fields.CharField(max_length=50, default="完成", description="维保结果")
    cost = fields.DecimalField(max_digits=10, decimal_places=2, default=0, description="维保费用")
    
    remark = fields.TextField(null=True)
    deleted_at = fields.DatetimeField(null=True)


class ToolCalibration(BaseModel):
    """
    工装校验记录
    """
    
    class Meta:
        table = "apps_kuaizhizao_tool_calibrations"
        table_description = "快格轻制造 - 工装校验记录"

    id = fields.IntField(pk=True)
    tool_id = fields.IntField()
    tool_uuid = fields.CharField(max_length=36)
    
    calibration_date = fields.DateField(description="校验日期")
    calibration_org = fields.CharField(max_length=200, null=True, description="校验机构")
    certificate_no = fields.CharField(max_length=100, null=True, description="证书编号")
    result = fields.CharField(max_length=50, description="校验结果（合格、不合格、准用）")
    expiry_date = fields.DateField(null=True, description="有效期至")
    
    attachment_uuid = fields.CharField(max_length=36, null=True, description="报告附件UUID")
    remark = fields.TextField(null=True)
    deleted_at = fields.DatetimeField(null=True)

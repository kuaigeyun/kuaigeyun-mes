"""
研发流程模型模块

定义研发流程数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class ResearchProcess(BaseModel):
    """
    研发流程模型
    
    用于管理研发流程配置、阶段管理、流程监控等，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        process_no: 流程编号（组织内唯一）
        process_name: 流程名称
        process_type: 流程类型（IPD、CMMI、APQP等）
        process_template: 流程模板（JSON格式）
        current_stage: 当前阶段
        status: 流程状态（进行中、已完成、已暂停、已关闭）
        product_id: 关联产品ID（关联master-data）
        project_id: 关联项目ID（可选，关联PM模块）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaipdm_research_processes"
        indexes = [
            ("tenant_id",),
            ("process_no",),
            ("uuid",),
            ("status",),
            ("process_type",),
            ("product_id",),
            ("project_id",),
            ("current_stage",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "process_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    process_no = fields.CharField(max_length=50, description="流程编号（组织内唯一）")
    process_name = fields.CharField(max_length=200, description="流程名称")
    process_type = fields.CharField(max_length=50, description="流程类型（IPD、CMMI、APQP等）")
    process_template = fields.JSONField(null=True, description="流程模板（JSON格式）")
    current_stage = fields.CharField(max_length=100, null=True, description="当前阶段")
    
    # 流程状态
    status = fields.CharField(max_length=50, default="进行中", description="流程状态（进行中、已完成、已暂停、已关闭）")
    
    # 关联信息
    product_id = fields.IntField(null=True, description="关联产品ID（关联master-data）")
    project_id = fields.IntField(null=True, description="关联项目ID（可选，关联PM模块）")
    
    # 负责人
    owner_id = fields.IntField(null=True, description="负责人ID（用户ID）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.process_no} - {self.process_name}"

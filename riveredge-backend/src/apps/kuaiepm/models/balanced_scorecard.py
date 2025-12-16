"""
平衡计分卡模型模块

定义平衡计分卡数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class StrategyMap(BaseModel):
    """
    战略地图模型
    
    用于管理战略地图，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        map_no: 地图编号（组织内唯一）
        map_name: 地图名称
        map_period: 地图期间（格式：2024）
        map_content: 地图内容（JSON格式）
        status: 状态（草稿、已发布、已归档）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiepm_strategy_maps"
        indexes = [
            ("tenant_id",),
            ("map_no",),
            ("uuid",),
            ("map_name",),
            ("map_period",),
            ("status",),
        ]
        unique_together = [("tenant_id", "map_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    map_no = fields.CharField(max_length=50, description="地图编号（组织内唯一）")
    map_name = fields.CharField(max_length=200, description="地图名称")
    map_period = fields.CharField(max_length=20, null=True, description="地图期间（格式：2024）")
    map_content = fields.JSONField(null=True, description="地图内容（JSON格式）")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="草稿", description="状态（草稿、已发布、已归档）")
    
    def __str__(self):
        return f"{self.map_no} - {self.map_name}"


class Objective(BaseModel):
    """
    目标模型
    
    用于管理目标，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        objective_no: 目标编号（组织内唯一）
        strategy_map_id: 战略地图ID（关联StrategyMap）
        parent_id: 父目标ID（关联Objective，支持目标分解）
        objective_name: 目标名称
        objective_category: 目标分类（财务、客户、内部流程、学习成长）
        target_value: 目标值
        unit: 单位
        start_date: 开始日期
        end_date: 结束日期
        owner_id: 负责人ID（关联master-data）
        owner_name: 负责人姓名
        progress: 进度（百分比，0-100）
        status: 状态（未开始、进行中、已完成、已取消）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiepm_objectives"
        indexes = [
            ("tenant_id",),
            ("objective_no",),
            ("uuid",),
            ("strategy_map_id",),
            ("parent_id",),
            ("objective_category",),
            ("owner_id",),
            ("status",),
        ]
        unique_together = [("tenant_id", "objective_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    objective_no = fields.CharField(max_length=50, description="目标编号（组织内唯一）")
    strategy_map_id = fields.IntField(null=True, description="战略地图ID（关联StrategyMap）")
    parent_id = fields.IntField(null=True, description="父目标ID（关联Objective，支持目标分解）")
    objective_name = fields.CharField(max_length=200, description="目标名称")
    objective_category = fields.CharField(max_length=50, null=True, description="目标分类（财务、客户、内部流程、学习成长）")
    
    # 目标值
    target_value = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="目标值")
    unit = fields.CharField(max_length=50, null=True, description="单位")
    
    # 时间信息
    start_date = fields.DatetimeField(null=True, description="开始日期")
    end_date = fields.DatetimeField(null=True, description="结束日期")
    
    # 负责人信息
    owner_id = fields.IntField(null=True, description="负责人ID（关联master-data）")
    owner_name = fields.CharField(max_length=100, null=True, description="负责人姓名")
    
    # 进度信息
    progress = fields.IntField(default=0, description="进度（百分比，0-100）")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="未开始", description="状态（未开始、进行中、已完成、已取消）")
    
    def __str__(self):
        return f"{self.objective_no} - {self.objective_name}"


class PerformanceEvaluation(BaseModel):
    """
    绩效评估模型
    
    用于管理绩效评估，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        evaluation_no: 评估编号（组织内唯一）
        evaluation_period: 评估期间（格式：2024-Q1）
        evaluation_date: 评估日期
        evaluated_object: 评估对象（部门、个人、项目等）
        evaluated_object_id: 评估对象ID
        evaluation_content: 评估内容
        evaluation_result: 评估结果
        evaluation_score: 评估得分（0-100）
        evaluator_id: 评估人ID（关联master-data）
        evaluator_name: 评估人姓名
        status: 状态（待评估、评估中、已完成）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiepm_performance_evaluations"
        indexes = [
            ("tenant_id",),
            ("evaluation_no",),
            ("uuid",),
            ("evaluation_period",),
            ("evaluation_date",),
            ("evaluated_object",),
            ("status",),
        ]
        unique_together = [("tenant_id", "evaluation_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    evaluation_no = fields.CharField(max_length=50, description="评估编号（组织内唯一）")
    evaluation_period = fields.CharField(max_length=20, null=True, description="评估期间（格式：2024-Q1）")
    evaluation_date = fields.DatetimeField(description="评估日期")
    evaluated_object = fields.CharField(max_length=50, description="评估对象（部门、个人、项目等）")
    evaluated_object_id = fields.IntField(null=True, description="评估对象ID")
    
    # 评估内容
    evaluation_content = fields.TextField(null=True, description="评估内容")
    evaluation_result = fields.TextField(null=True, description="评估结果")
    evaluation_score = fields.IntField(null=True, description="评估得分（0-100）")
    
    # 评估人信息
    evaluator_id = fields.IntField(description="评估人ID（关联master-data）")
    evaluator_name = fields.CharField(max_length=100, description="评估人姓名")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="待评估", description="状态（待评估、评估中、已完成）")
    
    def __str__(self):
        return f"{self.evaluation_no} - {self.evaluation_period}"


"""
物料编码规则配置模型模块

定义物料编码规则配置数据模型，包括主编码规则、部门编码规则、物料类型配置等。

Author: Luigi Lu
Date: 2026-01-08
"""

from tortoise import fields
from .base import BaseModel


class MaterialCodeRuleMain(BaseModel):
    """
    主编码规则配置模型
    
    用于定义物料主编码的生成规则，支持自定义格式模板、物料类型、序号规则等。
    支持多组织隔离，每个组织可以定义自己的主编码规则。
    
    Attributes:
        id: 规则ID（主键，自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一）
        tenant_id: 组织ID（用于多组织数据隔离）
        rule_name: 规则名称
        template: 格式模板（如：{PREFIX}-{TYPE}-{SEQUENCE}）
        prefix: 前缀（如：MAT）
        sequence_config: 序号配置（JSON格式）
        is_active: 是否启用
        version: 版本号
        created_at: 创建时间
        updated_at: 更新时间
        created_by: 创建人ID
        updated_by: 更新人ID
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_master_data_material_code_rule_main"
        table_description = "基础数据管理 - 主编码规则配置"
        indexes = [
            ("tenant_id",),
            ("is_active",),
            ("version",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "version")]  # 同一组织内，版本号唯一
    
    id = fields.IntField(pk=True, description="规则ID（主键，自增ID，内部使用）")
    
    # 基本信息
    rule_name = fields.CharField(max_length=100, description="规则名称")
    template = fields.CharField(max_length=200, description="格式模板（如：{PREFIX}-{TYPE}-{SEQUENCE}）")
    prefix = fields.CharField(max_length=50, null=True, description="前缀（如：MAT）")
    
    # 序号配置（JSON格式）
    # 格式：{
    #   "length": 4,           # 序号位数
    #   "start_value": 1,      # 起始值
    #   "step": 1,             # 步长
    #   "padding": {           # 填充配置
    #     "direction": "left", # 填充方向（left/right）
    #     "char": "0"          # 填充字符
    #   },
    #   "independent_by_type": true  # 是否按类型独立计数
    # }
    sequence_config = fields.JSONField(null=True, description="序号配置（JSON格式）")
    
    # 状态信息
    is_active = fields.BooleanField(default=True, description="是否启用")
    version = fields.IntField(default=1, description="版本号")
    
    # 操作人信息
    created_by = fields.IntField(null=True, description="创建人ID")
    updated_by = fields.IntField(null=True, description="更新人ID")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.rule_name} (v{self.version})"


class MaterialTypeConfig(BaseModel):
    """
    物料类型配置模型
    
    定义物料类型及其代码，用于主编码生成规则。
    
    Attributes:
        id: 配置ID（主键，自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一）
        tenant_id: 组织ID（用于多组织数据隔离）
        rule_id: 关联的主编码规则ID
        type_code: 类型代码（如：FIN, SEMI, RAW）
        type_name: 类型名称（如：成品, 半成品, 原材料）
        description: 类型描述
        independent_sequence: 是否独立计数
        current_sequence: 当前序号（如果独立计数）
        created_at: 创建时间
        updated_at: 更新时间
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_master_data_material_type_config"
        table_description = "基础数据管理 - 物料类型配置"
        indexes = [
            ("tenant_id",),
            ("rule_id",),
            ("type_code",),
            ("created_at",),
        ]
        unique_together = [("rule_id", "type_code")]  # 同一规则内，类型代码唯一
    
    id = fields.IntField(pk=True, description="配置ID（主键，自增ID，内部使用）")
    
    # 关联关系
    rule_id = fields.IntField(description="关联的主编码规则ID")
    
    # 类型信息
    type_code = fields.CharField(max_length=20, description="类型代码（如：FIN, SEMI, RAW）")
    type_name = fields.CharField(max_length=100, description="类型名称（如：成品, 半成品, 原材料）")
    description = fields.CharField(max_length=255, null=True, description="类型描述")
    
    # 序号配置
    independent_sequence = fields.BooleanField(default=True, description="是否独立计数")
    current_sequence = fields.IntField(default=0, description="当前序号（如果独立计数）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.type_name} ({self.type_code})"


class MaterialCodeRuleAlias(BaseModel):
    """
    部门编码规则配置模型
    
    用于定义部门编码（别名编码）的生成规则和验证规则。
    
    Attributes:
        id: 规则ID（主键，自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一）
        tenant_id: 组织ID（用于多组织数据隔离）
        code_type: 编码类型代码（如：SALE, DES, SUP）
        code_type_name: 编码类型名称（如：销售编码, 设计编码）
        template: 格式模板（如：{PREFIX}-{DEPT}-{SEQUENCE}）
        prefix: 前缀（如：SALE）
        validation_pattern: 验证规则（正则表达式）
        departments: 关联部门（JSON数组）
        is_active: 是否启用
        version: 版本号
        created_at: 创建时间
        updated_at: 更新时间
        created_by: 创建人ID
        updated_by: 更新人ID
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_master_data_material_code_rule_alias"
        table_description = "基础数据管理 - 部门编码规则配置"
        indexes = [
            ("tenant_id",),
            ("code_type",),
            ("is_active",),
            ("version",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "code_type")]  # 同一组织内，编码类型唯一
    
    id = fields.IntField(pk=True, description="规则ID（主键，自增ID，内部使用）")
    
    # 编码类型信息
    code_type = fields.CharField(max_length=50, description="编码类型代码（如：SALE, DES, SUP）")
    code_type_name = fields.CharField(max_length=100, description="编码类型名称（如：销售编码, 设计编码）")
    
    # 格式配置
    template = fields.CharField(max_length=200, null=True, description="格式模板（如：{PREFIX}-{DEPT}-{SEQUENCE}）")
    prefix = fields.CharField(max_length=50, null=True, description="前缀（如：SALE）")
    
    # 验证规则
    validation_pattern = fields.CharField(max_length=500, null=True, description="验证规则（正则表达式）")
    
    # 关联部门（JSON数组）
    # 格式：["销售部", "市场部"]
    departments = fields.JSONField(null=True, description="关联部门（JSON数组）")
    
    # 状态信息
    is_active = fields.BooleanField(default=True, description="是否启用")
    version = fields.IntField(default=1, description="版本号")
    
    # 操作人信息
    created_by = fields.IntField(null=True, description="创建人ID")
    updated_by = fields.IntField(null=True, description="更新人ID")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.code_type_name} ({self.code_type})"


class MaterialCodeRuleHistory(BaseModel):
    """
    编码规则版本历史模型
    
    记录编码规则配置的版本历史，支持版本对比和回滚。
    
    Attributes:
        id: 历史ID（主键，自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一）
        tenant_id: 组织ID（用于多组织数据隔离）
        rule_type: 规则类型（main/alias）
        rule_id: 规则ID
        version: 版本号
        rule_config: 规则配置（完整JSON）
        change_description: 变更说明
        changed_by: 变更人ID
        changed_at: 变更时间
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_master_data_material_code_rule_history"
        table_description = "基础数据管理 - 编码规则版本历史"
        indexes = [
            ("tenant_id",),
            ("rule_type",),
            ("rule_id",),
            ("version",),
            ("changed_at",),
        ]
        unique_together = [("rule_type", "rule_id", "version")]  # 同一规则的同一版本唯一
    
    id = fields.IntField(pk=True, description="历史ID（主键，自增ID，内部使用）")
    
    # 规则信息
    rule_type = fields.CharField(max_length=20, description="规则类型（main/alias）")
    rule_id = fields.IntField(description="规则ID")
    version = fields.IntField(description="版本号")
    
    # 配置信息
    rule_config = fields.JSONField(description="规则配置（完整JSON）")
    change_description = fields.TextField(null=True, description="变更说明")
    
    # 变更人信息
    changed_by = fields.IntField(null=True, description="变更人ID")
    changed_at = fields.DatetimeField(null=True, description="变更时间")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.rule_type} Rule {self.rule_id} v{self.version}"


class MaterialSequenceCounter(BaseModel):
    """
    物料序号计数器模型
    
    存储物料编码规则的当前序号值，用于序号生成。
    
    Attributes:
        id: 计数器ID（主键，自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一）
        tenant_id: 组织ID（用于多组织数据隔离）
        rule_id: 关联的规则ID（主编码规则ID）
        type_code: 物料类型代码（如果独立计数）
        current_value: 当前序号值
        updated_at: 更新时间
    """
    
    class Meta:
        """
        模型元数据
        
        注意：唯一性约束通过部分唯一索引实现（在迁移文件中定义）：
        - 全局计数（type_code IS NULL）：确保每个规则只有一个全局计数器
        - 类型计数（type_code IS NOT NULL）：确保每个规则每个类型只有一个计数器
        """
        table = "apps_master_data_material_sequence_counter"
        table_description = "基础数据管理 - 物料序号计数器"
        indexes = [
            ("tenant_id",),
            ("rule_id",),
            ("type_code",),
            ("updated_at",),
        ]
        # 不使用 unique_together，因为 type_code 可能为 NULL
        # 唯一性约束通过部分唯一索引在迁移文件中定义
    
    id = fields.IntField(pk=True, description="计数器ID（主键，自增ID，内部使用）")
    
    # 关联信息
    rule_id = fields.IntField(description="关联的规则ID（主编码规则ID）")
    type_code = fields.CharField(max_length=100, null=True, description="物料类型代码（如果独立计数）")
    
    # 序号信息
    current_value = fields.IntField(default=0, description="当前序号值")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        type_str = f"-{self.type_code}" if self.type_code else ""
        return f"Sequence Counter(rule_id={self.rule_id}{type_str}, value={self.current_value})"

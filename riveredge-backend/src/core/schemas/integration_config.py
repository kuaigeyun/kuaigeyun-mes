"""
集成配置管理 Schema 模块

定义集成配置管理相关的 Pydantic Schema，用于 API 请求和响应验证。
"""

from datetime import datetime
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field, ConfigDict, field_validator


class IntegrationConfigBase(BaseModel):
    """
    集成配置基础 Schema
    
    包含集成配置的基本字段，用于创建和更新操作。
    """
    name: str = Field(..., min_length=1, max_length=100, description="集成名称")
    code: str = Field(..., min_length=1, max_length=50, description="集成代码（唯一，用于程序识别）")
    type: str = Field(..., min_length=1, max_length=20, description="集成类型：OAuth、API、Webhook、Database等")
    description: Optional[str] = Field(None, description="集成描述")
    config: Dict[str, Any] = Field(default_factory=dict, description="配置信息（JSON）")
    is_active: bool = Field(default=True, description="是否启用")
    
    @field_validator('type')
    @classmethod
    def validate_type(cls, v: str) -> str:
        """验证集成类型（含数据源、应用连接器类型）"""
        allowed_types = [
            'OAuth', 'API', 'Webhook', 'Database',
            'postgresql', 'mysql', 'mongodb', 'oracle', 'sqlserver',
            'redis', 'clickhouse', 'influxdb', 'doris', 'starrocks',
            'elasticsearch', 'api',
            # 应用连接器：协作
            'feishu', 'dingtalk', 'wecom',
            # 应用连接器：ERP
            'sap', 'kingdee', 'yonyou', 'dsc', 'inspur', 'digiwin_e10',
            'grasp_erp', 'super_erp', 'chanjet_tplus', 'kingdee_kis',
            'oracle_netsuite', 'erpnext', 'odoo', 'sunlike_erp',
            # 应用连接器：PLM/PDM
            'teamcenter', 'windchill', 'caxa', 'sanpin_plm', 'sunlike_plm', 'sipm', 'inteplm',
            # 应用连接器：CRM
            'salesforce', 'xiaoshouyi', 'fenxiang', 'qidian', 'supra_crm',
            # 应用连接器：OA
            'weaver', 'seeyon', 'landray', 'cloudhub', 'tongda_oa',
            # 应用连接器：IoT
            'rootcloud', 'casicloud', 'alicloud_iot', 'huaweicloud_iot', 'thingsboard', 'jetlinks',
            # 应用连接器：WMS
            'flux_wms', 'kejian_wms', 'digiwin_wms', 'openwms',
        ]
        if v not in allowed_types:
            raise ValueError(f"集成类型必须是以下之一: {', '.join(allowed_types)}")
        return v


class IntegrationConfigCreate(IntegrationConfigBase):
    """
    集成配置创建 Schema
    
    用于创建新集成配置的请求数据。
    """
    pass


class IntegrationConfigUpdate(BaseModel):
    """
    集成配置更新 Schema
    
    用于更新集成配置的请求数据，所有字段可选。
    """
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="集成名称")
    description: Optional[str] = Field(None, description="集成描述")
    config: Optional[Dict[str, Any]] = Field(None, description="配置信息（JSON）")
    is_active: Optional[bool] = Field(None, description="是否启用")


class IntegrationConfigResponse(IntegrationConfigBase):
    """
    集成配置响应 Schema
    
    用于返回集成配置信息。
    """
    uuid: str = Field(..., description="集成配置UUID（对外暴露，业务标识）")
    tenant_id: int = Field(..., description="组织ID")
    is_connected: bool = Field(..., description="是否已连接")
    last_connected_at: Optional[datetime] = Field(None, description="最后连接时间")
    last_error: Optional[str] = Field(None, description="最后错误信息")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)


class TestConfigRequest(BaseModel):
    """
    保存前测试连接请求 Schema
    
    用于新建/编辑时，在保存前测试连接配置是否有效。
    不落库，仅验证配置。
    """
    type: str = Field(..., description="集成类型：postgresql、mysql、mongodb、api 等")
    config: Dict[str, Any] = Field(default_factory=dict, description="连接配置（JSON）")


class TestConnectionResponse(BaseModel):
    """
    测试连接响应 Schema
    
    用于返回连接测试结果。
    """
    success: bool = Field(..., description="是否成功")
    message: str = Field(..., description="消息")
    data: Optional[Dict[str, Any]] = Field(None, description="测试结果数据")
    error: Optional[str] = Field(None, description="错误信息")


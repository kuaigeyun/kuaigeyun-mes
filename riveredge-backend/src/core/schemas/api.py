"""
接口 Schema 模块

定义接口相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any, List
from datetime import datetime
from uuid import UUID


class APIBase(BaseModel):
    """接口基础 Schema"""
    name: str = Field(..., max_length=100, description="接口名称")
    code: str = Field(..., max_length=50, description="接口代码")
    description: Optional[str] = Field(None, description="接口描述")
    path: str = Field(..., max_length=500, description="接口路径")
    method: str = Field(..., max_length=10, description="请求方法")
    connection_uuid: Optional[UUID] = Field(None, description="关联应用连接器 UUID（可选）")
    category_uuid: Optional[UUID] = Field(None, description="所属分类 UUID（可选）")
    request_headers: Optional[Dict[str, Any]] = Field(None, description="请求头")
    request_params: Optional[Dict[str, Any]] = Field(None, description="请求参数")
    request_body: Optional[Dict[str, Any]] = Field(None, description="请求体")
    response_format: Optional[Dict[str, Any]] = Field(None, description="响应格式")
    response_example: Optional[Dict[str, Any]] = Field(None, description="响应示例")
    is_active: bool = Field(True, description="是否启用")
    is_system: bool = Field(False, description="是否系统接口")


class APICreate(APIBase):
    """创建接口 Schema"""
    pass


class APIUpdate(BaseModel):
    """更新接口 Schema"""
    name: Optional[str] = Field(None, max_length=100, description="接口名称")
    code: Optional[str] = Field(None, max_length=50, description="接口代码")
    description: Optional[str] = Field(None, description="接口描述")
    path: Optional[str] = Field(None, max_length=500, description="接口路径")
    method: Optional[str] = Field(None, max_length=10, description="请求方法")
    connection_uuid: Optional[UUID] = Field(None, description="关联应用连接器 UUID（可选，传 null 清除绑定）")
    category_uuid: Optional[UUID] = Field(None, description="所属分类 UUID（可选，传 null 清除分类）")
    request_headers: Optional[Dict[str, Any]] = Field(None, description="请求头")
    request_params: Optional[Dict[str, Any]] = Field(None, description="请求参数")
    request_body: Optional[Dict[str, Any]] = Field(None, description="请求体")
    response_format: Optional[Dict[str, Any]] = Field(None, description="响应格式")
    response_example: Optional[Dict[str, Any]] = Field(None, description="响应示例")
    is_active: Optional[bool] = Field(None, description="是否启用")


class APIResponse(APIBase):
    """接口响应 Schema"""
    uuid: UUID = Field(..., description="接口UUID")
    tenant_id: int = Field(..., description="组织ID")
    connection_name: Optional[str] = Field(None, description="关联应用连接器名称")
    connection_type: Optional[str] = Field(None, description="关联应用连接器类型")
    category_uuid: Optional[UUID] = Field(None, description="所属分类 UUID")
    category_name: Optional[str] = Field(None, description="所属分类名称")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)


class APITestRequest(BaseModel):
    """接口测试请求 Schema"""
    headers: Optional[Dict[str, Any]] = Field(None, description="请求头（覆盖接口定义）")
    params: Optional[Dict[str, Any]] = Field(None, description="请求参数（覆盖接口定义）")
    body: Optional[Dict[str, Any]] = Field(None, description="请求体（覆盖接口定义）")


class APITestResponse(BaseModel):
    """接口测试响应 Schema"""
    status_code: int = Field(..., description="响应状态码")
    headers: Dict[str, Any] = Field(..., description="响应头")
    body: Any = Field(..., description="响应体")
    elapsed_time: float = Field(..., description="请求耗时（秒）")


class ApiLibraryItemPreview(BaseModel):
    """接口库条目预览"""

    item_key: str = Field(..., description="接口条目唯一键（包内）")
    name: str = Field(..., description="接口名称")
    description: str = Field(..., description="接口说明")


class ApiLibraryPackResponse(BaseModel):
    """接口库包预览"""

    pack_id: str = Field(..., description="接口包 ID")
    name: str = Field(..., description="接口包名称")
    description: str = Field(..., description="接口包说明")
    connector_type: str = Field(..., description="所需应用连接器类型")
    category_name: str = Field(..., description="加载后归入的分类名称")
    api_count: int = Field(..., description="接口数量")
    items: List[ApiLibraryItemPreview] = Field(default_factory=list, description="接口条目")


class ApiLibraryListResponse(BaseModel):
    """接口库目录"""

    items: List[ApiLibraryPackResponse] = Field(default_factory=list, description="接口包列表")


class InstallApiLibraryPackRequest(BaseModel):
    """安装接口库包请求"""

    connection_uuid: UUID = Field(..., description="绑定的应用连接器 UUID")
    item_keys: List[str] = Field(..., min_length=1, description="要加载的接口条目键")


class InstallApiLibraryPackResponse(BaseModel):
    """安装接口库包结果"""

    pack_id: str = Field(..., description="接口包 ID")
    connection_uuid: str = Field(..., description="连接器 UUID")
    connection_code: str = Field(..., description="连接器代码")
    connection_type: str = Field(..., description="连接器类型")
    category_uuid: str = Field(..., description="分类 UUID")
    created_count: int = Field(..., description="新建接口数")
    skipped_count: int = Field(..., description="已存在跳过数")
    categorized_count: int = Field(..., description="已存在接口补充分类数")
    created_codes: List[str] = Field(default_factory=list, description="新建接口 code")
    skipped_codes: List[str] = Field(default_factory=list, description="跳过接口 code")
    categorized_codes: List[str] = Field(default_factory=list, description="补充分类接口 code")


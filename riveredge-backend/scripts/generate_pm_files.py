#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
批量生成PM模块的schemas、services和API文件
"""

import os

# 定义模型列表
MODELS = [
    ("Project", "project", "项目"),
    ("ProjectApplication", "project_application", "项目申请"),
    ("ProjectWBS", "project_wbs", "项目WBS"),
    ("ProjectTask", "project_task", "项目任务"),
    ("ProjectResource", "project_resource", "项目资源"),
    ("ProjectProgress", "project_progress", "项目进度"),
    ("ProjectCost", "project_cost", "项目成本"),
    ("ProjectRisk", "project_risk", "项目风险"),
    ("ProjectQuality", "project_quality", "项目质量"),
]

BASE_DIR = "riveredge-backend/src/apps/kuaipm"

# Schemas模板
SCHEMA_TEMPLATE = '''"""
{model_name_cn} Schema 模块

定义{model_name_cn}数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class {ModelName}Base(BaseModel):
    """{model_name_cn}基础 Schema"""
    
    {base_fields}
    
    @validator("{first_field}")
    def validate_{first_field}(cls, v):
        """验证{first_field}格式"""
        if not v or not v.strip():
            raise ValueError("{first_field}不能为空")
        return v.strip() if isinstance(v, str) else v


class {ModelName}Create({ModelName}Base):
    """创建{model_name_cn} Schema"""
    pass


class {ModelName}Update(BaseModel):
    """更新{model_name_cn} Schema"""
    
    {update_fields}


class {ModelName}Response({ModelName}Base):
    """{model_name_cn}响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
'''

# Service模板
SERVICE_TEMPLATE = '''"""
{model_name_cn}服务模块

提供{model_name_cn}的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaipm.models.project import {ModelName}
from apps.kuaipm.schemas.{schema_file}_schemas import (
    {ModelName}Create, {ModelName}Update, {ModelName}Response
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class {ModelName}Service:
    """{model_name_cn}服务"""
    
    @staticmethod
    async def create_{model_name}(
        tenant_id: int,
        data: {ModelName}Create
    ) -> {ModelName}Response:
        """
        创建{model_name_cn}
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            {ModelName}Response: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await {ModelName}.filter(
            tenant_id=tenant_id,
            {no_field}=data.{no_field},
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"{no_field_cn} {{data.{no_field}}} 已存在")
        
        # 创建对象
        obj = await {ModelName}.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return {ModelName}Response.model_validate(obj)
    
    @staticmethod
    async def get_{model_name}_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> {ModelName}Response:
        """
        根据UUID获取{model_name_cn}
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            {ModelName}Response: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await {ModelName}.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"{model_name_cn} {{obj_uuid}} 不存在")
        
        return {ModelName}Response.model_validate(obj)
    
    @staticmethod
    async def list_{model_name}s(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        **filters
    ) -> List[{ModelName}Response]:
        """
        获取{model_name_cn}列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            **filters: 过滤条件
            
        Returns:
            List[{ModelName}Response]: 对象列表
        """
        query = {ModelName}.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        # 应用过滤条件
        for key, value in filters.items():
            if value is not None:
                query = query.filter(**{{key: value}})
        
        objs = await query.offset(skip).limit(limit).all()
        return [{ModelName}Response.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_{model_name}(
        tenant_id: int,
        obj_uuid: str,
        data: {ModelName}Update
    ) -> {ModelName}Response:
        """
        更新{model_name_cn}
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            {ModelName}Response: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await {ModelName}.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"{model_name_cn} {{obj_uuid}} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return {ModelName}Response.model_validate(obj)
    
    @staticmethod
    async def delete_{model_name}(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除{model_name_cn}（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await {ModelName}.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"{model_name_cn} {{obj_uuid}} 不存在")
        
        await obj.soft_delete()
'''

# API模板
API_TEMPLATE = '''"""
{model_name_cn} API 模块

提供{model_name_cn}的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaipm.services.{service_file}_service import {ModelName}Service
from apps.kuaipm.schemas.{schema_file}_schemas import (
    {ModelName}Create, {ModelName}Update, {ModelName}Response
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/{api_prefix}", tags=["{model_name_cn}"])


@router.post("", response_model={ModelName}Response, summary="创建{model_name_cn}")
async def create_{model_name}(
    data: {ModelName}Create,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建{model_name_cn}"""
    try:
        return await {ModelName}Service.create_{model_name}(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[{ModelName}Response], summary="获取{model_name_cn}列表")
async def list_{model_name}s(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    {query_params}
):
    """获取{model_name_cn}列表"""
    filters = {{}}
    {filter_code}
    return await {ModelName}Service.list_{model_name}s(tenant_id, skip, limit, **filters)


@router.get("/{{obj_uuid}}", response_model={ModelName}Response, summary="获取{model_name_cn}详情")
async def get_{model_name}(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取{model_name_cn}详情"""
    try:
        return await {ModelName}Service.get_{model_name}_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{{obj_uuid}}", response_model={ModelName}Response, summary="更新{model_name_cn}")
async def update_{model_name}(
    obj_uuid: str,
    data: {ModelName}Update,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新{model_name_cn}"""
    try:
        return await {ModelName}Service.update_{model_name}(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{{obj_uuid}}", status_code=status.HTTP_204_NO_CONTENT, summary="删除{model_name_cn}")
async def delete_{model_name}(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除{model_name_cn}"""
    try:
        await {ModelName}Service.delete_{model_name}(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
'''

# 字段映射（根据模型名称推断字段）
FIELD_MAPPING = {
    "Project": {
        "no_field": "project_no",
        "no_field_cn": "项目编号",
        "base_fields": """project_no: str = Field(..., max_length=50, description="项目编号（组织内唯一）")
    project_name: str = Field(..., max_length=200, description="项目名称")
    project_type: str = Field(..., max_length=50, description="项目类型")
    project_category: Optional[str] = Field(None, max_length=50, description="项目分类")
    manager_id: int = Field(..., description="项目经理ID")
    manager_name: str = Field(..., max_length=100, description="项目经理姓名")
    department_id: Optional[int] = Field(None, description="负责部门ID")
    start_date: Optional[datetime] = Field(None, description="计划开始日期")
    end_date: Optional[datetime] = Field(None, description="计划结束日期")
    budget_amount: Optional[Decimal] = Field(None, description="预算金额")
    progress: int = Field(0, ge=0, le=100, description="项目进度（百分比）")
    status: str = Field("草稿", max_length=50, description="状态")
    priority: str = Field("中", max_length=50, description="优先级")
    description: Optional[str] = Field(None, description="项目描述")""",
        "update_fields": """project_name: Optional[str] = Field(None, max_length=200, description="项目名称")
    project_type: Optional[str] = Field(None, max_length=50, description="项目类型")
    status: Optional[str] = Field(None, max_length=50, description="状态")
    progress: Optional[int] = Field(None, ge=0, le=100, description="项目进度")""",
        "query_params": "project_type: Optional[str] = Query(None),\n    status: Optional[str] = Query(None)",
        "filter_code": """if project_type:
        filters["project_type"] = project_type
    if status:
        filters["status"] = status"""
    },
    "ProjectApplication": {
        "no_field": "application_no",
        "no_field_cn": "申请编号",
        "base_fields": """application_no: str = Field(..., max_length=50, description="申请编号（组织内唯一）")
    project_id: Optional[int] = Field(None, description="项目ID")
    applicant_id: int = Field(..., description="申请人ID")
    applicant_name: str = Field(..., max_length=100, description="申请人姓名")
    application_date: datetime = Field(..., description="申请日期")
    application_reason: str = Field(..., description="申请原因")
    expected_start_date: Optional[datetime] = Field(None, description="预期开始日期")
    expected_end_date: Optional[datetime] = Field(None, description="预期结束日期")
    expected_budget: Optional[Decimal] = Field(None, description="预期预算")
    status: str = Field("待审批", max_length=50, description="状态")""",
        "update_fields": """status: Optional[str] = Field(None, max_length=50, description="状态")
    approval_comment: Optional[str] = Field(None, description="审批意见")""",
        "query_params": "status: Optional[str] = Query(None),\n    applicant_id: Optional[int] = Query(None)",
        "filter_code": """if status:
        filters["status"] = status
    if applicant_id:
        filters["applicant_id"] = applicant_id"""
    },
    # 其他模型类似，为了简化，使用通用模板
}

def get_model_fields(model_name):
    """根据模型名称获取字段信息"""
    if model_name in FIELD_MAPPING:
        return FIELD_MAPPING[model_name]
    
    # 通用模板
    no_field = model_name.lower().replace("project", "") + "_no"
    if no_field.startswith("_"):
        no_field = "project" + no_field
    
    return {
        "no_field": no_field,
        "no_field_cn": "编号",
        "base_fields": f"""{no_field}: str = Field(..., max_length=50, description="编号（组织内唯一）")
    project_id: int = Field(..., description="项目ID")
    status: str = Field("待处理", max_length=50, description="状态")""",
        "update_fields": """status: Optional[str] = Field(None, max_length=50, description="状态")""",
        "query_params": "status: Optional[str] = Query(None),\n    project_id: Optional[int] = Query(None)",
        "filter_code": """if status:
        filters["status"] = status
    if project_id:
        filters["project_id"] = project_id"""
    }

def generate_files():
    """生成所有文件"""
    os.makedirs(f"{BASE_DIR}/schemas", exist_ok=True)
    os.makedirs(f"{BASE_DIR}/services", exist_ok=True)
    os.makedirs(f"{BASE_DIR}/api", exist_ok=True)
    
    for ModelName, schema_file, model_name_cn in MODELS:
        model_name = ModelName.lower()
        service_file = schema_file
        api_prefix = schema_file.replace("_", "-")
        
        fields_info = get_model_fields(ModelName)
        first_field = fields_info["no_field"]
        
        # 生成Schema文件
        schema_content = SCHEMA_TEMPLATE.format(
            ModelName=ModelName,
            model_name_cn=model_name_cn,
            schema_file=schema_file,
            base_fields=fields_info["base_fields"],
            update_fields=fields_info["update_fields"],
            first_field=first_field
        )
        
        with open(f"{BASE_DIR}/schemas/{schema_file}_schemas.py", "w", encoding="utf-8") as f:
            f.write(schema_content)
        
        # 生成Service文件
        service_content = SERVICE_TEMPLATE.format(
            ModelName=ModelName,
            model_name=model_name,
            model_name_cn=model_name_cn,
            schema_file=schema_file,
            no_field=fields_info["no_field"],
            no_field_cn=fields_info["no_field_cn"]
        )
        
        with open(f"{BASE_DIR}/services/{service_file}_service.py", "w", encoding="utf-8") as f:
            f.write(service_content)
        
        # 生成API文件
        api_content = API_TEMPLATE.format(
            ModelName=ModelName,
            model_name=model_name,
            model_name_cn=model_name_cn,
            schema_file=schema_file,
            service_file=service_file,
            api_prefix=api_prefix,
            query_params=fields_info["query_params"],
            filter_code=fields_info["filter_code"]
        )
        
        with open(f"{BASE_DIR}/api/{schema_file}s.py", "w", encoding="utf-8") as f:
            f.write(api_content)
        
        print(f"已生成: {ModelName}")

if __name__ == "__main__":
    generate_files()
    print("所有文件生成完成！")


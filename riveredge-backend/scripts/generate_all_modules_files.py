#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
批量生成所有模块的schemas、services和API文件
"""

import os
import re

# 定义所有模块和模型
MODULES = {
    "kuaipm": [
        ("Project", "project", "项目", "project_no", "项目编号"),
        ("ProjectApplication", "project_application", "项目申请", "application_no", "申请编号"),
        ("ProjectWBS", "project_wbs", "项目WBS", "wbs_code", "WBS编码"),
        ("ProjectTask", "project_task", "项目任务", "task_no", "任务编号"),
        ("ProjectResource", "project_resource", "项目资源", "resource_no", "资源编号"),
        ("ProjectProgress", "project_progress", "项目进度", "progress_no", "进度编号"),
        ("ProjectCost", "project_cost", "项目成本", "cost_no", "成本编号"),
        ("ProjectRisk", "project_risk", "项目风险", "risk_no", "风险编号"),
        ("ProjectQuality", "project_quality", "项目质量", "quality_no", "质量编号"),
    ],
    "kuaiehs": [
        ("EnvironmentMonitoring", "environment_monitoring", "环境监测", "monitoring_no", "监测编号"),
        ("EmissionManagement", "emission_management", "排放管理", "emission_no", "排放编号"),
        ("EnvironmentalCompliance", "environmental_compliance", "环保合规", "compliance_no", "合规编号"),
        ("EnvironmentalIncident", "environmental_incident", "环境事故", "incident_no", "事故编号"),
        ("OccupationalHealthCheck", "occupational_health_check", "职业健康检查", "check_no", "检查编号"),
        ("OccupationalDisease", "occupational_disease", "职业病", "disease_no", "病案编号"),
        ("HealthRecord", "health_record", "健康档案", "record_no", "档案编号"),
        ("SafetyTraining", "safety_training", "安全培训", "training_no", "培训编号"),
        ("SafetyInspection", "safety_inspection", "安全检查", "inspection_no", "检查编号"),
        ("SafetyHazard", "safety_hazard", "安全隐患", "hazard_no", "隐患编号"),
        ("SafetyIncident", "safety_incident", "安全事故", "incident_no", "事故编号"),
        ("Regulation", "regulation", "法规", "regulation_no", "法规编号"),
        ("ComplianceCheck", "compliance_check", "合规检查", "check_no", "检查编号"),
        ("ComplianceReport", "compliance_report", "合规报告", "report_no", "报告编号"),
    ],
    "kuaicert": [
        ("CertificationType", "certification_type", "认证类型", "type_code", "类型编码"),
        ("CertificationStandard", "certification_standard", "认证标准", "standard_no", "标准编号"),
        ("ScoringRule", "scoring_rule", "评分规则", "rule_no", "规则编号"),
        ("CertificationRequirement", "certification_requirement", "认证要求", "requirement_no", "要求编号"),
        ("CurrentAssessment", "current_assessment", "现状评估", "assessment_no", "评估编号"),
        ("SelfAssessment", "self_assessment", "自评打分", "assessment_no", "自评编号"),
        ("AssessmentReport", "assessment_report", "评估报告", "report_no", "报告编号"),
        ("ImprovementSuggestion", "improvement_suggestion", "改进建议", "suggestion_no", "建议编号"),
        ("ImprovementPlan", "improvement_plan", "改进计划", "plan_no", "计划编号"),
        ("BestPractice", "best_practice", "最佳实践", "practice_no", "实践编号"),
        ("CertificationApplication", "certification_application", "认证申请", "application_no", "申请编号"),
        ("CertificationProgress", "certification_progress", "认证进度", "progress_no", "进度编号"),
        ("CertificationCertificate", "certification_certificate", "认证证书", "certificate_no", "证书编号"),
    ],
    "kuaiepm": [
        ("KPI", "kpi", "KPI", "kpi_code", "KPI编码"),
        ("KPIMonitoring", "kpi_monitoring", "KPI监控", "monitoring_no", "监控编号"),
        ("KPIAnalysis", "kpi_analysis", "KPI分析", "analysis_no", "分析编号"),
        ("KPIAlert", "kpi_alert", "KPI预警", "alert_no", "预警编号"),
        ("StrategyMap", "strategy_map", "战略地图", "map_no", "地图编号"),
        ("Objective", "objective", "目标", "objective_no", "目标编号"),
        ("PerformanceEvaluation", "performance_evaluation", "绩效评估", "evaluation_no", "评估编号"),
        ("BusinessDashboard", "business_dashboard", "经营仪表盘", "dashboard_no", "仪表盘编号"),
        ("BusinessDataAnalysis", "business_data_analysis", "经营数据分析", "analysis_no", "分析编号"),
        ("TrendAnalysis", "trend_analysis", "趋势分析", "analysis_no", "分析编号"),
        ("ComparisonAnalysis", "comparison_analysis", "对比分析", "analysis_no", "分析编号"),
        ("Budget", "budget", "预算", "budget_no", "预算编号"),
        ("BudgetVariance", "budget_variance", "预算差异", "variance_no", "差异编号"),
        ("BudgetForecast", "budget_forecast", "预算预测", "forecast_no", "预测编号"),
    ],
    "kuaioa": [
        ("ApprovalProcess", "approval_process", "审批流程", "process_no", "流程编号"),
        ("ApprovalInstance", "approval_instance", "审批实例", "instance_no", "实例编号"),
        ("ApprovalNode", "approval_node", "审批节点", "node_no", "节点编号"),
        ("Document", "document", "文档", "document_no", "文档编号"),
        ("DocumentVersion", "document_version", "文档版本", "version_no", "版本编号"),
        ("Meeting", "meeting", "会议", "meeting_no", "会议编号"),
        ("MeetingMinutes", "meeting_minutes", "会议纪要", "minutes_no", "纪要编号"),
        ("MeetingResource", "meeting_resource", "会议资源", "resource_no", "资源编号"),
        ("Notice", "notice", "公告", "notice_no", "公告编号"),
        ("Notification", "notification", "通知", "notification_no", "通知编号"),
    ],
}

BASE_DIR = "riveredge-backend/src/apps"

# Schema模板
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
    
    {no_field}: str = Field(..., max_length=50, description="{no_field_cn}（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("{no_field}")
    def validate_{no_field}(cls, v):
        """验证{no_field_cn}格式"""
        if not v or not v.strip():
            raise ValueError("{no_field_cn}不能为空")
        return v.strip()


class {ModelName}Create({ModelName}Base):
    """创建{model_name_cn} Schema"""
    pass


class {ModelName}Update(BaseModel):
    """更新{model_name_cn} Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


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
from apps.{module_name}.models.{model_file} import {ModelName}
from apps.{module_name}.schemas.{schema_file}_schemas import (
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
        status: Optional[str] = None
    ) -> List[{ModelName}Response]:
        """
        获取{model_name_cn}列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[{ModelName}Response]: 对象列表
        """
        query = {ModelName}.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
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
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
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
from apps.{module_name}.services.{service_file}_service import {ModelName}Service
from apps.{module_name}.schemas.{schema_file}_schemas import (
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
    status: Optional[str] = Query(None)
):
    """获取{model_name_cn}列表"""
    return await {ModelName}Service.list_{model_name}s(tenant_id, skip, limit, status)


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
    """删除{model_name_cn}（软删除）"""
    try:
        await {ModelName}Service.delete_{model_name}(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
'''

def get_model_file_name(model_name, schema_file):
    """根据模型名称获取模型文件名"""
    # 简化处理：使用schema_file作为模型文件名
    if model_name.startswith("Project"):
        return "project"
    elif model_name.startswith("Environment") or model_name.startswith("Emission") or model_name.startswith("Environmental"):
        return "environment"
    elif model_name.startswith("Occupational") or model_name.startswith("Health"):
        return "health"
    elif model_name.startswith("Safety"):
        return "safety"
    elif model_name.startswith("Compliance") or model_name.startswith("Regulation"):
        return "compliance"
    elif model_name.startswith("Certification"):
        if "Type" in model_name or "Standard" in model_name or "Rule" in model_name:
            return "certification_type"
        elif "Requirement" in model_name or "Assessment" in model_name or "Report" in model_name:
            return "certification_assessment"
        elif "Application" in model_name or "Progress" in model_name or "Certificate" in model_name:
            return "certification_management"
    elif model_name.startswith("Improvement") or model_name.startswith("Best"):
        return "improvement"
    elif model_name.startswith("KPI"):
        return "kpi"
    elif model_name.startswith("Strategy") or model_name.startswith("Objective") or model_name.startswith("Performance"):
        return "balanced_scorecard"
    elif model_name.startswith("Business") or model_name.startswith("Trend") or model_name.startswith("Comparison"):
        return "business_analysis"
    elif model_name.startswith("Budget"):
        return "budget_analysis"
    elif model_name.startswith("Approval"):
        return "approval"
    elif model_name.startswith("Document"):
        return "document"
    elif model_name.startswith("Meeting"):
        return "meeting"
    elif model_name.startswith("Notice"):
        return "notice"
    
    # 默认使用schema_file
    return schema_file

def generate_files():
    """生成所有文件"""
    for module_name, models in MODULES.items():
        module_dir = f"{BASE_DIR}/{module_name}"
        os.makedirs(f"{module_dir}/schemas", exist_ok=True)
        os.makedirs(f"{module_dir}/services", exist_ok=True)
        os.makedirs(f"{module_dir}/api", exist_ok=True)
        
        for ModelName, schema_file, model_name_cn, no_field, no_field_cn in models:
            model_name = ModelName.lower()
            service_file = schema_file
            api_prefix = schema_file.replace("_", "-")
            model_file = get_model_file_name(ModelName, schema_file)
            
            # 生成Schema文件（跳过已存在的Project）
            if module_name == "kuaipm" and ModelName == "Project":
                print(f"跳过已存在的: {ModelName}")
                continue
            
            schema_content = SCHEMA_TEMPLATE.format(
                ModelName=ModelName,
                model_name_cn=model_name_cn,
                schema_file=schema_file,
                no_field=no_field,
                no_field_cn=no_field_cn
            )
            
            schema_path = f"{module_dir}/schemas/{schema_file}_schemas.py"
            if not os.path.exists(schema_path):
                with open(schema_path, "w", encoding="utf-8") as f:
                    f.write(schema_content)
                print(f"已生成: {schema_path}")
            
            # 生成Service文件
            service_content = SERVICE_TEMPLATE.format(
                ModelName=ModelName,
                model_name=model_name,
                model_name_cn=model_name_cn,
                module_name=module_name,
                schema_file=schema_file,
                service_file=service_file,
                model_file=model_file,
                no_field=no_field,
                no_field_cn=no_field_cn
            )
            
            service_path = f"{module_dir}/services/{service_file}_service.py"
            if not os.path.exists(service_path):
                with open(service_path, "w", encoding="utf-8") as f:
                    f.write(service_content)
                print(f"已生成: {service_path}")
            
            # 生成API文件
            api_content = API_TEMPLATE.format(
                ModelName=ModelName,
                model_name=model_name,
                model_name_cn=model_name_cn,
                module_name=module_name,
                schema_file=schema_file,
                service_file=service_file,
                api_prefix=api_prefix
            )
            
            api_path = f"{module_dir}/api/{schema_file}s.py"
            if not os.path.exists(api_path):
                with open(api_path, "w", encoding="utf-8") as f:
                    f.write(api_content)
                print(f"已生成: {api_path}")

if __name__ == "__main__":
    generate_files()
    print("所有文件生成完成！")


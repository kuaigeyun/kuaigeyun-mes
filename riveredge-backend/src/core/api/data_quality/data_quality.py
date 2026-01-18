"""
数据质量保障 API 路由

提供数据验证、数据清洗建议、数据质量报告等 RESTful API 接口。

Author: Luigi Lu
Date: 2026-01-27
"""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from core.services.data_quality.data_quality_service import (
    DataQualityService,
    ValidationReport,
    DataCleaningSuggestion,
    DataQualityReport,
)
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from loguru import logger

router = APIRouter(prefix="/data-quality", tags=["Data Quality"])


class DataValidationRequest(BaseModel):
    """数据验证请求"""
    data: List[List[Any]] = Field(..., description="二维数组数据（第一行是表头，从第二行开始是数据）")
    headers: List[str] = Field(..., description="表头列表")
    field_rules: Dict[str, Dict[str, Any]] = Field(default_factory=dict, description="字段验证规则")
    required_fields: List[str] = Field(default_factory=list, description="必填字段列表")
    reference_data: Optional[Dict[str, List[str]]] = Field(None, description="参考数据（用于关联性验证）")


class DataCleaningRequest(BaseModel):
    """数据清洗检测请求"""
    data: List[List[Any]] = Field(..., description="二维数组数据")
    headers: List[str] = Field(..., description="表头列表")
    key_fields: List[str] = Field(default_factory=list, description="关键字段列表（用于检测重复）")


@router.post("/validate", summary="数据验证（导入前）")
async def validate_data(
    request: DataValidationRequest,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    导入前数据验证
    
    验证数据格式、完整性、关联性等。
    """
    try:
        report = await DataQualityService.validate_data_before_import(
            data=request.data,
            headers=request.headers,
            field_rules=request.field_rules,
            required_fields=request.required_fields,
            reference_data=request.reference_data
        )
        
        return {
            "success": True,
            "data": {
                "total_rows": report.total_rows,
                "valid_rows": report.valid_rows,
                "error_rows": report.error_rows,
                "warning_rows": report.warning_rows,
                "is_valid": report.is_valid,
                "issues": [
                    {
                        "row_index": issue.row_index,
                        "field": issue.field,
                        "issue_type": issue.issue_type,
                        "message": issue.message,
                        "suggestion": issue.suggestion,
                    }
                    for issue in report.issues
                ],
            },
        }
    except Exception as e:
        logger.error(f"数据验证失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"数据验证失败: {str(e)}"
        )


@router.post("/detect-issues", summary="检测数据问题")
async def detect_data_issues(
    request: DataCleaningRequest,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    检测数据问题并提供清洗建议
    
    检测重复数据、缺失数据、异常数据等。
    """
    try:
        suggestions = await DataQualityService.detect_data_issues(
            data=request.data,
            headers=request.headers,
            key_fields=request.key_fields
        )
        
        return {
            "success": True,
            "data": {
                "suggestions": [
                    {
                        "issue_type": suggestion.issue_type,
                        "description": suggestion.description,
                        "affected_rows": suggestion.affected_rows,
                        "suggestion": suggestion.suggestion,
                        "auto_fixable": suggestion.auto_fixable,
                    }
                    for suggestion in suggestions
                ],
            },
        }
    except Exception as e:
        logger.error(f"检测数据问题失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"检测数据问题失败: {str(e)}"
        )


@router.post("/quality-report", summary="生成数据质量报告")
async def generate_quality_report(
    validation_request: DataValidationRequest,
    cleaning_request: Optional[DataCleaningRequest] = None,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    生成数据质量报告
    
    综合验证报告和清洗建议，生成完整的数据质量报告。
    """
    try:
        # 执行验证
        validation_report = await DataQualityService.validate_data_before_import(
            data=validation_request.data,
            headers=validation_request.headers,
            field_rules=validation_request.field_rules,
            required_fields=validation_request.required_fields,
            reference_data=validation_request.reference_data
        )
        
        # 检测数据问题
        if cleaning_request:
            cleaning_suggestions = await DataQualityService.detect_data_issues(
                data=cleaning_request.data,
                headers=cleaning_request.headers,
                key_fields=cleaning_request.key_fields
            )
        else:
            cleaning_suggestions = await DataQualityService.detect_data_issues(
                data=validation_request.data,
                headers=validation_request.headers,
                key_fields=[]
            )
        
        # 生成质量报告
        quality_report = await DataQualityService.generate_quality_report(
            validation_report=validation_report,
            cleaning_suggestions=cleaning_suggestions
        )
        
        return {
            "success": True,
            "data": {
                "completeness": quality_report.completeness,
                "accuracy": quality_report.accuracy,
                "consistency": quality_report.consistency,
                "issues": [
                    {
                        "row_index": issue.row_index,
                        "field": issue.field,
                        "issue_type": issue.issue_type,
                        "message": issue.message,
                        "suggestion": issue.suggestion,
                    }
                    for issue in quality_report.issues
                ],
                "suggestions": [
                    {
                        "issue_type": suggestion.issue_type,
                        "description": suggestion.description,
                        "affected_rows": suggestion.affected_rows,
                        "suggestion": suggestion.suggestion,
                        "auto_fixable": suggestion.auto_fixable,
                    }
                    for suggestion in quality_report.suggestions
                ],
                "generated_at": quality_report.generated_at.isoformat(),
            },
        }
    except Exception as e:
        logger.error(f"生成数据质量报告失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"生成数据质量报告失败: {str(e)}"
        )

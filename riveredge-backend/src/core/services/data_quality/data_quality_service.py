"""
数据质量保障服务模块

提供数据验证、数据清洗建议、数据质量报告等功能。

Author: Luigi Lu
Date: 2026-01-27
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime
from loguru import logger


@dataclass
class ValidationIssue:
    """验证问题"""
    row_index: int
    field: str
    issue_type: str  # error, warning
    message: str
    suggestion: Optional[str] = None


@dataclass
class ValidationReport:
    """验证报告"""
    total_rows: int
    valid_rows: int
    error_rows: int
    warning_rows: int
    issues: List[ValidationIssue]
    is_valid: bool


@dataclass
class DataCleaningSuggestion:
    """数据清洗建议"""
    issue_type: str  # duplicate, anomaly, missing, format
    description: str
    affected_rows: List[int]
    suggestion: str
    auto_fixable: bool = False


@dataclass
class DataQualityReport:
    """数据质量报告"""
    completeness: float  # 完整性（0-100）
    accuracy: float  # 准确性（0-100）
    consistency: float  # 一致性（0-100）
    issues: List[ValidationIssue]
    suggestions: List[DataCleaningSuggestion]
    generated_at: datetime


class DataQualityService:
    """
    数据质量保障服务类
    
    提供数据验证、数据清洗建议、数据质量报告等功能。
    """
    
    @staticmethod
    async def validate_data_before_import(
        data: List[List[Any]],
        headers: List[str],
        field_rules: Dict[str, Dict[str, Any]],
        required_fields: List[str],
        reference_data: Optional[Dict[str, Any]] = None
    ) -> ValidationReport:
        """
        导入前数据验证
        
        Args:
            data: 二维数组数据（第一行是表头，从第二行开始是数据）
            headers: 表头列表
            field_rules: 字段验证规则（字段名 -> 规则）
            required_fields: 必填字段列表
            reference_data: 参考数据（用于关联性验证，如物料列表、仓库列表等）
            
        Returns:
            ValidationReport: 验证报告
        """
        issues: List[ValidationIssue] = []
        valid_rows = 0
        error_rows = 0
        warning_rows = 0
        
        # 验证表头
        missing_required_headers = [f for f in required_fields if f not in headers]
        if missing_required_headers:
            issues.append(ValidationIssue(
                row_index=0,
                field="表头",
                issue_type="error",
                message=f"缺少必填字段：{', '.join(missing_required_headers)}",
                suggestion="请确保表头包含所有必填字段"
            ))
            error_rows += 1
        
        # 验证数据行
        for row_index, row in enumerate(data[1:], start=2):  # 从第2行开始（第1行是表头）
            row_has_error = False
            row_has_warning = False
            
            # 验证必填字段
            for field in required_fields:
                if field not in headers:
                    continue
                field_index = headers.index(field)
                value = row[field_index] if field_index < len(row) else None
                
                if not value or (isinstance(value, str) and not value.strip()):
                    issues.append(ValidationIssue(
                        row_index=row_index,
                        field=field,
                        issue_type="error",
                        message=f"第{row_index}行：字段'{field}'不能为空",
                        suggestion=f"请填写字段'{field}'的值"
                    ))
                    row_has_error = True
            
            # 验证字段格式
            for field, rules in field_rules.items():
                if field not in headers:
                    continue
                field_index = headers.index(field)
                value = row[field_index] if field_index < len(row) else None
                
                if value is None:
                    continue
                
                # 验证数据类型
                if 'type' in rules:
                    expected_type = rules['type']
                    if expected_type == 'number' and not isinstance(value, (int, float)):
                        try:
                            float(value)
                        except (ValueError, TypeError):
                            issues.append(ValidationIssue(
                                row_index=row_index,
                                field=field,
                                issue_type="error",
                                message=f"第{row_index}行：字段'{field}'必须是数字",
                                suggestion=f"请将字段'{field}'的值改为数字格式"
                            ))
                            row_has_error = True
                    elif expected_type == 'date' and not isinstance(value, (datetime, str)):
                        issues.append(ValidationIssue(
                            row_index=row_index,
                            field=field,
                            issue_type="warning",
                            message=f"第{row_index}行：字段'{field}'日期格式可能不正确",
                            suggestion=f"请确保字段'{field}'的日期格式正确（如：YYYY-MM-DD）"
                        ))
                        row_has_warning = True
                
                # 验证数据范围
                if 'min' in rules and isinstance(value, (int, float)):
                    if value < rules['min']:
                        issues.append(ValidationIssue(
                            row_index=row_index,
                            field=field,
                            issue_type="error",
                            message=f"第{row_index}行：字段'{field}'的值不能小于{rules['min']}",
                            suggestion=f"请将字段'{field}'的值调整为大于等于{rules['min']}"
                        ))
                        row_has_error = True
                
                if 'max' in rules and isinstance(value, (int, float)):
                    if value > rules['max']:
                        issues.append(ValidationIssue(
                            row_index=row_index,
                            field=field,
                            issue_type="error",
                            message=f"第{row_index}行：字段'{field}'的值不能大于{rules['max']}",
                            suggestion=f"请将字段'{field}'的值调整为小于等于{rules['max']}"
                        ))
                        row_has_error = True
            
            # 验证数据关联性
            if reference_data:
                for field, ref_list in reference_data.items():
                    if field not in headers:
                        continue
                    field_index = headers.index(field)
                    value = row[field_index] if field_index < len(row) else None
                    
                    if value and ref_list and value not in ref_list:
                        issues.append(ValidationIssue(
                            row_index=row_index,
                            field=field,
                            issue_type="error",
                            message=f"第{row_index}行：字段'{field}'的值'{value}'不存在",
                            suggestion=f"请检查字段'{field}'的值，确保在系统中存在"
                        ))
                        row_has_error = True
            
            if row_has_error:
                error_rows += 1
            elif row_has_warning:
                warning_rows += 1
            else:
                valid_rows += 1
        
        return ValidationReport(
            total_rows=len(data) - 1,  # 减去表头
            valid_rows=valid_rows,
            error_rows=error_rows,
            warning_rows=warning_rows,
            issues=issues,
            is_valid=error_rows == 0
        )
    
    @staticmethod
    async def detect_data_issues(
        data: List[List[Any]],
        headers: List[str],
        key_fields: List[str]
    ) -> List[DataCleaningSuggestion]:
        """
        检测数据问题并提供清洗建议
        
        Args:
            data: 二维数组数据
            headers: 表头列表
            key_fields: 关键字段列表（用于检测重复）
            
        Returns:
            List[DataCleaningSuggestion]: 数据清洗建议列表
        """
        suggestions: List[DataCleaningSuggestion] = []
        
        # 检测重复数据
        if key_fields:
            seen = {}
            duplicates = []
            
            for row_index, row in enumerate(data[1:], start=2):
                key_values = []
                for field in key_fields:
                    if field in headers:
                        field_index = headers.index(field)
                        value = row[field_index] if field_index < len(row) else None
                        key_values.append(str(value) if value else '')
                
                key = '|'.join(key_values)
                if key in seen:
                    duplicates.append(row_index)
                    if seen[key] not in duplicates:
                        duplicates.append(seen[key])
                else:
                    seen[key] = row_index
            
            if duplicates:
                suggestions.append(DataCleaningSuggestion(
                    issue_type="duplicate",
                    description=f"发现{len(duplicates)}行重复数据（基于字段：{', '.join(key_fields)}）",
                    affected_rows=duplicates,
                    suggestion="建议合并重复数据或删除重复行",
                    auto_fixable=False
                ))
        
        # 检测缺失数据
        missing_data_rows = []
        for row_index, row in enumerate(data[1:], start=2):
            empty_count = sum(1 for cell in row if not cell or (isinstance(cell, str) and not cell.strip()))
            if empty_count > len(row) * 0.5:  # 如果超过50%的字段为空
                missing_data_rows.append(row_index)
        
        if missing_data_rows:
            suggestions.append(DataCleaningSuggestion(
                issue_type="missing",
                description=f"发现{len(missing_data_rows)}行数据缺失严重（超过50%字段为空）",
                affected_rows=missing_data_rows,
                suggestion="建议补充缺失数据或删除空行",
                auto_fixable=False
            ))
        
        # 检测异常数据（数值异常）
        numeric_fields = []
        for header in headers:
            # 简单判断：如果表头包含"数量"、"金额"、"价格"等关键词，认为是数值字段
            if any(keyword in header for keyword in ['数量', '金额', '价格', '数量', 'amount', 'price', 'quantity']):
                numeric_fields.append(header)
        
        if numeric_fields:
            anomaly_rows = []
            for row_index, row in enumerate(data[1:], start=2):
                for field in numeric_fields:
                    if field in headers:
                        field_index = headers.index(field)
                        value = row[field_index] if field_index < len(row) else None
                        if value:
                            try:
                                num_value = float(value)
                                # 检测负数或异常大的值
                                if num_value < 0 or num_value > 1000000000:
                                    anomaly_rows.append(row_index)
                                    break
                            except (ValueError, TypeError):
                                pass
            
            if anomaly_rows:
                suggestions.append(DataCleaningSuggestion(
                    issue_type="anomaly",
                    description=f"发现{len(anomaly_rows)}行数据异常（数值为负数或过大）",
                    affected_rows=anomaly_rows,
                    suggestion="建议检查并修正异常数值",
                    auto_fixable=False
                ))
        
        return suggestions
    
    @staticmethod
    async def generate_quality_report(
        validation_report: ValidationReport,
        cleaning_suggestions: List[DataCleaningSuggestion]
    ) -> DataQualityReport:
        """
        生成数据质量报告
        
        Args:
            validation_report: 验证报告
            cleaning_suggestions: 清洗建议列表
            
        Returns:
            DataQualityReport: 数据质量报告
        """
        total_rows = validation_report.total_rows
        if total_rows == 0:
            return DataQualityReport(
                completeness=0,
                accuracy=0,
                consistency=0,
                issues=validation_report.issues,
                suggestions=cleaning_suggestions,
                generated_at=datetime.now()
            )
        
        # 计算完整性（基于必填字段缺失情况）
        completeness = (validation_report.valid_rows / total_rows) * 100
        
        # 计算准确性（基于错误数量）
        error_rate = validation_report.error_rows / total_rows
        accuracy = (1 - error_rate) * 100
        
        # 计算一致性（基于重复数据）
        duplicate_count = sum(1 for s in cleaning_suggestions if s.issue_type == "duplicate")
        consistency = max(0, 100 - (duplicate_count * 10))  # 每个重复问题扣10分
        
        return DataQualityReport(
            completeness=round(completeness, 2),
            accuracy=round(accuracy, 2),
            consistency=round(consistency, 2),
            issues=validation_report.issues,
            suggestions=cleaning_suggestions,
            generated_at=datetime.now()
        )

"""
绩效数据 Schema 模块

定义绩效数据的 Pydantic Schema（假期、技能），用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator, ConfigDict
from typing import Optional, List
from datetime import datetime, date


class HolidayBase(BaseModel):
    """假期基础 Schema"""

    name: str = Field(..., max_length=200, description="假期名称")
    holiday_date: date = Field(..., description="假期日期", alias="holidayDate")
    holiday_type: Optional[str] = Field(None, max_length=50, description="假期类型", alias="holidayType")
    description: Optional[str] = Field(None, description="描述")
    is_active: bool = Field(True, description="是否启用", alias="isActive")

    model_config = ConfigDict(populate_by_name=True)

    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if not v or not v.strip():
            raise ValueError("假期名称不能为空")
        return v.strip()


class HolidayCreate(HolidayBase):
    """创建假期 Schema"""
    pass


class HolidayUpdate(BaseModel):
    """更新假期 Schema"""

    name: Optional[str] = Field(None, max_length=200, description="假期名称")
    holiday_date: Optional[date] = Field(None, description="假期日期", alias="holidayDate")
    holiday_type: Optional[str] = Field(None, max_length=50, description="假期类型", alias="holidayType")
    description: Optional[str] = Field(None, description="描述")
    is_active: Optional[bool] = Field(None, description="是否启用", alias="isActive")

    model_config = ConfigDict(populate_by_name=True)
    
    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("假期名称不能为空")
        return v.strip() if v else None


class HolidayResponse(HolidayBase):
    """假期响应 Schema"""

    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: int = Field(..., description="租户ID", alias="tenantId")
    created_at: datetime = Field(..., description="创建时间", alias="createdAt")
    updated_at: datetime = Field(..., description="更新时间", alias="updatedAt")
    created_by_name: Optional[str] = Field(None, description="创建人姓名", alias="createdByName")
    updated_by_name: Optional[str] = Field(None, description="更新人姓名", alias="updatedByName")
    deleted_at: Optional[datetime] = Field(None, description="删除时间", alias="deletedAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True, by_alias=True)


class HolidayCnImportRequest(BaseModel):
    """中国法定节假日 + 周休导入请求"""

    year: int = Field(..., ge=2007, le=2100, description="公历年份")
    rest_mode: str = Field(
        "double",
        description="休息制度：double=双休 / single=单休 / custom=自定义",
        alias="restMode",
    )
    rest_weekdays: Optional[List[int]] = Field(
        None,
        description="休息星期（Python weekday：周一=0 … 周日=6）；custom 必填",
        alias="restWeekdays",
    )

    model_config = ConfigDict(populate_by_name=True)


class HolidayCnImportResult(BaseModel):
    """中国法定节假日导入结果"""

    year: int = Field(..., description="导入年份")
    created: int = Field(0, description="新建条数")
    skipped: int = Field(0, description="因同日已存在而跳过条数")
    failed: int = Field(0, description="写入失败条数")
    legal_count: int = Field(0, description="法定休息候选数", alias="legalCount")
    weekend_count: int = Field(0, description="周休候选数", alias="weekendCount")

    model_config = ConfigDict(populate_by_name=True, by_alias=True)


class SkillBase(BaseModel):
    """技能基础 Schema"""

    code: str = Field(..., max_length=50, description="技能编码")
    name: str = Field(..., max_length=200, description="技能名称")
    category: Optional[str] = Field(None, max_length=50, description="技能分类")
    description: Optional[str] = Field(None, description="描述")
    is_active: bool = Field(True, description="是否启用", alias="isActive")

    model_config = ConfigDict(populate_by_name=True)

    @validator("code")
    def validate_code(cls, v):
        """验证编码格式"""
        if not v or not v.strip():
            raise ValueError("技能编码不能为空")
        return v.strip().upper()
    
    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if not v or not v.strip():
            raise ValueError("技能名称不能为空")
        return v.strip()


class SkillCreate(SkillBase):
    """创建技能 Schema"""
    pass


class SkillUpdate(BaseModel):
    """更新技能 Schema"""

    code: Optional[str] = Field(None, max_length=50, description="技能编码")
    name: Optional[str] = Field(None, max_length=200, description="技能名称")
    category: Optional[str] = Field(None, max_length=50, description="技能分类")
    description: Optional[str] = Field(None, description="描述")
    is_active: Optional[bool] = Field(None, description="是否启用", alias="isActive")

    model_config = ConfigDict(populate_by_name=True)
    
    @validator("code")
    def validate_code(cls, v):
        """验证编码格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("技能编码不能为空")
        return v.strip().upper() if v else None
    
    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("技能名称不能为空")
        return v.strip() if v else None


class SkillResponse(SkillBase):
    """技能响应 Schema"""

    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: int = Field(..., description="租户ID", alias="tenantId")
    created_at: datetime = Field(..., description="创建时间", alias="createdAt")
    updated_at: datetime = Field(..., description="更新时间", alias="updatedAt")
    created_by_name: Optional[str] = Field(None, description="创建人姓名", alias="createdByName")
    updated_by_name: Optional[str] = Field(None, description="更新人姓名", alias="updatedByName")
    deleted_at: Optional[datetime] = Field(None, description="删除时间", alias="deletedAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True, by_alias=True)


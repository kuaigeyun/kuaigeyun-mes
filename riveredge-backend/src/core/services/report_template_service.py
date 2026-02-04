"""
报表模板服务模块

提供报表模板的CRUD操作和配置验证功能。

Author: Luigi Lu
Date: 2025-01-15
"""

from typing import List, Optional, Dict, Any
from datetime import datetime

from core.models.report_template import ReportTemplate
from core.models.integration_config import IntegrationConfig
from core.schemas.report import (
    ReportTemplateCreate,
    ReportTemplateUpdate,
    ReportTemplateResponse,
    ReportTemplateListResponse,
    ReportConfig,
)
from core.services.base import BaseService
from core.services.report_engines import ExcelEngine
from infra.exceptions.exceptions import NotFoundError, ValidationError
from loguru import logger
import httpx

# 延迟导入 PDFEngine，因为在 Windows 上可能不可用
try:
    from core.services.report_engines import PDFEngine
except ImportError:
    PDFEngine = None  # type: ignore


class ReportTemplateService(BaseService):
    """
    报表模板服务类

    处理报表模板相关的所有业务逻辑。
    """

    async def create_template(
        self,
        tenant_id: int,
        template_data: ReportTemplateCreate,
        created_by: int,
    ) -> ReportTemplateResponse:
        """
        创建报表模板

        Args:
            tenant_id: 租户ID
            template_data: 模板数据
            created_by: 创建人ID

        Returns:
            ReportTemplateResponse: 创建的模板
        """
        # 验证编码唯一性
        existing = await ReportTemplate.filter(
            tenant_id=tenant_id,
            code=template_data.code,
        ).first()
        if existing:
            raise ValidationError(f"模板编码已存在: {template_data.code}")

        # 验证配置格式
        await self._validate_config(template_data.config)

        # 获取创建人信息
        user_info = await self.get_user_info(created_by)

        # 创建模板
        template = await ReportTemplate.create(
            tenant_id=tenant_id,
            name=template_data.name,
            code=template_data.code,
            type=template_data.type,
            category=template_data.category,
            config=template_data.config,
            status=template_data.status,
            is_default=template_data.is_default,
            description=template_data.description,
            created_by=created_by,
            created_by_name=user_info.get("name", ""),
        )

        return ReportTemplateResponse.model_validate(template)

    async def get_template(
        self,
        tenant_id: int,
        template_id: int,
    ) -> ReportTemplateResponse:
        """
        获取报表模板详情

        Args:
            tenant_id: 租户ID
            template_id: 模板ID

        Returns:
            ReportTemplateResponse: 模板详情
        """
        template = await ReportTemplate.get_or_none(
            id=template_id,
            tenant_id=tenant_id,
        )
        if not template:
            raise NotFoundError("报表模板不存在")

        return ReportTemplateResponse.model_validate(template)

    async def list_templates(
        self,
        tenant_id: int,
        type: Optional[str] = None,
        category: Optional[str] = None,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[ReportTemplateListResponse]:
        """
        获取报表模板列表

        Args:
            tenant_id: 租户ID
            type: 报表类型筛选（可选）
            category: 分类筛选（可选）
            status: 状态筛选（可选）
            skip: 跳过数量
            limit: 限制数量

        Returns:
            List[ReportTemplateListResponse]: 模板列表
        """
        query = ReportTemplate.filter(tenant_id=tenant_id)

        if type:
            query = query.filter(type=type)
        if category:
            query = query.filter(category=category)
        if status:
            query = query.filter(status=status)

        templates = await query.order_by('-created_at').offset(skip).limit(limit)
        return [ReportTemplateListResponse.model_validate(t) for t in templates]

    async def update_template(
        self,
        tenant_id: int,
        template_id: int,
        template_data: ReportTemplateUpdate,
        updated_by: int,
    ) -> ReportTemplateResponse:
        """
        更新报表模板

        Args:
            tenant_id: 租户ID
            template_id: 模板ID
            template_data: 更新数据
            updated_by: 更新人ID

        Returns:
            ReportTemplateResponse: 更新后的模板
        """
        template = await ReportTemplate.get_or_none(
            id=template_id,
            tenant_id=tenant_id,
        )
        if not template:
            raise NotFoundError("报表模板不存在")

        # 如果更新编码，验证唯一性
        if template_data.code and template_data.code != template.code:
            existing = await ReportTemplate.filter(
                tenant_id=tenant_id,
                code=template_data.code,
            ).first()
            if existing:
                raise ValidationError(f"模板编码已存在: {template_data.code}")

        # 如果更新配置，验证格式
        if template_data.config:
            await self._validate_config(template_data.config)

        # 获取更新人信息
        user_info = await self.get_user_info(updated_by)

        # 更新字段
        if template_data.name is not None:
            template.name = template_data.name
        if template_data.code is not None:
            template.code = template_data.code
        if template_data.type is not None:
            template.type = template_data.type
        if template_data.category is not None:
            template.category = template_data.category
        if template_data.config is not None:
            template.config = template_data.config
        if template_data.status is not None:
            template.status = template_data.status
        if template_data.is_default is not None:
            template.is_default = template_data.is_default
        if template_data.description is not None:
            template.description = template_data.description

        template.updated_by = updated_by
        template.updated_by_name = user_info.get("name", "")
        await template.save()

        return ReportTemplateResponse.model_validate(template)

    async def delete_template(
        self,
        tenant_id: int,
        template_id: int,
    ) -> None:
        """
        删除报表模板（软删除）

        Args:
            tenant_id: 租户ID
            template_id: 模板ID
        """
        template = await ReportTemplate.get_or_none(
            id=template_id,
            tenant_id=tenant_id,
        )
        if not template:
            raise NotFoundError("报表模板不存在")

        template.deleted_at = datetime.now()
        await template.save()

    async def _validate_config(self, config: Dict[str, Any]) -> None:
        """
        验证报表配置格式

        Args:
            config: 报表配置

        Raises:
            ValidationError: 配置格式错误时抛出
        """
        try:
            # 尝试解析为ReportConfig
            ReportConfig.model_validate(config)
        except Exception as e:
            logger.error(f"报表配置验证失败: {e}")
            raise ValidationError(f"报表配置格式错误: {str(e)}")

    async def generate_report(
        self,
        tenant_id: int,
        template_id: int,
        format: str = "excel",
        params: Optional[Dict[str, Any]] = None,
    ) -> bytes:
        """
        生成报表文件

        Args:
            tenant_id: 租户ID
            template_id: 模板ID
            format: 输出格式（excel/pdf）
            params: 报表参数（可选）

        Returns:
            bytes: 报表文件内容
        """
        # 获取模板
        template = await ReportTemplate.get_or_none(
            id=template_id,
            tenant_id=tenant_id,
        )
        if not template:
            raise NotFoundError("报表模板不存在")

        # 获取数据
        data = await self._fetch_report_data(template.config, params or {}, tenant_id)

        # 生成报表
        if format == "excel":
            engine = ExcelEngine()
            file_stream = engine.generate(template.config, data)
            return file_stream.read()
        elif format == "pdf":
            if PDFEngine is None:
                raise ValidationError(
                    "PDF 生成功能不可用。"
                    "在 Windows 上需要安装 GTK+ 运行时库。"
                    "请参考：https://doc.courtbouillon.org/weasyprint/stable/first_steps.html#installation"
                )
            engine = PDFEngine()
            file_stream = engine.generate(template.config, data)
            return file_stream.read()
        else:
            raise ValidationError(f"不支持的格式: {format}")

    async def _fetch_report_data(
        self,
        config: Dict[str, Any],
        params: Dict[str, Any],
        tenant_id: int,
    ) -> Dict[str, Any]:
        """
        获取报表数据

        Args:
            config: 报表配置
            params: 报表参数
            tenant_id: 租户ID

        Returns:
            Dict[str, Any]: 报表数据
        """
        data_sources = config.get("dataSources", {})
        result = {}
        
        for ds_id, ds_config in data_sources.items():
            ds_type = ds_config.get("type", "api")
            
            if ds_type == "api":
                # API数据源
                api_url = ds_config.get("url", "")
                if api_url:
                    try:
                        async with httpx.AsyncClient() as client:
                            response = await client.get(api_url, params=params)
                            response.raise_for_status()
                            result[ds_id] = response.json()
                    except Exception as e:
                        logger.error(f"获取API数据源失败: {e}")
                        result[ds_id] = []
                else:
                    result[ds_id] = []
            elif ds_type == "datasource":
                # 数据连接/数据源配置（统一为 IntegrationConfig）
                data_source_code = ds_config.get("code", "")
                if data_source_code:
                    try:
                        integration_config = await IntegrationConfig.get_or_none(
                            tenant_id=tenant_id,
                            code=data_source_code,
                            is_active=True,
                            deleted_at__isnull=True,
                        )
                        if integration_config:
                            # TODO: 根据类型执行查询
                            result[ds_id] = []
                        else:
                            result[ds_id] = []
                    except Exception as e:
                        logger.error(f"获取数据连接失败: {e}")
                        result[ds_id] = []
                else:
                    result[ds_id] = []
            else:
                # 默认返回空数组
                result[ds_id] = []
        
        return result


"""
打印模板管理服务模块

提供打印模板的 CRUD 操作和模板渲染功能。
"""

from typing import Optional, List, Any
from datetime import datetime

from tortoise.exceptions import IntegrityError

from core.models.print_template import PrintTemplate
from core.services.print.print_device_service import PrintDeviceService
from core.services.print.template_renderer import (
    is_pdfme_template,
    render_template,
    render_template_to_html,
)
from core.schemas.print_template import (
    PrintTemplateCreate,
    PrintTemplateUpdate,
    PrintTemplateRenderRequest,
    PrintTemplateCompileRequest,
    PrintTemplateCompilePreviewRequest,
)
from infra.exceptions.exceptions import NotFoundError, ValidationError
from loguru import logger


# 预设打印模板（新建租户时可选加载）
PRESET_PRINT_TEMPLATES = [
    {
        "name": "通用标签模板",
        "code": "default_label",
        "type": "html",
        "description": "通用标签打印模板，支持 {{code}}、{{name}}、{{quantity}} 等变量",
        "content": """<div style="padding:8px;border:1px solid #ccc;font-size:12px;">
  <div><strong>{{code}}</strong></div>
  <div>{{name}}</div>
  <div>数量: {{quantity}}</div>
</div>""",
        "config": {"document_type": "label"},
        "is_active": True,
    },
    {
        "name": "通用收据模板",
        "code": "default_receipt",
        "type": "html",
        "description": "通用收据打印模板，支持 {{title}}、{{items}}、{{total}} 等变量",
        "content": """<div style="padding:16px;font-size:14px;">
  <h3>{{title}}</h3>
  <div>{{items}}</div>
  <div>合计: {{total}}</div>
</div>""",
        "config": {"document_type": "receipt"},
        "is_active": True,
    },
]


class PrintTemplateService:
    @staticmethod
    def _resolve_render_engine(print_template: PrintTemplate) -> str:
        config = print_template.config or {}
        engine = config.get("engine")
        if isinstance(engine, str) and engine.strip():
            return engine.strip().lower()
        return "plain"

    @staticmethod
    def _resolve_strict_variables(print_template: PrintTemplate) -> bool:
        config = print_template.config or {}
        return bool(config.get("strict_variables", False))

    """
    打印模板管理服务类
    
    提供打印模板的 CRUD 操作和模板渲染功能。
    """
    
    @staticmethod
    async def create_print_template(
        tenant_id: int,
        data: PrintTemplateCreate
    ) -> PrintTemplate:
        """
        创建打印模板
        
        Args:
            tenant_id: 组织ID
            data: 打印模板创建数据
            
        Returns:
            PrintTemplate: 创建的打印模板对象
            
        Raises:
            ValidationError: 当模板代码已存在时抛出
        """
        try:
            # 如果 config 中包含 device_uuid，验证打印设备是否存在
            if data.config and data.config.get("device_uuid"):
                device_uuid = data.config.get("device_uuid")
                try:
                    await PrintDeviceService.get_print_device_by_uuid(tenant_id, device_uuid)
                except NotFoundError:
                    raise ValidationError(f"关联的打印设备不存在: {device_uuid}")
            
            print_template = PrintTemplate(
                tenant_id=tenant_id,
                **data.model_dump()
            )
            await print_template.save()
            
            # TODO: 可选集成 Inngest 函数注册
            # 如果需要通过 Inngest 异步执行打印，可以在这里注册函数
            
            return print_template
        except IntegrityError:
            raise ValidationError(f"打印模板代码 {data.code} 已存在")

    @staticmethod
    async def load_preset_sme(tenant_id: int) -> int:
        """
        加载打印模板预设数据。
        仅创建不存在的模板（按 code 去重）。
        """
        created = 0
        for item in PRESET_PRINT_TEMPLATES:
            exists = await PrintTemplate.filter(
                tenant_id=tenant_id,
                code=item["code"],
                deleted_at__isnull=True,
            ).exists()
            if not exists:
                try:
                    data = PrintTemplateCreate(
                        name=item["name"],
                        code=item["code"],
                        type=item["type"],
                        description=item.get("description"),
                        content=item["content"],
                        config=item.get("config"),
                    )
                    await PrintTemplateService.create_print_template(tenant_id, data)
                    created += 1
                except Exception as e:
                    logger.warning(f"创建打印模板 {item['code']} 失败: {e}")
        return created
    
    @staticmethod
    async def get_print_template_by_uuid(
        tenant_id: int,
        uuid: str
    ) -> PrintTemplate:
        """
        根据UUID获取打印模板
        
        Args:
            tenant_id: 组织ID
            uuid: 打印模板UUID
            
        Returns:
            PrintTemplate: 打印模板对象
            
        Raises:
            NotFoundError: 当打印模板不存在时抛出
        """
        print_template = await PrintTemplate.filter(
            tenant_id=tenant_id,
            uuid=uuid,
            deleted_at__isnull=True
        ).first()
        
        if not print_template:
            raise NotFoundError("打印模板不存在")
        
        return print_template
    
    @staticmethod
    async def list_print_templates(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        type: Optional[str] = None,
        is_active: Optional[bool] = None,
        document_type: Optional[str] = None
    ) -> List[PrintTemplate]:
        """
        获取打印模板列表
        
        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            type: 模板类型筛选
            is_active: 是否启用筛选
            document_type: 关联业务单据类型（按 config.document_type 筛选）
            
        Returns:
            List[PrintTemplate]: 打印模板列表
        """
        query = PrintTemplate.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if type:
            query = query.filter(type=type)
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        if document_type:
            query = query.filter(config__contains={"document_type": document_type})
        
        return await query.order_by("-created_at").offset(skip).limit(limit).all()
    
    @staticmethod
    async def update_print_template(
        tenant_id: int,
        uuid: str,
        data: PrintTemplateUpdate
    ) -> PrintTemplate:
        """
        更新打印模板
        
        Args:
            tenant_id: 组织ID
            uuid: 打印模板UUID
            data: 打印模板更新数据
            
        Returns:
            PrintTemplate: 更新后的打印模板对象
            
        Raises:
            NotFoundError: 当打印模板不存在时抛出
        """
        print_template = await PrintTemplateService.get_print_template_by_uuid(tenant_id, uuid)
        
        update_data = data.model_dump(exclude_unset=True)
        
        # 如果更新了 config 中的 device_uuid，验证打印设备是否存在
        if 'config' in update_data and update_data['config'] and update_data['config'].get("device_uuid"):
            device_uuid = update_data['config'].get("device_uuid")
            try:
                await PrintDeviceService.get_print_device_by_uuid(tenant_id, device_uuid)
            except NotFoundError:
                raise ValidationError(f"关联的打印设备不存在: {device_uuid}")
        
        # 合并 config（如果只更新了部分配置）
        if 'config' in update_data and update_data['config'] and print_template.config:
            # 合并现有配置和新配置
            merged_config = {**print_template.config, **update_data['config']}
            update_data['config'] = merged_config
        
        old_device_uuid = None
        if print_template.config and print_template.config.get("device_uuid"):
            old_device_uuid = print_template.config.get("device_uuid")
        
        for key, value in update_data.items():
            setattr(print_template, key, value)
        
        await print_template.save()
        
        # 如果打印设备 UUID 变更，异步通知打印设备服务
        new_device_uuid = None
        if print_template.config and print_template.config.get("device_uuid"):
            new_device_uuid = print_template.config.get("device_uuid")
        
        if old_device_uuid != new_device_uuid:
            import asyncio
            if old_device_uuid:
                asyncio.create_task(
                    PrintDeviceService._notify_templates_of_device_change(
                        tenant_id=tenant_id,
                        device_uuid=old_device_uuid
                    )
                )
            if new_device_uuid:
                asyncio.create_task(
                    PrintDeviceService._notify_templates_of_device_change(
                        tenant_id=tenant_id,
                        device_uuid=new_device_uuid
                    )
                )
        
        return print_template
    
    @staticmethod
    async def delete_print_template(
        tenant_id: int,
        uuid: str
    ) -> None:
        """
        删除打印模板（软删除）
        
        Args:
            tenant_id: 组织ID
            uuid: 打印模板UUID
            
        Raises:
            NotFoundError: 当打印模板不存在时抛出
        """
        print_template = await PrintTemplateService.get_print_template_by_uuid(tenant_id, uuid)
        print_template.deleted_at = datetime.now()
        await print_template.save()
    
    @staticmethod
    def render_template(
        template_content: str,
        data: dict,
        *,
        engine: str = "plain",
        strict_variables: bool = False,
    ) -> str:
        """
        渲染模板内容（变量替换）
        - pdfme 格式：不在此服务渲染（由上层进行降级处理）
        - 纯文本格式：{{key}} 替换，支持点号路径
        
        Args:
            template_content: 模板内容
            data: 模板数据
            
        Returns:
            str: 渲染后的内容
        """
        if is_pdfme_template(template_content):
            raise ValidationError("pdfme 模板不在该服务直接渲染范围内")
        return render_template(
            template_content,
            data,
            engine=engine,
            strict_variables=strict_variables,
        )

    @staticmethod
    def compile_designer_schema(
        data: PrintTemplateCompileRequest
    ) -> dict[str, Any]:
        """
        将可视化 schema 编译为 Jinja 模板（MVP）。
        """
        source_type = (data.source_type or "designer_json").strip().lower()
        target_engine = (data.target_engine or "jinja2").strip().lower()
        if target_engine != "jinja2":
            raise ValidationError("当前仅支持编译到 jinja2 引擎")

        warnings: list[str] = []
        schema_version: Optional[str] = None

        if source_type == "html_jinja":
            if not isinstance(data.source, str):
                raise ValidationError("html_jinja 源码必须为字符串")
            return {
                "success": True,
                "compiled_template": data.source,
                "schema_version": None,
                "warnings": warnings,
            }

        if source_type != "designer_json":
            raise ValidationError(f"不支持的 source_type: {source_type}")
        if not isinstance(data.source, dict):
            raise ValidationError("designer_json 源码必须为对象")

        schema = data.source
        schema_version = str(schema.get("version") or "v1")
        blocks = schema.get("blocks")
        if not isinstance(blocks, list):
            raise ValidationError("designer_schema.blocks 必须为数组")

        lines: list[str] = []
        for index, blk in enumerate(blocks):
            if not isinstance(blk, dict):
                warnings.append(f"block[{index}] 非对象，已跳过")
                continue
            blk_type = str(blk.get("type") or "").strip().lower()
            if blk_type == "text":
                lines.append(str(blk.get("content") or ""))
            elif blk_type == "field":
                field_key = str(blk.get("key") or "").strip()
                if not field_key:
                    warnings.append(f"block[{index}] field 缺少 key，已跳过")
                    continue
                lines.append(f"{{{{ {field_key} }}}}")
            elif blk_type == "if":
                condition = str(blk.get("condition") or "").strip()
                content = str(blk.get("content") or "")
                if not condition:
                    warnings.append(f"block[{index}] if 缺少 condition，已跳过")
                    continue
                lines.append(f"{{% if {condition} %}}{content}{{% endif %}}")
            elif blk_type == "for":
                item = str(blk.get("item") or "item").strip()
                collection = str(blk.get("collection") or "").strip()
                row_template = str(blk.get("template") or "")
                if not collection:
                    warnings.append(f"block[{index}] for 缺少 collection，已跳过")
                    continue
                if not row_template:
                    warnings.append(f"block[{index}] for 缺少 template，将生成空循环体")
                lines.append(f"{{% for {item} in {collection} %}}{row_template}{{% endfor %}}")
            elif blk_type == "detail_table":
                collection = str(blk.get("collection") or "").strip()
                row_alias = str(blk.get("row_alias") or "row").strip()
                columns = blk.get("columns")
                if not collection:
                    warnings.append(f"block[{index}] detail_table 缺少 collection，已跳过")
                    continue
                if not isinstance(columns, list) or len(columns) == 0:
                    warnings.append(f"block[{index}] detail_table 缺少 columns，已跳过")
                    continue
                header_cells: list[str] = []
                body_cells: list[str] = []
                for col in columns:
                    if not isinstance(col, dict):
                        continue
                    label = str(col.get("label") or "").strip()
                    key = str(col.get("key") or "").strip()
                    if not key:
                        continue
                    header_cells.append(f"<th>{label or key}</th>")
                    body_cells.append(f"<td>{{{{ {row_alias}.{key} }}}}</td>")
                if len(body_cells) == 0:
                    warnings.append(f"block[{index}] detail_table columns 无有效 key，已跳过")
                    continue
                table_html = (
                    "<table border=\"1\" cellpadding=\"4\" style=\"width:100%;border-collapse:collapse;\">"
                    f"<thead><tr>{''.join(header_cells)}</tr></thead>"
                    f"<tbody>{{% for {row_alias} in {collection} %}}<tr>{''.join(body_cells)}</tr>{{% endfor %}}</tbody>"
                    "</table>"
                )
                lines.append(table_html)
            elif blk_type == "html":
                lines.append(str(blk.get("content") or ""))
            else:
                warnings.append(f"block[{index}] 类型 {blk_type or 'unknown'} 暂不支持，已跳过")

        compiled = "\n".join(lines).strip()
        if not compiled:
            raise ValidationError("编译后模板为空，请检查设计器数据")
        return {
            "success": True,
            "compiled_template": compiled,
            "schema_version": schema_version,
            "warnings": warnings,
        }

    @staticmethod
    def compile_and_preview_designer_schema(
        data: PrintTemplateCompilePreviewRequest
    ) -> dict[str, Any]:
        """
        编译 schema 并使用预览数据执行一次 Jinja 渲染，返回 HTML 预览内容。
        """
        compiled = PrintTemplateService.compile_designer_schema(data)
        preview_data = data.preview_data or {}
        rendered_html = render_template(
            compiled["compiled_template"],
            preview_data,
            engine="jinja2",
            strict_variables=bool(data.strict_variables),
        )
        return {
            **compiled,
            "rendered_html": rendered_html,
        }

    @staticmethod
    async def render_print_template(
        tenant_id: int,
        uuid: str,
        data: PrintTemplateRenderRequest
    ) -> dict:
        """
        渲染打印模板
        
        Args:
            tenant_id: 组织ID
            uuid: 打印模板UUID
            data: 渲染请求数据
            
        Returns:
            dict: 渲染结果
            
        Raises:
            NotFoundError: 当打印模板不存在时抛出
            ValidationError: 当模板未启用时抛出
        """
        print_template = await PrintTemplateService.get_print_template_by_uuid(tenant_id, uuid)
        
        if not print_template.is_active:
            raise ValidationError("打印模板未启用")
        
        # 如果选择异步执行，通过 Inngest 执行
        if data.async_execution:
            # TODO: 集成 Inngest 异步执行
            # from core.inngest.client import inngest_client
            # from inngest import Event
            # await inngest_client.send_event(
            #     event=Event(
            #         name="print/render",
            #         data={
            #             "tenant_id": tenant_id,
            #             "template_id": str(print_template.uuid),
            #             "data": data.data,
            #             "output_format": data.output_format
            #         }
            #     )
            # )
            # return {
            #     "success": True,
            #     "async": True,
            #     "message": "打印任务已提交异步执行"
            # }
            raise ValidationError("异步执行功能待实现")
        
        # 同步渲染模板（pdfme 模板在上层服务中会提前降级）
        engine = PrintTemplateService._resolve_render_engine(print_template)
        strict_variables = PrintTemplateService._resolve_strict_variables(print_template)
        if data.output_format == "html" and not is_pdfme_template(print_template.content):
            rendered_content = render_template_to_html(
                print_template.content,
                data.data,
                engine=engine,
                strict_variables=strict_variables,
            )
        else:
            rendered_content = PrintTemplateService.render_template(
                print_template.content,
                data.data,
                engine=engine,
                strict_variables=strict_variables,
            )
        
        # 更新使用统计
        print_template.usage_count += 1
        print_template.last_used_at = datetime.now()
        await print_template.save()
        
        # TODO: 根据 output_format 生成文件（PDF、HTML等）
        # 目前只返回渲染后的内容
        return {
            "success": True,
            "output_format": data.output_format or "html",
            "content": rendered_content,
            "mime_type": "text/html" if (data.output_format or "html") == "html" else "text/plain",
            "message": "模板渲染成功"
        }


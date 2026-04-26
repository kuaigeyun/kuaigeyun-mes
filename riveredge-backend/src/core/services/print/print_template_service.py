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

        page_size = str(schema.get("pageSize") or "A4")
        orientation = str(schema.get("orientation") or "portrait")

        # Map paper size keys to dimensions for @page
        paper_size_map = {
            "A4": "210mm 297mm",
            "A3": "297mm 420mm",
            "A5": "148mm 210mm",
            "Letter": "216mm 279mm",
            "Legal": "216mm 356mm",
            "A4-2": "210mm 148.5mm",
            "A4-3": "210mm 99mm",
            "241-1": "241mm 280mm",
            "241-2": "241mm 140mm",
            "241-3": "241mm 93mm",
        }
        page_size_val = paper_size_map.get(page_size, page_size)

        margins = schema.get("margins", {"top": 10, "right": 10, "bottom": 10, "left": 10})
        margin_str = f"{margins.get('top', 10)}mm {margins.get('right', 10)}mm {margins.get('bottom', 10)}mm {margins.get('left', 10)}mm"



        def _get_style_str(blk: dict) -> str:
            style = blk.get("style", {})
            if not style:
                return ""
            css_parts = []
            if style.get("fontSize"):
                css_parts.append(f"font-size:{style['fontSize']};")
            if style.get("fontWeight"):
                css_parts.append(f"font-weight:{style['fontWeight']};")
            if style.get("textAlign"):
                css_parts.append(f"text-align:{style['textAlign']};")
            if style.get("color"):
                css_parts.append(f"color:{style['color']};")
            if style.get("letterSpacing"):
                css_parts.append(f"letter-spacing:{style['letterSpacing']};")
            return "".join(css_parts)

        lines: list[str] = []
        def _render_blocks(blocks_list: list, warnings_list: list) -> str:
            lines: list[str] = []
            for index, blk in enumerate(blocks_list):
                if not isinstance(blk, dict):
                    warnings_list.append(f"block[{index}] 非对象，已跳过")
                    continue
                blk_type = str(blk.get("type") or "").strip().lower()
                
                if blk_type == "text":
                    content = str(blk.get("content") or "")
                    tag = str(blk.get("tag") or "div").strip().lower()
                    style_str = _get_style_str(blk)
                    # For semantic tags like h1-h4, p, etc., we always wrap. 
                    # Default div also wraps if there is style.
                    if tag != "div":
                        # Add margin:0 to match designer behavior
                        s = f'margin:0;{style_str}'
                        lines.append(f'<{tag} style="{s}">{content}</{tag}>')
                    elif style_str:
                        lines.append(f'<div style="{style_str}">{content}</div>')
                    else:
                        lines.append(content)
                elif blk_type == "field":
                    field_key = str(blk.get("key") or "").strip()
                    label = str(blk.get("label") or field_key).strip()
                    show_label = blk.get("showLabel") is not False
                    
                    if not field_key:
                        warnings_list.append(f"block[{index}] field 缺少 key，已跳过")
                        continue
                    
                    content = f"{{{{ {field_key} }}}}"
                    if show_label:
                        content = f"{label}：{content}"
                        
                    style_str = _get_style_str(blk)
                    # 保留多行字段（如备注）里的换行符，避免在 HTML 中被折叠为空格。
                    field_style = f"{style_str}white-space:pre-wrap;"
                    lines.append(f'<div style="{field_style}">{content}</div>')
                elif blk_type == "if":
                    condition = str(blk.get("condition") or "").strip()
                    content = str(blk.get("content") or "")
                    if not condition:
                        warnings_list.append(f"block[{index}] if 缺少 condition，已跳过")
                        continue
                    lines.append(f"{{% if {condition} %}}{content}{{% endif %}}")
                elif blk_type == "for":
                    item = str(blk.get("item") or "item").strip()
                    collection = str(blk.get("collection") or "").strip()
                    row_template = str(blk.get("template") or "")
                    if not collection:
                        warnings_list.append(f"block[{index}] for 缺少 collection，已跳过")
                        continue
                    if not row_template:
                        warnings_list.append(f"block[{index}] for 缺少 template，将生成空循环体")
                    lines.append(f"{{% for {item} in {collection} %}}{row_template}{{% endfor %}}")
                elif blk_type == "qrcode":
                    field_key = str(blk.get("key") or "").strip()
                    size = blk.get("size", 120)
                    if not field_key:
                        warnings_list.append(f"block[{index}] qrcode 缺少 key，已跳过")
                        continue
                    style_str = _get_style_str(blk)
                    css = f' style="{style_str}"' if style_str else ""
                    # 预览样本缺少字段时，回退为字段名，避免空 src 导致破图。
                    qr_expr = f"{field_key} | default('{field_key}', true) | qrcode(size={size})"
                    lines.append(f'<div{css}><img src="{{{{ {qr_expr} }}}}" width="{size}" height="{size}" /></div>')
                elif blk_type == "barcode":
                    field_key = str(blk.get("key") or "").strip()
                    height = blk.get("height", 40)
                    fmt = str(blk.get("format") or "CODE128").strip()
                    if not field_key:
                        warnings_list.append(f"block[{index}] barcode 缺少 key，已跳过")
                        continue
                    style_str = _get_style_str(blk)
                    css = f' style="{style_str}"' if style_str else ""
                    # 与二维码一致：字段缺失时回退为字段名，保证预览可见。
                    barcode_expr = f"{field_key} | default('{field_key}', true) | barcode(fmt='{fmt}', height={height})"
                    lines.append(f'<div{css}><img src="{{{{ {barcode_expr} }}}}" height="{height}" /></div>')
                elif blk_type == "image":
                    url = str(blk.get("url") or "").strip()
                    width = blk.get("width", 100)
                    height = blk.get("height", 60)
                    preserve_ratio = blk.get("preserveAspectRatio", False)
                    if not url:
                        warnings_list.append(f"block[{index}] image 缺少 url，已跳过")
                        continue
                    style_str = _get_style_str(blk)
                    wrapper_css = f' style="{style_str}"' if style_str else ""
                    
                    img_attrs = [f'src="{url}"', f'width="{width}"']
                    img_styles = ["display:block;"]
                    
                    if preserve_ratio:
                        img_styles.append("height:auto;")
                    else:
                        img_attrs.append(f'height="{height}"')
                    
                    img_style_str = " ".join(img_styles)
                    lines.append(f'<div{wrapper_css}><img {" ".join(img_attrs)} style="{img_style_str}" /></div>')
                elif blk_type == "spacer":
                    height = blk.get("height", 20)
                    lines.append(f'<div style="height: {height}px;"></div>')
                elif blk_type == "divider":
                    lines.append('<hr style="border: 0; border-top: 1px solid #d9d9d9; margin: 8px 0;" />')
                elif blk_type == "columns":
                    cols = blk.get("cols", [])
                    horizontal_align = str(blk.get("horizontalAlign") or "start").strip().lower()
                    vertical_align = str(blk.get("verticalAlign") or "top").strip().lower()
                    justify_map = {
                        "start": "flex-start",
                        "center": "center",
                        "end": "flex-end",
                        "space-between": "space-between",
                        "space-around": "space-around",
                        "space-evenly": "space-evenly",
                    }
                    align_map = {
                        "top": "flex-start",
                        "middle": "center",
                        "bottom": "flex-end",
                        "stretch": "stretch",
                    }
                    cross_align_map = {
                        "start": "flex-start",
                        "center": "center",
                        "end": "flex-end",
                        "stretch": "stretch",
                    }
                    text_align_map = {
                        "start": "left",
                        "center": "center",
                        "end": "right",
                    }
                    justify_content = justify_map.get(horizontal_align, "flex-start")
                    align_items = align_map.get(vertical_align, "flex-start")
                    col_html = []
                    for col in cols:
                        if not isinstance(col, dict): continue
                        width = str(col.get("width") or "1")
                        col_horizontal_align = str(col.get("horizontalAlign") or "start").strip().lower()
                        col_vertical_align = str(col.get("verticalAlign") or "top").strip().lower()
                        col_justify_content = align_map.get(col_vertical_align, "flex-start")
                        col_align_items = cross_align_map.get(col_horizontal_align, "flex-start")
                        col_text_align = text_align_map.get(col_horizontal_align, "left")
                        inner_blocks = col.get("blocks", [])
                        inner_html = _render_blocks(inner_blocks, warnings_list)
                        col_html.append(
                            f'<div style="flex: {width}; display: flex;">'
                            f'<div style="display: flex; flex-direction: column; justify-content: {col_justify_content}; '
                            f'align-items: {col_align_items}; text-align: {col_text_align}; width: 100%; min-height: 100%;">'
                            f'{inner_html}'
                            f'</div>'
                            f'</div>'
                        )
                    lines.append(
                        f'<div style="display: flex; gap: 16px; width: 100%; '
                        f'justify-content: {justify_content}; align-items: stretch;">{ "".join(col_html) }</div>'
                    )
                elif blk_type == "detail_table":
                    collection = str(blk.get("collection") or "").strip()
                    row_alias = str(blk.get("row_alias") or "row").strip()
                    columns = blk.get("columns")
                    if not collection:
                        warnings_list.append(f"block[{index}] detail_table 缺少 collection，已跳过")
                        continue
                    if not isinstance(columns, list) or len(columns) == 0:
                        warnings_list.append(f"block[{index}] detail_table 缺少 columns，已跳过")
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
                        warnings_list.append(f"block[{index}] detail_table columns 无有效 key，已跳过")
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
                    warnings_list.append(f"block[{index}] 类型 {blk_type or 'unknown'} 暂不支持，已跳过")
            return "\n".join(lines).strip()

        compiled_body = _render_blocks(blocks, warnings)
        parts = []
        # Inject @page styles for printing
        parts.append("<style>")
        parts.append(f"  @page {{ size: {page_size_val} {orientation}; margin: {margin_str}; }}")
        parts.append("  body { margin: 0; padding: 0; }")
        parts.append("</style>")
        if compiled_body:
            parts.append(compiled_body)

        compiled = "\n".join(parts).strip()
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


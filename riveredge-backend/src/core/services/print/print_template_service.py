"""
打印模板管理服务模块

提供打印模板的 CRUD 操作和模板渲染功能。
"""

import re
from typing import Optional, List, Any, Set
from datetime import datetime

from tortoise.exceptions import IntegrityError
from tortoise.transactions import in_transaction

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
from core.utils.timezone_utils import resolve_business_datetime

# 设计器 / HTML 预览 / Playwright PDF 共用的正文字体栈：Linux 上 Chromium 往往没有「微软雅黑」，
# 若把 system-ui 放在最前会优先匹配拉丁无衬线 + 系统回退，易与 Windows 设计机不一致。
# 前置常见开源 CJK 字体（安装 fonts-noto-cjk 或 fonts-wqy-zenhei 等后 PDF 与预览更一致）。
_PRINT_TEMPLATE_BODY_FONT_STACK = (
    "'Noto Sans CJK SC', 'Noto Sans SC', 'Source Han Sans SC', "
    "'WenQuanYi Micro Hei', 'WenQuanYi Zen Hei', 'Microsoft YaHei', "
    "'PingFang SC', 'Hiragino Sans GB', "
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, Roboto, "
    "'Helvetica Neue', Helvetica, Arial, sans-serif"
)

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
    _CODE_SUFFIX_PATTERN = re.compile(r"^(?P<base>.+)_(?P<seq>\d+)$")

    @staticmethod
    def _normalize_base_code(raw_code: str) -> str:
        base = (raw_code or "").strip().upper()
        if not base:
            raise ValidationError("模板代码不能为空")
        matched = PrintTemplateService._CODE_SUFFIX_PATTERN.match(base)
        if matched:
            base = matched.group("base")
        # 预留后缀空间，避免超长（_ + 至少 3 位）
        return base[:46]

    @staticmethod
    async def _generate_template_code(tenant_id: int, raw_code: str, conn: Any) -> str:
        """
        生成模板代码：<base>_<seq>（如 QUOTATION_PRINT_001）。

        - 若传入已带后缀（如 XXX_003），会先剥离后缀后再按当前最大序号续增。
        - 软删除记录不参与占位。
        - 在事务内通过 pg_advisory_xact_lock 保证同 tenant+base 串行分配。
        """
        base = PrintTemplateService._normalize_base_code(raw_code)

        # 事务级别顾问锁：同 tenant + base 串行生成号段，根源避免并发重复。
        lock_key = f"print_template:{tenant_id}:{base}"
        await conn.execute_query("SELECT pg_advisory_xact_lock(hashtext($1))", [lock_key])

        # 同时纳入历史无后缀代码（如 QUOTATION_PRINT），按 seq=0 参与基线。
        rows = await conn.execute_query_dict(
            """
            SELECT code
            FROM core_print_templates
            WHERE tenant_id = $1
              AND deleted_at IS NULL
              AND (UPPER(code) = $2 OR UPPER(code) LIKE $3)
            FOR UPDATE
            """,
            [tenant_id, base, f"{base}_%"],
        )

        max_seq = 0
        for row in rows:
            code = str(row.get("code", "")).upper()
            if code == base:
                max_seq = max(max_seq, 0)
                continue
            m = PrintTemplateService._CODE_SUFFIX_PATTERN.match(code)
            if not m or m.group("base") != base:
                continue
            try:
                max_seq = max(max_seq, int(m.group("seq")))
            except ValueError:
                continue

        return f"{base}_{max_seq + 1:03d}"

    @staticmethod
    async def preview_next_template_code(tenant_id: int, raw_code: str) -> str:
        """
        预览下一个模板代码（用于前端显示）。

        说明：
        - 不占号、不加锁，仅用于 UI 预览；
        - 真正创建时仍以 create_print_template 的事务分配结果为准。
        """
        base = PrintTemplateService._normalize_base_code(raw_code)
        rows = await PrintTemplate.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).filter(
            code=base,
        ).values_list("code", flat=True)

        suffix_rows = await PrintTemplate.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            code__startswith=f"{base}_",
        ).values_list("code", flat=True)

        max_seq = 0
        if rows:
            max_seq = max(max_seq, 0)
        for code in suffix_rows:
            m = PrintTemplateService._CODE_SUFFIX_PATTERN.match(str(code).upper())
            if not m or m.group("base") != base:
                continue
            try:
                max_seq = max(max_seq, int(m.group("seq")))
            except ValueError:
                continue
        return f"{base}_{max_seq + 1:03d}"

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
        # 如果 config 中包含 device_uuid，验证打印设备是否存在
        if data.config and data.config.get("device_uuid"):
            device_uuid = data.config.get("device_uuid")
            try:
                await PrintDeviceService.get_print_device_by_uuid(tenant_id, device_uuid)
            except NotFoundError:
                raise ValidationError(f"关联的打印设备不存在: {device_uuid}")

        payload = data.model_dump()
        base_code = payload.get("code") or (payload.get("config") or {}).get("document_type")
        if not base_code:
            raise ValidationError("模板代码不能为空")

        try:
            async with in_transaction() as conn:
                payload["code"] = await PrintTemplateService._generate_template_code(
                    tenant_id=tenant_id,
                    raw_code=base_code,
                    conn=conn,
                )
                print_template = await PrintTemplate.create(
                    tenant_id=tenant_id,
                    **payload,
                    using_db=conn,
                )
            # TODO: 可选接入 Taskiq（如 print/render 事件 + dispatcher 注册处理器）
            return print_template
        except IntegrityError as e:
            logger.error("创建打印模板唯一约束冲突: tenant_id={} base_code={}", tenant_id, base_code)
            raise ValidationError(f"打印模板代码冲突，请重试。base={base_code}") from e

    @staticmethod
    async def load_preset_sme(
        tenant_id: int,
        *,
        installed_app_codes: Optional[Set[str]] = None,
    ) -> int:
        """
        加载打印模板预设数据。
        仅创建不存在的模板（按 code 去重）。
        """
        from core.services.system.installed_feature_scope import (
            print_template_visible_for_installed_apps,
        )

        created = 0
        for item in PRESET_PRINT_TEMPLATES:
            if installed_app_codes is not None and not print_template_visible_for_installed_apps(
                item.get("config"),
                installed_app_codes,
            ):
                continue
            base_code = str(item["code"]).strip().upper()
            exists = await PrintTemplate.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            ).filter(
                code=base_code,
            ).exists() or await PrintTemplate.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True,
                code__startswith=f"{base_code}_",
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
    async def load_all_preset_print_templates(tenant_id: int) -> int:
        """
        加载全部打印模板预设：核心通用模板 + 已安装应用的业务模板。
        与租户初始化 print_template_preset 步骤一致。
        """
        from core.services.system.installed_feature_scope import get_installed_application_codes

        installed = await get_installed_application_codes(tenant_id)
        count = await PrintTemplateService.load_preset_sme(
            tenant_id,
            installed_app_codes=installed,
        )
        if "kuaizhizao" in installed:
            from apps.kuaizhizao.services.print_template_presets import load_kuaizhizao_print_template_presets

            count += await load_kuaizhizao_print_template_presets(tenant_id)
        if "haoligo" in installed:
            from apps.haoligo.services.print_template_presets import load_haoligo_print_template_presets

            count += await load_haoligo_print_template_presets(tenant_id)
        return count
    
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
        document_type: Optional[str] = None,
        installed_app_codes: Optional[Set[str]] = None,
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
            installed_app_codes: 已安装应用；传入时按单据归属应用过滤列表
            
        Returns:
            List[PrintTemplate]: 打印模板列表
        """
        from core.services.system.installed_feature_scope import (
            print_template_visible_for_installed_apps,
        )

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

        if installed_app_codes is None:
            return await query.order_by("-created_at").offset(skip).limit(limit).all()

        scan_cap = 4000
        rows = await query.order_by("-created_at").limit(scan_cap).all()
        filtered = [
            r
            for r in rows
            if print_template_visible_for_installed_apps(r.config, installed_app_codes)
        ]
        return filtered[skip : skip + limit]
    
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
        print_template.deleted_at = resolve_business_datetime()
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
        # 兼容旧资产卡：仍声明 compileMode=asset_card_table 时走表格编译；
        # 新内置设备卡/模具卡为可视化 blocks，走下方通用编译。
        if str(schema.get("compileMode") or "").strip() == "asset_card_table":
            from apps.kuaizhizao.print.equipment_card import compile_asset_card_table_schema

            compiled = compile_asset_card_table_schema(schema)
            if not compiled:
                raise ValidationError("资产卡表格模板编译结果为空")
            return {
                "success": True,
                "compiled_template": compiled,
                "schema_version": schema_version,
                "warnings": [],
            }

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
            # 固定资产/设备信息卡常见规格（横版挂牌）；模具卡默认 60×50
            "ASSET-100x70": "100mm 70mm",
            "ASSET-120x80": "120mm 80mm",
            "ASSET-80x60": "80mm 60mm",
            "ASSET-60x50": "60mm 50mm",
        }
        page_size_val = paper_size_map.get(page_size, page_size)
        # 已是「宽 高」物理尺寸时不再拼 portrait/landscape，避免 Chromium 忽略自定义纸张回退 A4
        _has_explicit_dims = bool(
            re.search(r"\d+(?:\.\d+)?(?:mm|cm|in)\s+\d+(?:\.\d+)?(?:mm|cm|in)", page_size_val, re.I)
        )
        page_size_css = page_size_val if _has_explicit_dims else f"{page_size_val} {orientation}"

        margins = schema.get("margins", {"top": 10, "right": 10, "bottom": 10, "left": 10})
        margin_str = f"{margins.get('top', 10)}mm {margins.get('right', 10)}mm {margins.get('bottom', 10)}mm {margins.get('left', 10)}mm"

        # 收集页码页脚（首个含 {{ page_num }} 或 {{ total_pages }} 的 text 块），
        # 用于生成 @page 边距盒里的 CSS counter 内容（PDF 真实页码）。
        _PAGE_TOKEN_RE = re.compile(r"\{\{\s*(page_num|total_pages)\s*\}\}")
        collected_page_footers: list[dict] = []

        def _block_has_page_token(text: str) -> bool:
            return bool(_PAGE_TOKEN_RE.search(text or ""))

        def _build_page_counter_content(text: str) -> str:
            """把 '页码：{{ page_num }} / {{ total_pages }}' 转换为
            CSS content 形式：'页码：' counter(page) ' / ' counter(pages)。"""
            parts_inner: list[str] = []
            pos = 0
            for m in _PAGE_TOKEN_RE.finditer(text):
                if m.start() > pos:
                    literal = text[pos:m.start()]
                    esc = literal.replace("\\", "\\\\").replace("'", "\\'")
                    parts_inner.append(f"'{esc}'")
                token = m.group(1)
                parts_inner.append("counter(page)" if token == "page_num" else "counter(pages)")
                pos = m.end()
            if pos < len(text):
                literal = text[pos:]
                esc = literal.replace("\\", "\\\\").replace("'", "\\'")
                parts_inner.append(f"'{esc}'")
            return " ".join(parts_inner) if parts_inner else "''"



        item_spacing = schema.get("itemSpacing", 0)
        
        def _get_style_str(blk: dict, is_root: bool = False) -> str:
            style = blk.get("style", {}) if isinstance(blk.get("style"), dict) else {}
            css_parts = []
            # 允许设计器直接下发常用 CSS，便于固定资产卡等固定版式
            passthrough_keys = (
                "fontSize",
                "fontWeight",
                "textAlign",
                "color",
                "letterSpacing",
                "border",
                "borderTop",
                "borderRight",
                "borderBottom",
                "borderLeft",
                "padding",
                "paddingTop",
                "paddingRight",
                "paddingBottom",
                "paddingLeft",
                "margin",
                "marginTop",
                "marginRight",
                "marginBottom",
                "marginLeft",
                "background",
                "backgroundColor",
                "width",
                "height",
                "minHeight",
                "maxWidth",
                "whiteSpace",
                "overflow",
                "lineHeight",
                "boxSizing",
            )
            css_name = {
                "fontSize": "font-size",
                "fontWeight": "font-weight",
                "textAlign": "text-align",
                "letterSpacing": "letter-spacing",
                "borderTop": "border-top",
                "borderRight": "border-right",
                "borderBottom": "border-bottom",
                "borderLeft": "border-left",
                "paddingTop": "padding-top",
                "paddingRight": "padding-right",
                "paddingBottom": "padding-bottom",
                "paddingLeft": "padding-left",
                "marginTop": "margin-top",
                "marginRight": "margin-right",
                "marginBottom": "margin-bottom",
                "marginLeft": "margin-left",
                "backgroundColor": "background-color",
                "minHeight": "min-height",
                "maxWidth": "max-width",
                "whiteSpace": "white-space",
                "lineHeight": "line-height",
                "boxSizing": "box-sizing",
            }
            for key in passthrough_keys:
                val = style.get(key)
                if val is None or val == "":
                    continue
                css_parts.append(f"{css_name.get(key, key)}:{val};")

            # Apply global item spacing to root-level blocks
            if is_root and item_spacing > 0 and not style.get("marginBottom"):
                css_parts.append(f"margin-bottom:{item_spacing}mm;")

            return "".join(css_parts)

        def _col_width_css(width_raw: Any) -> str:
            """支持 flex 比例（如 1/2）或固定宽（如 14mm / 40%）。"""
            width = str(width_raw or "1").strip() or "1"
            lowered = width.lower()
            if any(lowered.endswith(u) for u in ("mm", "cm", "in", "px", "%")):
                return f"flex:0 0 {width};width:{width};max-width:{width};"
            if width.replace(".", "", 1).isdigit():
                return f"flex:{width};"
            return f"flex:{width};"

        lines: list[str] = []
        def _render_blocks(blocks_list: list, warnings_list: list, is_root: bool = False) -> str:
            lines: list[str] = []
            for index, blk in enumerate(blocks_list):
                if not isinstance(blk, dict):
                    warnings_list.append(f"block[{index}] 非对象，已跳过")
                    continue
                blk_type = str(blk.get("type") or "").strip().lower()
                
                if blk_type == "text":
                    content = str(blk.get("content") or "")
                    # Keep as plain text placeholders for designer stability. 
                    # We will replace them during PDF generation via Playwright.
                    
                    tag = str(blk.get("tag") or "div").strip().lower()
                    style_str = _get_style_str(blk, is_root)

                    is_page_counter = _block_has_page_token(content)
                    if is_page_counter:
                        # 仅采集首个，避免重复定义 @page 边距内容
                        if not collected_page_footers:
                            collected_page_footers.append(
                                {"text": content, "style": blk.get("style") or {}}
                            )
                    counter_class = " print-page-counter" if is_page_counter else ""

                    if is_root:
                        # 根级 text 由 .print-block 容器承载样式与间距
                        if tag != "div":
                            inner = f'<{tag} style="margin:0;">{content}</{tag}>'
                        else:
                            inner = content
                        lines.append(
                            f'<div class="print-block{counter_class}" style="{style_str}">{inner}</div>'
                        )
                    else:
                        # 嵌套 text（例如位于 columns 内）必须始终是一个块级元素：
                        # columns 的内栏使用 `display:flex;flex-direction:column;`，
                        # 如果不包一层，富文本里的内联元素会各自变成独立的 flex item，被强制换行。
                        cls_attr = (
                            f' class="print-page-counter"' if is_page_counter else ""
                        )
                        if tag != "div":
                            lines.append(
                                f'<{tag}{cls_attr} style="margin:0;{style_str}">{content}</{tag}>'
                            )
                        else:
                            lines.append(
                                f'<div{cls_attr} style="{style_str}">{content}</div>'
                            )
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
                        
                    style_str = _get_style_str(blk, is_root)
                    field_style = f"{style_str}white-space:pre-wrap;"
                    if is_root:
                        lines.append(f'<div class="print-block" style="{field_style}">{content}</div>')
                    else:
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
                    style_str = _get_style_str(blk, is_root)
                    css = f' style="{style_str}"' if style_str else ""
                    if is_root:
                        css = f' class="print-block"{css}'
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
                    style_str = _get_style_str(blk, is_root)
                    css = f' style="{style_str}"' if style_str else ""
                    if is_root:
                        css = f' class="print-block"{css}'
                    # 与二维码一致：字段缺失时回退为字段名，保证预览可见。
                    barcode_expr = f"{field_key} | default('{field_key}', true) | barcode(fmt='{fmt}', height={height})"
                    lines.append(f'<div{css}><img src="{{{{ {barcode_expr} }}}}" height="{height}" /></div>')
                elif blk_type == "image":
                    url = str(blk.get("url") or "").strip()
                    width = blk.get("width", 100)
                    height = blk.get("height", 60)
                    preserve_ratio = blk.get("keepRatio", blk.get("preserveAspectRatio", False))
                    if not url:
                        warnings_list.append(f"block[{index}] image 缺少 url，已跳过")
                        continue
                    style_str = _get_style_str(blk, is_root)
                    wrapper_css = f' style="{style_str}"' if style_str else ""
                    if is_root:
                        wrapper_css = f' class="print-block"{wrapper_css}'
                    
                    img_attrs = [f'src="{url}"', f'width="{width}"']
                    img_styles = ["display:block;"]
                    
                    if preserve_ratio:
                        img_styles.append("height:auto;")
                    else:
                        img_attrs.append(f'height="{height}"')
                    
                    img_style_str = " ".join(img_styles)
                    lines.append(f'<div{wrapper_css}><img {" ".join(img_attrs)} style="{img_style_str}" /></div>')
                elif blk_type == "seal_overlay":
                    url = str(blk.get("url") or "{{ company_seal }}").strip()
                    width = blk.get("width", 88)
                    height = blk.get("height", 88)
                    keep_ratio = blk.get("keepRatio", True)
                    content = str(blk.get("content") or "")
                    min_height = blk.get("minHeight", height)
                    seal_align = str(blk.get("sealAlign") or "center").strip().lower()
                    try:
                        offset_x = int(blk.get("sealOffsetX") or 0)
                    except (TypeError, ValueError):
                        offset_x = 0
                    try:
                        offset_y = int(blk.get("sealOffsetY") or 0)
                    except (TypeError, ValueError):
                        offset_y = 0
                    if seal_align == "left":
                        seal_pos = f"left:{offset_x}px;top:{offset_y}px;"
                    elif seal_align == "right":
                        seal_pos = f"right:{max(offset_x, 0)}px;top:{offset_y}px;left:auto;"
                    else:
                        seal_pos = (
                            f"left:50%;top:{offset_y}px;"
                            f"transform:translateX(calc(-50% + {offset_x}px));"
                        )
                    img_height_css = "height:auto;" if keep_ratio else f"height:{height}px;"
                    text_style_str = _get_style_str(blk, is_root=False)
                    wrapper_style_str = _get_style_str(blk, is_root) if is_root else ""
                    wrapper_css = f' style="{wrapper_style_str}"' if wrapper_style_str else ""
                    if is_root:
                        wrapper_css = f' class="print-block"{wrapper_css}'
                    img_html = (
                        f'<img src="{url}" width="{width}" '
                        f'style="position:absolute;z-index:0;{seal_pos}{img_height_css}'
                        f'opacity:0.88;pointer-events:none;" />'
                    )
                    text_html = (
                        f'<div style="position:relative;z-index:1;{text_style_str}">{content}</div>'
                    )
                    inner = (
                        f'<div style="position:relative;min-height:{min_height}px;width:100%;">'
                        f'{img_html}{text_html}'
                        f"</div>"
                    )
                    lines.append(f"<div{wrapper_css}>{inner}</div>")
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
                        width_css = _col_width_css(col.get("width") or "1")
                        col_horizontal_align = str(col.get("horizontalAlign") or "start").strip().lower()
                        col_vertical_align = str(col.get("verticalAlign") or "top").strip().lower()
                        col_justify_content = align_map.get(col_vertical_align, "flex-start")
                        col_align_items = cross_align_map.get(col_horizontal_align, "flex-start")
                        col_text_align = text_align_map.get(col_horizontal_align, "left")
                        inner_blocks = col.get("blocks", [])
                        inner_html = _render_blocks(inner_blocks, warnings_list, is_root=False)
                        col_html.append(
                            f'<div style="{width_css}display:flex;">'
                            f'<div style="position:relative;display: flex; flex-direction: column; justify-content: {col_justify_content}; '
                            f'align-items: {col_align_items}; text-align: {col_text_align}; width: 100%; min-height: 100%;">'
                            f'{inner_html}'
                            f'</div>'
                            f'</div>'
                        )
                    style_str = _get_style_str(blk, is_root)
                    gap = blk.get("gap")
                    if gap is None or gap == "":
                        gap_css = "16px"
                    else:
                        gap_s = str(gap).strip()
                        gap_css = gap_s if any(gap_s.lower().endswith(u) for u in ("mm", "px", "%")) else f"{gap_s}px"
                    container_style = (
                        f'display: flex; gap: {gap_css}; width: 100%; '
                        f'justify-content: {justify_content}; align-items: stretch; {style_str}'
                    )
                    wrapper_class = ' class="print-block"' if is_root else ""
                    lines.append(
                        f'<div{wrapper_class} style="{container_style}">{ "".join(col_html) }</div>'
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

                    ts_raw = blk.get("tableStyle")
                    ts = ts_raw if isinstance(ts_raw, dict) else {}

                    border_style = str(ts.get("borderStyle") or "solid").strip().lower()
                    if border_style not in ("solid", "dashed", "none"):
                        border_style = "solid"
                    try:
                        border_width = int(ts.get("borderWidth")) if ts.get("borderWidth") is not None else 1
                    except (TypeError, ValueError):
                        border_width = 1
                    border_color = str(ts.get("borderColor") or "#e2e8f0").strip()

                    try:
                        cell_padding = int(ts.get("cellPadding")) if ts.get("cellPadding") is not None else 8
                    except (TypeError, ValueError):
                        cell_padding = 8

                    font_size = str(ts.get("fontSize") or "13px").strip()
                    header_font_size = str(ts.get("headerFontSize") or font_size).strip()
                    header_font_weight = str(ts.get("headerFontWeight") or "600").strip()
                    header_bg = str(ts.get("headerBgColor") or "#f8fafc").strip()
                    header_tc = str(ts.get("headerTextColor") or "#475569").strip()
                    body_tc = str(ts.get("bodyTextColor") or "#334155").strip()
                    header_ta = str(ts.get("headerTextAlign") or "left").strip().lower()
                    body_ta = str(ts.get("bodyTextAlign") or "left").strip().lower()
                    if header_ta not in ("left", "center", "right"):
                        header_ta = "left"
                    if body_ta not in ("left", "center", "right"):
                        body_ta = "left"

                    v_raw = str(ts.get("verticalAlign") or "top").strip().lower()
                    vertical_align = {"top": "top", "middle": "middle", "bottom": "bottom"}.get(v_raw, "top")

                    table_width = str(ts.get("width") or "100%").strip()
                    zebra = ts.get("zebraStripe") is True
                    zebra_bg = str(ts.get("zebraBgColor") or "#fafafa").strip()

                    cell_border = ""
                    if border_style != "none":
                        cell_border = f"{border_width}px {border_style} {border_color}"

                    table_styles = ["border-collapse:collapse", "table-layout:auto", f"width:{table_width}"]
                    if cell_border:
                        table_styles.append(f"border:{cell_border}")

                    def _col_text_align(raw: str, fallback: str) -> str:
                        v = raw.strip().lower()
                        return v if v in ("left", "center", "right") else fallback

                    def _col_vertical_align(raw: str, fallback: str) -> str:
                        v = raw.strip().lower()
                        return v if v in ("top", "middle", "bottom") else fallback

                    header_cells: list[str] = []
                    body_cells: list[str] = []
                    colgroup_parts: list[str] = []
                    for col in columns:
                        if not isinstance(col, dict):
                            continue
                        label = str(col.get("label") or "").strip()
                        key = str(col.get("key") or "").strip()
                        col_type = str(col.get("type") or "text").strip().lower()
                        if not key:
                            continue
                        cw = str(col.get("width") or "").strip()
                        if cw:
                            colgroup_parts.append(f'<col style="width:{cw}" />')
                        else:
                            colgroup_parts.append("<col />")

                        col_body_ta = _col_text_align(str(col.get("bodyTextAlign") or ""), body_ta)
                        col_va = _col_vertical_align(str(col.get("verticalAlign") or ""), vertical_align)

                        th_parts = []
                        if cell_border:
                            th_parts.append(f"border:{cell_border}")
                        th_parts.extend(
                            [
                                f"padding:{cell_padding}px",
                                f"font-size:{header_font_size}",
                                f"font-weight:{header_font_weight}",
                                f"background-color:{header_bg}",
                                f"color:{header_tc}",
                                f"text-align:{header_ta}",
                                f"vertical-align:{col_va}",
                                "word-break:break-word",
                            ]
                        )
                        th_style_attr = ";".join(th_parts)

                        td_parts = []
                        if cell_border:
                            td_parts.append(f"border:{cell_border}")
                        td_parts.extend(
                            [
                                f"padding:{cell_padding}px",
                                f"font-size:{font_size}",
                                f"color:{body_tc}",
                                f"text-align:{col_body_ta}",
                                f"vertical-align:{col_va}",
                                "word-break:break-word",
                            ]
                        )
                        td_style_attr = ";".join(td_parts)

                        header_cells.append(f'<th style="{th_style_attr}">{label or key}</th>')

                        if col_type == "image":
                            body_cells.append(
                                f'<td style="{td_style_attr}"><img src="{{{{ {row_alias}.{key} }}}}" '
                                'style="display:block;max-width:100px;max-height:60px;object-fit:contain;" /></td>'
                            )
                        elif col_type == "qrcode":
                            qr_expr = f"{row_alias}.{key} | qrcode(size=60)"
                            body_cells.append(
                                f'<td style="{td_style_attr}"><img src="{{{{ {qr_expr} }}}}" width="60" height="60" /></td>'
                            )
                        elif col_type == "number":
                            raw_prec = col.get("precision")
                            try:
                                prec = int(raw_prec)
                                prec = max(0, min(prec, 12))
                            except (TypeError, ValueError):
                                prec = 2
                            body_cells.append(
                                f'<td style="{td_style_attr}">{{{{ {row_alias}.{key} | number({prec}) }}}}</td>'
                            )
                        else:
                            body_cells.append(f'<td style="{td_style_attr}">{{{{ {row_alias}.{key} }}}}</td>')
                    if len(body_cells) == 0:
                        warnings_list.append(f"block[{index}] detail_table columns 无有效 key，已跳过")
                        continue

                    colgroup_html = f"<colgroup>{''.join(colgroup_parts)}</colgroup>" if colgroup_parts else ""

                    zebra_tr_attr = ""
                    if zebra:
                        zebra_tr_attr = (
                            ' style="background-color: {% if loop.index0 % 2 == 1 %}'
                            + zebra_bg.replace('"', "")
                            + '{% else %}transparent{% endif %}"'
                        )

                    table_style_attr = ";".join(table_styles)
                    table_html = (
                        f'<table style="{table_style_attr}">{colgroup_html}'
                        f"<thead><tr>{''.join(header_cells)}</tr></thead>"
                        f"<tbody>{{% for {row_alias} in {collection} %}}<tr{zebra_tr_attr}>{''.join(body_cells)}</tr>{{% endfor %}}</tbody>"
                        "</table>"
                    )
                    lines.append(table_html)
                elif blk_type == "html":
                    lines.append(str(blk.get("content") or ""))
                else:
                    warnings_list.append(f"block[{index}] 类型 {blk_type or 'unknown'} 暂不支持，已跳过")
            return "\n".join(lines).strip()

        compiled_body = _render_blocks(blocks, warnings, is_root=True)

        # 生成 @page 边距盒里的页码样式（PDF 真实页码由 Chromium 计数）。
        # body 里的页码块会被同时打上 .print-page-counter 类，print 媒体下隐藏，
        # 避免 PDF 同时出现页脚原文 + 边距盒页码导致重复。
        page_margin_css = ""
        if collected_page_footers:
            pf = collected_page_footers[0]
            pf_text = str(pf.get("text") or "")
            pf_style = pf.get("style") or {}
            counter_content = _build_page_counter_content(pf_text)
            decls: list[str] = []
            fs = pf_style.get("fontSize")
            if fs is not None and str(fs).strip():
                fs_str = str(fs).strip()
                if fs_str.isdigit():
                    fs_str = f"{fs_str}px"
                decls.append(f"font-size:{fs_str};")
            if pf_style.get("color"):
                decls.append(f"color:{pf_style['color']};")
            if pf_style.get("fontWeight"):
                decls.append(f"font-weight:{pf_style['fontWeight']};")
            decls.append("text-align:center;")
            decl_str = "".join(decls)
            page_margin_css = (
                f"  @page {{ @bottom-center {{ content: {counter_content}; {decl_str} }} }}"
            )

        parts = []
        # 与设计器预览保持一致的关键打印样式
        parts.append("<style>")
        parts.append(f"  @page {{ size: {page_size_css}; margin: {margin_str}; }}")
        if page_margin_css:
            parts.append(page_margin_css)
        parts.append("  html, body { width: 100%; }")
        parts.append("  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }")
        parts.append(
            "  body { margin: 0 !important; padding: 0 !important; "
            f"font-family: {_PRINT_TEMPLATE_BODY_FONT_STACK}; "
            "line-height: 1.5; color: #334155; }")
        parts.append("  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; table-layout: auto; border: 1px solid #e2e8f0; }")
        parts.append("  th, td { border: 1px solid #e2e8f0; padding: 8px 12px; word-break: break-word; text-align: left; vertical-align: top; font-size: 13px; }")
        parts.append("  th { background-color: #f8fafc; font-weight: 600; color: #475569; }")
        parts.append("  thead { display: table-header-group; }")
        parts.append("  tr, td, th { page-break-inside: avoid; }")
        parts.append("  img { max-width: 100%; height: auto; display: block; }")
        # Ensure blocks respect item_spacing strictly
        parts.append("  .print-block { width: 100%; position: relative; }")
        parts.append(
            "  .print-repeat-page { page-break-after: always; break-after: page; }"
        )
        parts.append(
            "  .print-repeat-page:last-child { page-break-after: auto; break-after: auto; }"
        )
        # 打印时隐藏 body 中的页脚原文（页码已在 @page 边距盒里渲染）
        parts.append("  @media print { .print-page-counter { display: none !important; } }")
        parts.append("</style>")
        # 固定资产卡等：设计器画一张卡，打印时按集合循环（每张卡一页）
        repeat_collection = str(schema.get("repeatCollection") or "").strip()
        repeat_item = str(schema.get("repeatItem") or "item").strip() or "item"
        if compiled_body and repeat_collection:
            compiled_body = (
                f"{{% for {repeat_item} in {repeat_collection} %}}"
                f'<div class="print-repeat-page">'
                f"{compiled_body}"
                f"</div>"
                f"{{% endfor %}}"
            )
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
        # 设计预览默认把页码注入为 1 / 1，使页脚原文里出现 {{ page_num }} / {{ total_pages }} 的
        # text 块在预览中能看到「页码：1 / 1」。打印 PDF 时该元素会通过
        # @media print { .print-page-counter { display:none } } 隐藏，
        # 实际页码改由 @page @bottom-center 的 CSS counter 渲染。
        preview_data = dict(data.preview_data or {})
        preview_data.setdefault("page_num", 1)
        preview_data.setdefault("total_pages", 1)
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
        
        # 如果选择异步执行，应通过 Taskiq（如 dispatch_event + 已注册 handler）执行
        if data.async_execution:
            # TODO: 集成 Taskiq 异步执行，例如：
            # from core.tasks.dispatcher import dispatch_event, TaskEvent
            # await dispatch_event(TaskEvent(
            #     name="print/render",
            #     data={
            #         "tenant_id": tenant_id,
            #         "template_id": str(print_template.uuid),
            #         "data": data.data,
            #         "output_format": data.output_format,
            #     },
            # ))
            # return {"success": True, "async": True, "message": "打印任务已提交异步执行"}
            raise ValidationError("异步执行功能待实现")
        
        # 同步渲染模板（pdfme 模板在上层服务中会提前降级）
        engine = PrintTemplateService._resolve_render_engine(print_template)
        strict_variables = PrintTemplateService._resolve_strict_variables(print_template)
        template_content = print_template.content or ""
        # 设计器声明了 repeatCollection，但 content 缺少 for 循环时（旧编译/保存丢失），按 schema 重编译
        config = print_template.config if isinstance(print_template.config, dict) else {}
        schema = config.get("designer_schema") if isinstance(config.get("designer_schema"), dict) else None
        if schema:
            repeat_collection = str(schema.get("repeatCollection") or "").strip()
            repeat_item = str(schema.get("repeatItem") or "item").strip() or "item"
            for_token = f"{{% for {repeat_item} in {repeat_collection} %}}"
            compile_mode = str(schema.get("compileMode") or "").strip()
            need_rebuild = False
            if repeat_collection and for_token not in template_content:
                need_rebuild = True
            if compile_mode == "asset_card_table" and "eq-asset-card" not in template_content:
                need_rebuild = True
            if need_rebuild:
                try:
                    rebuilt = PrintTemplateService.compile_designer_schema(
                        PrintTemplateCompileRequest(
                            source_type="designer_json",
                            source=schema,
                            target_engine="jinja2",
                        )
                    )
                    rebuilt_content = str(rebuilt.get("compiled_template") or "").strip()
                    if rebuilt_content:
                        template_content = rebuilt_content
                        print_template.content = rebuilt_content
                        await print_template.save()
                except Exception:
                    pass
        if data.output_format == "html" and not is_pdfme_template(template_content):
            rendered_content = render_template_to_html(
                template_content,
                data.data,
                engine=engine,
                strict_variables=strict_variables,
            )
        else:
            rendered_content = PrintTemplateService.render_template(
                template_content,
                data.data,
                engine=engine,
                strict_variables=strict_variables,
            )
        
        # 更新使用统计
        print_template.usage_count += 1
        print_template.last_used_at = resolve_business_datetime()
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


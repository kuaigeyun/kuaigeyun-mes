"""
打印模板渲染模块

支持两种渲染引擎：
- plain：纯文本 {{key}} 变量替换（向后兼容）
- jinja2：Jinja2 沙箱渲染（支持循环/条件/过滤器）
"""

import json
import re
import io
import base64
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, Mapping, Optional

from infra.exceptions.exceptions import ValidationError

try:
    from jinja2 import StrictUndefined
    from jinja2.exceptions import TemplateError
    from jinja2.sandbox import SandboxedEnvironment
except Exception:  # pragma: no cover - 缺依赖时运行期显式报错
    StrictUndefined = None
    TemplateError = Exception
    SandboxedEnvironment = None


def is_pdfme_template(content: str) -> bool:
    """检测 content 是否为 pdfme 模板 JSON 格式"""
    try:
        obj = json.loads(content)
        return (
            isinstance(obj, dict)
            and (obj.get("basePdf") is not None or obj.get("schemas") is not None)
        )
    except (json.JSONDecodeError, TypeError):
        return False


def _resolve_value(key: str, data: Dict[str, Any]) -> Any:
    """按点号路径从嵌套 dict 中取值，如 operations.0.operation_name"""
    keys = key.strip().split(".")
    val: Any = data
    for k in keys:
        if val is None:
            return ""
        if isinstance(val, dict) and k in val:
            val = val[k]
        elif isinstance(val, list) and k.isdigit():
            idx = int(k)
            if 0 <= idx < len(val):
                val = val[idx]
            else:
                return ""
        else:
            return ""
    if val is None:
        return ""
    return val


def _format_value(val: Any) -> str:
    """将值格式化为字符串"""
    if val is None:
        return ""
    if isinstance(val, str) and val == "None":
        return ""
    if isinstance(val, (dict, list)):
        return json.dumps(val, ensure_ascii=False)
    return str(val)


def render_plain_template(template_content: str, data: Dict[str, Any]) -> str:
    """
    渲染纯文本模板：替换 {{key}} 占位符，支持点号路径

    Args:
        template_content: 模板内容（纯文本）
        data: 模板变量数据

    Returns:
        替换后的文本
    """
    pattern = re.compile(r"\{\{([^}]+)\}\}")
    matches = list(pattern.finditer(template_content))
    result = template_content
    for m in reversed(matches):
        key = m.group(1).strip()
        value = _resolve_value(key, data)
        str_value = _format_value(value)
        result = result[: m.start()] + str_value + result[m.end() :]
    return result


def _jinja_filter_money(value: Any) -> str:
    if value is None or value == "":
        return "0.00"
    try:
        return f"{float(value):,.2f}"
    except Exception:
        return str(value)


def _jinja_filter_date(value: Any, fmt: str = "%Y-%m-%d") -> str:
    if value is None or value == "":
        return ""
    try:
        if isinstance(value, datetime):
            return value.strftime(fmt)
        if isinstance(value, date):
            return value.strftime(fmt)
        if isinstance(value, str):
            txt = value.strip()
            if not txt:
                return ""
            iso = txt.replace("Z", "+00:00")
            dt = datetime.fromisoformat(iso)
            return dt.strftime(fmt)
    except Exception:
        return str(value)
    return str(value)


def _jinja_filter_number(value: Any, digits: int = 2) -> str:
    if value is None or value == "":
        return ""
    try:
        d = Decimal(str(value))
        q = Decimal("1") if digits <= 0 else Decimal(f"1.{'0' * digits}")
        return format(d.quantize(q), "f")
    except Exception:
        return str(value)


def _jinja_filter_qrcode(value: Any, size: int = 120) -> str:
    """生成二维码并返回 base64 data URL"""
    if not value:
        return ""
    try:
        import qrcode
        from PIL import Image

        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=1,
        )
        qr.add_data(str(value))
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")
        # Resize according to size param (roughly)
        # box_size=10 means 10px per module.
        # For a better control, we resize the final image.
        resampling = getattr(Image, "Resampling", None)
        if resampling is not None:
            resample_filter = resampling.LANCZOS
        else:
            # Pillow<9 兼容分支
            resample_filter = getattr(Image, "LANCZOS", getattr(Image, "ANTIALIAS", Image.BICUBIC))
        img = img.resize((size, size), resample_filter)

        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
        return f"data:image/png;base64,{img_str}"
    except Exception as e:
        return ""


def _jinja_filter_barcode(value: Any, fmt: str = "CODE128", height: int = 40) -> str:
    """生成条形码并返回 base64 data URL"""
    if not value:
        return ""
    try:
        import barcode
        from barcode.writer import ImageWriter

        fmt_map = {
            "CODE128": "code128",
            "EAN13": "ean13",
            "EAN": "ean13",
            "UPC": "upca",
            "CODE39": "code39",
            "ITF": "itf",
        }
        b_type = fmt_map.get(fmt.upper(), "code128")
        coder = barcode.get_barcode_class(b_type)
        
        # python-barcode options
        # module_height is in mm by default in some writers, but in ImageWriter it's px?
        # Actually ImageWriter uses dpi (default 300).
        options = {
            "module_height": height / 2, # Rough adjustment
            "text_distance": 1,
            "font_size": 8,
            "quiet_zone": 2,
        }
        
        buffered = io.BytesIO()
        coder(str(value), writer=ImageWriter()).write(buffered, options=options)
        img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
        return f"data:image/png;base64,{img_str}"
    except Exception as e:
        return ""


def _jinja_finalize(value: Any) -> Any:
    """Jinja 输出阶段统一收口：None / 字面量 'None' 都渲染为空串，避免业务字段缺失时出现「None」。"""
    if value is None:
        return ""
    if isinstance(value, str) and value == "None":
        return ""
    return value


def _build_jinja_environment(
    *,
    strict_variables: bool = False,
    extra_filters: Optional[Mapping[str, Any]] = None,
) -> SandboxedEnvironment:
    if SandboxedEnvironment is None or StrictUndefined is None:
        raise ValidationError("Jinja2 依赖未安装，无法使用 jinja2 渲染引擎")
    env_kwargs = {
        "autoescape": False,
        "trim_blocks": True,
        "lstrip_blocks": True,
        "finalize": _jinja_finalize,
    }
    if strict_variables:
        env_kwargs["undefined"] = StrictUndefined
    env = SandboxedEnvironment(**env_kwargs)
    env.filters["money"] = _jinja_filter_money
    env.filters["date"] = _jinja_filter_date
    env.filters["number"] = _jinja_filter_number
    env.filters["qrcode"] = _jinja_filter_qrcode
    env.filters["barcode"] = _jinja_filter_barcode
    if extra_filters:
        for k, v in extra_filters.items():
            env.filters[k] = v
    return env


def render_jinja_template(
    template_content: str,
    data: Dict[str, Any],
    *,
    strict_variables: bool = False,
) -> str:
    """
    使用 Jinja2 沙箱渲染模板。
    """
    if is_pdfme_template(template_content):
        raise ValidationError("pdfme 模板不在该渲染器处理范围内")
    try:
        env = _build_jinja_environment(strict_variables=strict_variables)
        template = env.from_string(template_content)
        return template.render(**(data or {}))
    except TemplateError as exc:
        raise ValidationError(f"Jinja2 模板渲染失败: {exc}") from exc


def render_template(
    template_content: str,
    data: Dict[str, Any],
    *,
    engine: str = "plain",
    strict_variables: bool = False,
) -> str:
    """
    统一模板渲染入口。
    """
    render_engine = (engine or "plain").strip().lower()
    if render_engine == "jinja2":
        return render_jinja_template(
            template_content,
            data,
            strict_variables=strict_variables,
        )
    if render_engine == "plain":
        return render_plain_template(template_content, data)
    raise ValidationError(f"不支持的模板渲染引擎: {render_engine}")


_HTML_TAG_RE = re.compile(r"<\s*[a-zA-Z!][^>]*>")


def _looks_like_html(content: str) -> bool:
    """粗略判断模板是否已经是 HTML（含标签或 DOCTYPE）。"""
    if not content:
        return False
    s = content.lstrip()
    if s.lower().startswith("<!doctype") or s.startswith("<html"):
        return True
    return bool(_HTML_TAG_RE.search(content))


def render_template_to_html(
    template_content: str,
    data: Dict[str, Any],
    *,
    engine: str = "plain",
    strict_variables: bool = False,
) -> str:
    """
    渲染模板并输出为 HTML，用于服务端打印接口。

    - 当模板内容本身已是 HTML（设计器编译产物 / 含标签的自定义模板）时，
      仅做最小包装（`<!DOCTYPE html><html><head><meta charset>...</head><body>{...}</body></html>`），
      不再做 `\n -> <br>` 替换，也不再注入会与编译模板 `body{margin:0}` / `@page` 边距冲突的样式。
    - 当模板是纯文本时，沿用旧逻辑：换行转 `<br>`、双空格转 `&nbsp;` 并加上一份默认的可读字号。
    """
    if is_pdfme_template(template_content):
        raise ValidationError("pdfme 模板不在该渲染器处理范围内")

    text = render_template(
        template_content,
        data,
        engine=engine,
        strict_variables=strict_variables,
    )

    if _looks_like_html(template_content):
        # HTML 模板：保留所有空白与换行，不再注入会破坏样式的全局 body 规则。
        # 让设计器编译模板里的 <style>@page{...}; body{margin:0;...} 完整生效。
        return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>打印</title>
</head>
<body>
{text}
</body>
</html>"""

    html_body = text.replace("\n", "<br>").replace("  ", "&nbsp;&nbsp;")
    return f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>打印</title>
    <style>
        body {{ font-family: "Microsoft YaHei", sans-serif; margin: 20px; line-height: 1.6; }}
    </style>
</head>
<body>
{html_body}
</body>
</html>"""

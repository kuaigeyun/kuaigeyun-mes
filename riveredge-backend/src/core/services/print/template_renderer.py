"""
打印模板渲染模块

支持纯文本 {{key}} 变量替换。pdfme 格式模板由前端渲染。
"""

import json
import re
from typing import Any, Dict

from infra.exceptions.exceptions import ValidationError


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


def render_template_to_html(template_content: str, data: Dict[str, Any]) -> str:
    """
    渲染模板并输出为 HTML，用于服务端打印接口

    Args:
        template_content: 模板内容
        data: 模板变量数据

    Returns:
        HTML 字符串
    """
    if is_pdfme_template(template_content):
        raise ValidationError("pdfme 模板请在前端渲染，后端不支持 pdfme 格式")
    text = render_plain_template(template_content, data)
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

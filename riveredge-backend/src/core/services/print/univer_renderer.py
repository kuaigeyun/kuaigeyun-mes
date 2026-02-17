"""
Univer 文档模板渲染模块

解析 Univer JSON 格式的模板，在 body.dataStream 中替换 {{key}} 占位符，
支持点号路径（如 operations.0.operation_name）从嵌套数据结构取值。
"""

import json
import re
from typing import Any, Dict


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


def is_univer_document(content: str) -> bool:
    """检测 content 是否为 Univer 文档 JSON 格式"""
    try:
        obj = json.loads(content)
        return isinstance(obj, dict) and "body" in obj and isinstance(obj.get("body"), dict)
    except (json.JSONDecodeError, TypeError):
        return False


def render_univer_template(content: str, data: Dict[str, Any]) -> str:
    """
    渲染 Univer 文档模板：在 body.dataStream 中替换 {{key}} 占位符

    Args:
        content: Univer 文档 JSON 字符串
        data: 模板变量数据，支持嵌套结构

    Returns:
        替换后的 Univer JSON 字符串
    """
    doc = json.loads(content)
    body = doc.get("body")
    if not body or not isinstance(body, dict):
        return content

    data_stream = body.get("dataStream")
    if not isinstance(data_stream, str):
        return content

    # 查找所有 {{key}} 占位符
    pattern = re.compile(r"\{\{([^}]+)\}\}")
    matches = list(pattern.finditer(data_stream))

    # 从后向前替换，避免索引偏移
    result = data_stream
    for m in reversed(matches):
        key = m.group(1).strip()
        value = _resolve_value(key, data)
        str_value = _format_value(value)
        result = result[: m.start()] + str_value + result[m.end() :]

    body["dataStream"] = result
    doc["body"] = body

    return json.dumps(doc, ensure_ascii=False)


def univer_data_stream_to_plain_text(content: str) -> str:
    """
    从 Univer JSON 中提取 dataStream 的纯文本（用于生成简单 HTML 打印）
    不进行变量替换，仅提取现有文本。
    """
    try:
        doc = json.loads(content)
        body = doc.get("body")
        if not body or not isinstance(body, dict):
            return ""
        data_stream = body.get("dataStream", "")
        if not isinstance(data_stream, str):
            return ""
        # 移除 Univer 特殊字符（如段落分隔符 \r 等），保留可读文本
        return data_stream.replace("\r", "\n").strip()
    except (json.JSONDecodeError, TypeError):
        return ""


def render_univer_to_html(content: str, data: Dict[str, Any]) -> str:
    """
    渲染 Univer 模板并输出为简单 HTML，用于服务端打印接口
    """
    rendered_json = render_univer_template(content, data)
    # 从替换后的 JSON 中提取 dataStream 文本
    text = univer_data_stream_to_plain_text(rendered_json)
    # 将换行转为 <br>，生成可打印的 HTML
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

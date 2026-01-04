"""
PDF报表生成引擎模块

使用WeasyPrint生成PDF报表文件。

Author: Luigi Lu
Date: 2025-01-15
"""

from typing import Dict, Any
from io import BytesIO
from loguru import logger

# 延迟导入 WeasyPrint，避免在 Windows 上启动失败
# 如果导入失败，PDFEngine 类仍然可以加载，但生成 PDF 时会抛出友好的错误
WEASYPRINT_AVAILABLE = False
WEASYPRINT_ERROR = None

try:
    from weasyprint import HTML, CSS
    WEASYPRINT_AVAILABLE = True
except (ImportError, OSError) as e:
    # ImportError: 模块未安装
    # OSError: 库文件缺失（Windows 上常见，缺少 GTK+ 运行时）
    WEASYPRINT_ERROR = str(e)


class PDFEngine:
    """
    PDF报表生成引擎

    使用WeasyPrint生成PDF文件。
    """

    def generate(self, config: Dict[str, Any], data: Dict[str, Any]) -> BytesIO:
        """
        生成PDF报表

        Args:
            config: 报表配置
            data: 报表数据

        Returns:
            BytesIO: PDF文件流

        Raises:
            RuntimeError: WeasyPrint 不可用时抛出
        """
        if not WEASYPRINT_AVAILABLE:
            error_msg = (
                "WeasyPrint 不可用。"
                "在 Windows 上需要安装 GTK+ 运行时库。"
                "请参考：https://doc.courtbouillon.org/weasyprint/stable/first_steps.html#installation"
            )
            if WEASYPRINT_ERROR:
                error_msg += f"\n错误详情: {WEASYPRINT_ERROR}"
            raise RuntimeError(error_msg)

        # 使用顶层导入的 HTML（如果 WEASYPRINT_AVAILABLE 为 True，HTML 已经可用）

        # 生成HTML内容
        html_content = self._generate_html(config, data)

        # 转换为PDF
        html = HTML(string=html_content)
        pdf_bytes = html.write_pdf()

        # 保存到内存
        output = BytesIO(pdf_bytes)
        output.seek(0)

        return output

    def _generate_html(self, config: Dict[str, Any], data: Dict[str, Any]) -> str:
        """
        生成HTML内容

        Args:
            config: 报表配置
            data: 数据

        Returns:
            str: HTML内容
        """
        components = config.get("components", [])
        
        html_parts = [
            "<!DOCTYPE html>",
            "<html>",
            "<head>",
            "<meta charset='UTF-8'>",
            "<style>",
            "body { font-family: 'Microsoft YaHei', Arial, sans-serif; padding: 20px; }",
            "table { border-collapse: collapse; width: 100%; margin: 10px 0; }",
            "th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }",
            "th { background-color: #4472C4; color: white; }",
            "h1, h2, h3 { margin: 10px 0; }",
            "</style>",
            "</head>",
            "<body>",
        ]

        # 渲染组件
        for component in components:
            html_parts.append(self._render_component_html(component, data))

        html_parts.extend([
            "</body>",
            "</html>",
        ])

        return "\n".join(html_parts)

    def _render_component_html(self, component: Dict[str, Any], data: Dict[str, Any]) -> str:
        """
        渲染组件HTML

        Args:
            component: 组件配置
            data: 数据

        Returns:
            str: HTML片段
        """
        component_type = component.get("type")

        if component_type == "table":
            return self._render_table_html(component, data)
        elif component_type == "text":
            return self._render_text_html(component)
        elif component_type == "chart":
            # PDF中图表需要转换为图片，这里简化实现
            logger.warning("PDF图表渲染暂未实现")
            return "<div>图表组件（暂未实现）</div>"
        elif component_type == "image":
            return self._render_image_html(component)
        else:
            return ""

    def _render_table_html(self, component: Dict[str, Any], data: Dict[str, Any]) -> str:
        """
        渲染表格HTML

        Args:
            component: 组件配置
            data: 数据

        Returns:
            str: HTML片段
        """
        table_data = data.get(component.get("data_source", ""), [])
        columns = component.get("columns", [])

        html_parts = ["<table>", "<thead>", "<tr>"]

        # 表头
        for col in columns:
            html_parts.append(f"<th>{col.get('title', col.get('dataIndex', ''))}</th>")

        html_parts.extend(["</tr>", "</thead>", "<tbody>"])

        # 数据行
        for row_data in table_data:
            html_parts.append("<tr>")
            for col in columns:
                data_index = col.get("dataIndex", "")
                value = row_data.get(data_index, "")
                html_parts.append(f"<td>{value}</td>")
            html_parts.append("</tr>")

        html_parts.extend(["</tbody>", "</table>"])

        return "\n".join(html_parts)

    def _render_text_html(self, component: Dict[str, Any]) -> str:
        """
        渲染文本HTML

        Args:
            component: 组件配置

        Returns:
            str: HTML片段
        """
        content = component.get("content", "")
        text_type = component.get("textType", "paragraph")

        if text_type == "title":
            level = component.get("level", 1)
            return f"<h{level}>{content}</h{level}>"
        elif text_type == "label":
            return f"<strong>{content}</strong>"
        else:
            return f"<p>{content}</p>"

    def _render_image_html(self, component: Dict[str, Any]) -> str:
        """
        渲染图片HTML

        Args:
            component: 组件配置

        Returns:
            str: HTML片段
        """
        src = component.get("src", "")
        alt = component.get("alt", "")
        return f'<img src="{src}" alt="{alt}" style="max-width: 100%;" />'


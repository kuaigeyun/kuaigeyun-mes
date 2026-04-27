"""
报表生成引擎模块初始化

Author: Luigi Lu
Date: 2025-01-15
"""

from .excel_engine import ExcelEngine

__all__ = ["ExcelEngine", "PDFEngine"]


def __getattr__(name: str):
    if name == "PDFEngine":
        # 仅在真正需要 PDF 输出时加载，避免应用启动阶段引入额外依赖噪音
        from .pdf_engine import PDFEngine

        return PDFEngine
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


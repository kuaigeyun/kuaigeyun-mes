"""
报表生成引擎模块初始化

Author: Luigi Lu
Date: 2025-01-15
"""

from .excel_engine import ExcelEngine

# PDFEngine 在 Windows 上可能不可用（需要 GTK+ 运行时），使用延迟导入
try:
    from .pdf_engine import PDFEngine
    __all__ = [
        "ExcelEngine",
        "PDFEngine",
    ]
except (ImportError, OSError):
    # 如果 PDFEngine 导入失败（通常是 WeasyPrint 依赖问题），只导出 ExcelEngine
    # PDFEngine 将在使用时抛出更友好的错误
    # ImportError: 模块导入失败
    # OSError: 库文件缺失（Windows 上常见，缺少 GTK+ 运行时）
    PDFEngine = None  # type: ignore
    __all__ = [
        "ExcelEngine",
    ]


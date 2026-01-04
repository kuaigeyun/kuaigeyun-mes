"""
报表API模块初始化

Author: Luigi Lu
Date: 2025-01-15
"""

from .report_templates import router as report_templates_router

__all__ = [
    "report_templates_router",
]


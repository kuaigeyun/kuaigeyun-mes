"""
二维码服务模块

提供二维码生成和解析服务。
"""

from .qrcode_service import (
    QRCodeService,
    QRCODE_TYPE_MAT,
    QRCODE_TYPE_WO,
    QRCODE_TYPE_OP,
    QRCODE_TYPE_EQ,
    QRCODE_TYPE_EMP,
    QRCODE_TYPE_BOX,
    QRCODE_TYPE_TRACE,
    VALID_QRCODE_TYPES,
)

__all__ = [
    "QRCodeService",
    "QRCODE_TYPE_MAT",
    "QRCODE_TYPE_WO",
    "QRCODE_TYPE_OP",
    "QRCODE_TYPE_EQ",
    "QRCODE_TYPE_EMP",
    "QRCODE_TYPE_BOX",
    "QRCODE_TYPE_TRACE",
    "VALID_QRCODE_TYPES",
]

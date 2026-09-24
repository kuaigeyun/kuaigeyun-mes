"""工程图纸打印水印策略 Schema"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from apps.master_data.models.drawing_watermark import DRAWING_WATERMARK_POSITIONS

DrawingWatermarkPosition = Literal[
    "diagonal",
    "center",
    "topLeft",
    "topRight",
    "bottomLeft",
    "bottomRight",
]


class DrawingWatermarkStyleResponse(BaseModel):
    opacity: float
    angle: int
    font_size: int = Field(..., alias="fontSize")
    color: str
    position: DrawingWatermarkPosition

    model_config = ConfigDict(populate_by_name=True)


class DrawingWatermarkPolicyResponse(BaseModel):
    is_enabled: bool = Field(..., alias="isEnabled")
    force_on_print: bool = Field(..., alias="forceOnPrint")
    opacity: float
    angle: int
    font_size: int = Field(..., alias="fontSize")
    color: str
    position: DrawingWatermarkPosition
    template_public: str = Field(..., alias="templatePublic")
    template_internal: str = Field(..., alias="templateInternal")
    template_secret: str = Field(..., alias="templateSecret")
    template_confidential: str = Field(..., alias="templateConfidential")

    model_config = ConfigDict(populate_by_name=True)


class DrawingWatermarkPolicyUpdate(BaseModel):
    is_enabled: bool = Field(..., alias="isEnabled")
    force_on_print: bool = Field(..., alias="forceOnPrint")
    opacity: float
    angle: int
    font_size: int = Field(..., alias="fontSize")
    color: str = Field(..., max_length=32)
    position: DrawingWatermarkPosition
    template_public: str = Field(..., alias="templatePublic")
    template_internal: str = Field(..., alias="templateInternal")
    template_secret: str = Field(..., alias="templateSecret")
    template_confidential: str = Field(..., alias="templateConfidential")

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("opacity")
    @classmethod
    def validate_opacity(cls, v: float) -> float:
        if v < 0.05 or v > 0.5:
            raise ValueError("水印透明度须在 0.05 至 0.5 之间")
        return v

    @field_validator("font_size")
    @classmethod
    def validate_font_size(cls, v: int) -> int:
        if v < 12 or v > 120:
            raise ValueError("水印字号须在 12 至 120 之间")
        return v

    @field_validator("position")
    @classmethod
    def validate_position(cls, v: str) -> str:
        if v not in DRAWING_WATERMARK_POSITIONS:
            raise ValueError(f"水印位置无效，允许: {', '.join(sorted(DRAWING_WATERMARK_POSITIONS))}")
        return v

    @field_validator("color")
    @classmethod
    def validate_color(cls, v: str) -> str:
        val = (v or "").strip()
        if not val:
            raise ValueError("水印颜色不能为空")
        return val

"""
自定义字段类型规范（唯一真源）

管理端、Schema 校验、字段值读写均以此为准。
"""

CUSTOM_FIELD_TYPES = (
    "text",
    "number",
    "date",
    "time",
    "datetime",
    "select",
    "multiselect",
    "textarea",
    "json",
    "image",
    "file",
    "associated_object",
    "associated_attribute",
    "formula",
)

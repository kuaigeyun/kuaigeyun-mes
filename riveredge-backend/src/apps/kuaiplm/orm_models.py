"""Tortoise ORM 模块注册（运行时按应用中心启用状态加载）。"""

ORM_MODEL_MODULES: list[str] = [
    "apps.kuaiplm.models.gate_template",
    "apps.kuaiplm.models.knowledge_base",
    "apps.kuaiplm.models.phase2",
    "apps.kuaiplm.models.rd_project",
]

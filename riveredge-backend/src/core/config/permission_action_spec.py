"""功能权限动作规范（RBAC 层）。"""

from __future__ import annotations

STANDARD_ACTIONS: set[str] = {
    "create",
    "read",
    "update",
    "delete",
    "assign",
    "audit",
    "submit",
    "approve",
    "reject",
    "revoke",
    "execute",
    "complete",
    "import",
    "export",
    "print",
    "display",
    # 已在应用 manifest 使用的业务动作（新增须先登记此处再写入 manifest）
    "claim",
    "recycle",
    "release",
    "collaborate",
    "publish",
    "close",
    "obsolete",
    # 试模单等业务子操作（manifest 声明后由路由路径映射，勿用 update 代替）
    "dispatch",
    "recall",
    "confirm_adjustment",
}

def canonical_action(action: str) -> str:
    return (action or "").strip().lower()


def is_standard_action(action: str) -> bool:
    return canonical_action(action) in STANDARD_ACTIONS


# 功能权限展示文案唯一真源（权限同步 name、角色矩阵 label）；排序见 manifest.permissions 数组顺序
ACTION_DISPLAY_LABELS: dict[str, str] = {
    "create": "新建",
    "read": "查看",
    "update": "编辑",
    "delete": "删除",
    "import": "导入",
    "export": "导出",
    "print": "打印",
    "display": "展示",
    "submit": "提交",
    "audit": "审核",
    "approve": "审核",
    "reject": "审核",
    "assign": "分配",
    "execute": "执行",
    "complete": "完修",
    "revoke": "撤销",
    "dispatch": "发出",
    "confirm_adjustment": "确认调整",
    "recall": "确认收回",
    "claim": "认领",
    "recycle": "回收",
    "release": "释放",
    "collaborate": "协作",
    "publish": "发布",
    "close": "关闭",
    "obsolete": "作废",
}

PERMISSION_CODE_DISPLAY_LABELS: dict[str, str] = {
    "kuaizhizao:rework-order:release": "下达",
    "haoligo:equipment-documents-acceptance:submit": "调试",
    "haoligo:equipment-documents-acceptance:execute": "试产",
    "haoligo:equipment-documents-acceptance:complete": "台账结案",
    "system:application-connection:execute": "同步通讯录",
}


def permission_code_display_label(code: str) -> str:
    normalized = (code or "").strip().lower()
    return PERMISSION_CODE_DISPLAY_LABELS.get(normalized, "")


# 编写 manifest.permissions 时的动作顺序参考
MANIFEST_ACTION_ORDER: tuple[str, ...] = (
    "read",
    "create",
    "delete",
    "update",
    "display",
    "import",
    "export",
    "submit",
    "revoke",
    "approve",
    "audit",
    "reject",
    "print",
    "assign",
    "execute",
    "complete",
    "close",
    "obsolete",
    "claim",
    "recycle",
    "release",
    "publish",
    "dispatch",
    "recall",
    "confirm_adjustment",
)


def action_display_label(action: str) -> str:
    act = canonical_action(action)
    return ACTION_DISPLAY_LABELS.get(act, act or "未知动作")

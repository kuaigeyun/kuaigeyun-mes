"""系统级菜单真源配置（用于落库同步）。"""

from __future__ import annotations

from typing import Any, Dict


SYSTEM_MENU_CONFIG: Dict[str, Any] = {
    "title": "menu.system",
    "path": "/system",
    "permission": "system:entry:read",
    "icon": "Setting",
    "sort_order": 10,
    "children": [
        {
            "title": "menu.group.core-config",
            "sort_order": 10,
            "children": [
                {"title": "menu.system.applications", "path": "/system/applications", "permission": "system:application:read", "sort_order": 1},
                {"title": "menu.system.menus", "path": "/system/menus", "permission": "system:menu:read", "sort_order": 2},
                {"title": "menu.system.site-settings", "path": "/system/site-settings", "permission": "system:site-setting:read", "sort_order": 3},
                {"title": "menu.system.business-config", "path": "/system/config-center", "permission": "system:config-center:read", "sort_order": 4},
                {"title": "menu.system.data-dictionaries", "path": "/system/data-dictionaries", "permission": "system:data-dictionary:read", "sort_order": 5},
                {"title": "menu.system.languages", "path": "/system/languages", "permission": "system:language:read", "sort_order": 6},
                {"title": "menu.system.code-rules", "path": "/system/code-rules", "permission": "system:code-rule:read", "sort_order": 7},
                {"title": "menu.system.custom-fields", "path": "/system/custom-fields", "permission": "system:custom-field:read", "sort_order": 8},
                {"title": "menu.system.onboarding-wizard", "path": "/system/onboarding-wizard", "permission": "system:onboarding-wizard:read", "sort_order": 9},
            ],
        },
        {
            "title": "menu.group.user-management",
            "sort_order": 20,
            "children": [
                {"title": "menu.system.departments", "path": "/system/departments", "permission": "system:department:read", "sort_order": 1},
                {"title": "menu.system.positions", "path": "/system/positions", "permission": "system:position:read", "sort_order": 2},
                {"title": "menu.system.roles-permissions", "path": "/system/roles", "permission": "system:role:read", "sort_order": 3},
                {"title": "menu.system.users", "path": "/system/users", "permission": "system:user:read", "sort_order": 4},
            ],
        },
        {
            "title": "menu.group.data-center",
            "sort_order": 30,
            "children": [
                {"title": "menu.system.files", "path": "/system/files", "permission": "system:file:read", "sort_order": 1},
                {"title": "menu.system.apis", "path": "/system/apis", "permission": "system:api:read", "sort_order": 2},
                {"title": "menu.system.data-sources", "path": "/system/data-sources", "permission": "system:data-source:read", "sort_order": 3},
                {"title": "menu.system.application-connections", "path": "/system/application-connections", "permission": "system:application-connection:read", "sort_order": 4},
                {"title": "menu.system.datasets", "path": "/system/datasets", "permission": "system:dataset:read", "sort_order": 5},
            ],
        },
        {
            "title": "menu.group.process-management",
            "sort_order": 40,
            "children": [
                {"title": "menu.system.approval-processes", "path": "/system/approval-processes", "permission": "system:approval-process:read", "sort_order": 1},
                {"title": "menu.system.approval-instances", "path": "/system/approval-instances", "permission": "system:approval-instance:read", "sort_order": 2},
                {"title": "menu.system.messages.template", "path": "/system/messages/template", "permission": "system:message-template:read", "sort_order": 3},
                {"title": "menu.system.messages.config", "path": "/system/messages/config", "permission": "system:message-config:read", "sort_order": 4},
                {"title": "menu.system.print-devices", "path": "/system/print-devices", "permission": "system:print-device:read", "sort_order": 5},
                {"title": "menu.system.print-templates", "path": "/system/print-templates", "permission": "system:print-template:read", "sort_order": 6},
            ],
        },
        {
            "title": "menu.group.monitoring-ops",
            "sort_order": 50,
            "children": [
                {"title": "menu.system.operation-logs", "path": "/system/operation-logs", "permission": "system:operation-log:read", "sort_order": 1},
                {"title": "menu.system.login-logs", "path": "/system/login-logs", "permission": "system:login-log:read", "sort_order": 2},
                {"title": "menu.system.online-users", "path": "/system/online-users", "permission": "system:online-user:read", "sort_order": 3},
                {"title": "menu.system.data-backups", "path": "/system/data-backups", "permission": "system:data-backup:read", "sort_order": 4},
            ],
        },
        {
            "title": "menu.personal",
            "sort_order": 60,
            "children": [
                {"title": "menu.personal.profile", "path": "/personal/profile", "permission": "system:user-profile:read", "sort_order": 1},
                {"title": "menu.personal.preferences", "path": "/personal/preferences", "permission": "system:user-preference:read", "sort_order": 2},
                {"title": "menu.personal.messages", "path": "/personal/messages", "permission": "system:user-message:read", "sort_order": 3},
                {"title": "menu.personal.tasks", "path": "/personal/tasks", "permission": "system:user-task:read", "sort_order": 4},
            ],
        },
    ],
}

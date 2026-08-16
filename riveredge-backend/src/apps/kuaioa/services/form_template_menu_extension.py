"""将启用且挂菜单的审批模板追加到 navigation-tree 的「自定义审批」分组。"""

from __future__ import annotations

import uuid
from typing import List, Optional

from apps.kuaioa.models.form_template import KuaioaFormTemplate
from core.schemas.menu import MenuTreeResponse
from core.utils.timezone_utils import now_utc

FORMS_GROUP_MENU_NAME = "app.kuaioa.menu.group.forms"
FORM_DESIGNER_PATH = "/apps/kuaioa/approval/form-templates"
MOUNTED_FORM_PERMISSION = "kuaioa:form-request:read"
MOUNTED_FORM_SORT_BASE = 100


def _stable_form_menu_uuid(tenant_id: int, template_code: str) -> uuid.UUID:
    return uuid.uuid5(uuid.NAMESPACE_URL, f"kuaioa-mounted-form:{tenant_id}:{template_code}")


def _find_forms_group(nodes: List[MenuTreeResponse]) -> Optional[MenuTreeResponse]:
    for node in nodes:
        if node.name == FORMS_GROUP_MENU_NAME:
            return node
        if node.children:
            found = _find_forms_group(node.children)
            if found:
                return found
    return None


def _build_mounted_menu_node(
    tenant_id: int,
    *,
    template_code: str,
    template_name: str,
    application_uuid: Optional[str],
    sort_order: int,
) -> MenuTreeResponse:
    now = now_utc()
    return MenuTreeResponse(
        uuid=_stable_form_menu_uuid(tenant_id, template_code),
        tenant_id=tenant_id,
        name=template_name.strip(),
        path=f"/apps/kuaioa/forms/{template_code}",
        icon="fileText",
        component=None,
        permission_code=MOUNTED_FORM_PERMISSION,
        application_uuid=application_uuid,
        parent_uuid=None,
        sort_order=sort_order,
        is_active=True,
        is_external=False,
        external_url=None,
        meta={"kuaioa_mounted_form": True, "template_code": template_code},
        created_at=now,
        updated_at=now,
        children=[],
    )


async def append_mounted_form_template_menus(
    tenant_id: int,
    root_menus: List[MenuTreeResponse],
) -> None:
    forms_group = _find_forms_group(root_menus)
    if not forms_group:
        return

    rows = (
        await KuaioaFormTemplate.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            is_active=True,
            show_in_menu=True,
        )
        .order_by("template_code")
        .all()
    )
    if not rows:
        return

    application_uuid = forms_group.application_uuid
    existing_paths = {str(child.path or "") for child in forms_group.children}
    next_sort = MOUNTED_FORM_SORT_BASE
    for row in rows:
        path = f"/apps/kuaioa/forms/{row.template_code}"
        if path in existing_paths:
            continue
        forms_group.children.append(
            _build_mounted_menu_node(
                tenant_id,
                template_code=row.template_code,
                template_name=row.template_name,
                application_uuid=application_uuid,
                sort_order=next_sort,
            )
        )
        existing_paths.add(path)
        next_sort += 1

    forms_group.children.sort(key=lambda item: (item.sort_order, item.name or ""))

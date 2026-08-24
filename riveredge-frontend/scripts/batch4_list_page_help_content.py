"""Batch 4 list page help content."""
from __future__ import annotations

from batch3_list_page_help_content import _master_page, _system_page
from batch4_help_manifest import LIST_WIRE

BATCH4_LIST_PAGE_KEYS = [item[1] for item in LIST_WIRE]

_INFRA_PREFIX = ("infra.", "system.")
_PLM_PREFIX = ("kuaiplm.", "kuaiiot.", "kuaiai.")


def _build_list_content(page_key: str, title: str, p1: str) -> dict[str, str]:
    if page_key.startswith(_INFRA_PREFIX):
        return _system_page(
            title,
            p1,
            "本页偏运维或平台配置，变更前请评估对全站的影响。",
            toolbar="工具栏：新建、编辑、启用/停用、导出（以权限为准）。",
            ops_p1=f"维护{title}相关配置或只读监控。",
            steps=(
                f"浏览或搜索目标{title}记录。",
                "新建或编辑配置项并保存。",
                "启用/停用或执行运维动作（若提供）。",
                "导出或查看审计信息。",
            ),
            bullets=(
                "高权限操作请走变更流程。",
                "删除前确认无下游引用。",
                "列表支持关键词与状态筛选。",
                "详情抽屉或弹窗查看完整字段。",
                "右上角可切换帮助视图。",
            ),
            search_p1="按名称、编码、状态或时间范围筛选。",
            search_b3="高级条件：展开搜索栏查看更多字段。",
            faq=(
                ("Q: 保存后不生效？", "A: 部分配置需刷新页面或重启服务，请阅读字段说明。"),
                ("Q: 无权限操作？", "A: 联系管理员授予对应模块 read/update 权限。"),
                ("Q: 能否批量导入？", "A: 若工具栏提供导入，请使用最新模板并确保编码唯一。"),
                ("Q: 与业务单据关系？", "A: 本页为配置或监控，业务处理在对应业务菜单完成。"),
            ),
        )
    if page_key.startswith(_PLM_PREFIX) or page_key.startswith("kuaizhizao."):
        return _master_page(
            title,
            p1,
            layout_extra="工具栏：新建、导入、导出、批量操作（以页面按钮与权限为准）。",
            search_extra="状态/类型：按业务状态或分类筛选（若已配置）。",
        )
    return _master_page(title, p1)


BATCH4_LIST_PAGE_CONTENT: dict[str, dict[str, str]] = {
    page_key: _build_list_content(page_key, title, p1) for _, page_key, title, p1 in LIST_WIRE
}

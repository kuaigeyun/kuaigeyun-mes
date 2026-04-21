import json
from pathlib import Path


FRONTEND_ROOT = Path(__file__).resolve().parents[2]
manifest_path = FRONTEND_ROOT / "src" / "apps" / "kuaizhizao" / "manifest.json"

with manifest_path.open("r", encoding="utf-8") as f:
    data = json.load(f)

# Update Plan
plan_children = data["menu_config"]["children"][0]["children"]
if not any(c.get("title") == "计划中心" for c in plan_children):
    plan_children.insert(
        0,
        {
            "title": "计划中心",
            "path": "/apps/kuaizhizao/plan-management/production-control-tower",
            "sort_order": 0,
            "meta": {"module": "demand"},
        },
    )

# Remove duplicated legacy item
data["menu_config"]["children"][0]["children"] = [
    c for c in plan_children if c.get("title") != "app.kuaizhizao.menu.plan-management.control-tower"
]

# Update Warehouse
warehouse_menu = next(
    (m for m in data["menu_config"]["children"] if m.get("title") == "app.kuaizhizao.menu.warehouse-management"),
    None,
)
if warehouse_menu:
    warehouse_children = warehouse_menu["children"]
    if not any(c.get("title") == "仓储看板" for c in warehouse_children):
        warehouse_children.insert(
            0,
            {
                "title": "仓储看板",
                "path": "/apps/kuaizhizao/warehouse-management/dashboard",
                "sort_order": 0,
                "meta": {"module": "warehouse"},
            },
        )

with manifest_path.open("w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False)
    print("Updated frontend manifest.json")

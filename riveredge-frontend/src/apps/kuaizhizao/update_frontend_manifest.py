import json
import os

path = r'f:\dev\riveredge\riveredge-frontend\src\apps\kuaizhizao\manifest.json'
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)

# Update Plan
plan_children = data['menu_config']['children'][0]['children']
# Check if 计划中心 already exists
if not any(c.get('title') == '计划中心' for c in plan_children):
    plan_children.insert(0, {
        "title": "计划中心",
        "path": "/apps/kuaizhizao/plan-management/production-control-tower",
        "sort_order": 0,
        "meta": {"module": "demand"}
    })

# Remove control-tower if it's there as a duplicate
data['menu_config']['children'][0]['children'] = [c for c in plan_children if c.get('title') != 'app.kuaizhizao.menu.plan-management.control-tower']

# Update Warehouse
warehouse_menu = next((m for m in data['menu_config']['children'] if m.get('title') == 'app.kuaizhizao.menu.warehouse-management'), None)
if warehouse_menu:
    warehouse_children = warehouse_menu['children']
    if not any(c.get('title') == '仓储看板' for c in warehouse_children):
        warehouse_children.insert(0, {
            "title": "仓储看板",
            "path": "/apps/kuaizhizao/warehouse-management/dashboard",
            "sort_order": 0,
            "meta": {"module": "warehouse"}
        })

with open(path, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False)
    print("Updated frontend manifest.json")

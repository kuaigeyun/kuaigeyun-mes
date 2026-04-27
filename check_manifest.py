import json

with open("f:/dev/riveredge/riveredge-backend/src/apps/kuaizhizao/manifest.json", "r", encoding="utf-8") as f:
    manifest = json.load(f)

explicit_perms = set(manifest.get("permissions", []))

menu_perms = set()
def walk(node):
    if "permission" in node:
        menu_perms.add(node["permission"])
    for child in node.get("children", []):
        walk(child)

walk(manifest.get("menu_config", {}))

print("In explicit list but NOT in menus:")
for p in sorted(explicit_perms - menu_perms):
    print("  ", p)

print("\nIn menus but NOT in explicit list:")
for p in sorted(menu_perms - explicit_perms):
    print("  ", p)

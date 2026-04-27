import json
import re
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def derive_code(path, node_code):
    parts = [p for p in path.strip().split("/") if p]
    if len(parts) >= 2 and parts[0] == "apps":
        app_code = parts[1]
    else:
        return None

    if node_code:
        resource_segment = node_code.replace("_", "-")
        return f"{app_code}:{resource_segment}:view"
    
    try:
        idx = parts.index(app_code)
    except ValueError:
        return None
        
    tail = parts[idx + 1 :]
    if not tail:
        return f"{app_code}:pricing:view"
        
    resource = "-".join(tail)
    resource = re.sub(r"[^a-z0-9\-]+", "-", resource.lower()).strip("-")
    if not resource:
        return None
    return f"{app_code}:{resource}:view"

def process_manifest(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    added_perms = set()
    
    def process_node(node):
        is_leaf = not bool(node.get("children"))
        path = node.get("path")
        meta = node.get("meta", {})
        node_code = meta.get("node")
        
        if is_leaf and "permission" not in node and path:
            code = derive_code(path, node_code)
            if code:
                node["permission"] = code
                added_perms.add(code)
                
        for child in node.get("children", []):
            process_node(child)
            
    if "menu_config" in data:
        process_node(data["menu_config"])
        
    if added_perms:
        perms = data.get("permissions", [])
        for p in added_perms:
            if p not in perms:
                perms.append(p)
        data["permissions"] = sorted(perms)
        
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
        logger.info(f"Added {len(added_perms)} permissions to {filepath.name}")

def main():
    base_dirs = [
        Path("f:/dev/riveredge/riveredge-frontend/src/apps"),
        Path("f:/dev/riveredge/riveredge-backend/src/apps")
    ]
    for d in base_dirs:
        for f in d.glob("**/manifest.json"):
            process_manifest(f)
            
if __name__ == "__main__":
    main()

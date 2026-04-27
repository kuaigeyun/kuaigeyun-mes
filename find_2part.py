import json
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def find_2part_permissions():
    frontend_dir = Path("f:/dev/riveredge/riveredge-frontend/src/apps")
    backend_dir = Path("f:/dev/riveredge/riveredge-backend/src/apps")
    core_dir = Path("f:/dev/riveredge/riveredge-backend/src/core") # or anywhere system manifests exist
    
    files = list(frontend_dir.glob("**/manifest.json")) + list(backend_dir.glob("**/manifest.json"))
    
    anomalies = []
    
    for f in files:
        with open(f, "r", encoding="utf-8") as file:
            try:
                data = json.load(file)
            except:
                continue
            
            perms = data.get("permissions", [])
            for p in perms:
                if p.count(":") < 2:
                    anomalies.append((str(f), p))
                    
            # Also check menu_config permissions
            def check_menu(node):
                p = node.get("permission")
                # ignore cases where there is no permission
                if p and p.count(":") < 2:
                    anomalies.append((str(f), f"MENU_CONFIG: {p}"))
                for child in node.get("children", []):
                    check_menu(child)
                    
            if "menu_config" in data:
                check_menu(data["menu_config"])
                
    if not anomalies:
        logger.info("No 2-part permissions found! All normalized.")
    else:
        logger.info(f"Found {len(anomalies)} anomalies:")
        for path, code in anomalies:
            logger.info(f"{code} in {path}")

if __name__ == "__main__":
    find_2part_permissions()

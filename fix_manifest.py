import json
import copy

def process_file(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    # These prefixes should be stripped from permission codes to match real domain objects
    # but NOT from '-dashboard' or '-reports' unless there's a specific fix.
    
    # We will build a replacement dict
    replacements = {
        # Dashboards
        "kuaizhizao:sales-order:view": "kuaizhizao:sales-dashboard:view", # will only apply to dashboard
        "kuaizhizao:demand:view": "kuaizhizao:plan-dashboard:view",
        "kuaizhizao:purchase-order:view": "kuaizhizao:purchase-dashboard:view",
        "kuaizhizao:work-order:view": "kuaizhizao:production-dashboard:view",
        "kuaizhizao:equipment:view": "kuaizhizao:equipment-dashboard:view",
        "kuaizhizao:inventory:view": "kuaizhizao:warehouse-dashboard:view",
        
        # Others standardizations
        "kuaizhizao:warehouse-management-customer-material-registration:view": "kuaizhizao:customer-material-registration:view",
        "kuaizhizao:warehouse-management-batching-center:view": "kuaizhizao:batching-center:view",
        "kuaizhizao:warehouse-management-material-calls:view": "kuaizhizao:material-call:view",
        "kuaizhizao:warehouse-management-stocktaking:view": "kuaizhizao:stocktaking:view",
        "kuaizhizao:warehouse-management-inventory-transfer:view": "kuaizhizao:inventory-transfer:view",
        "kuaizhizao:warehouse-management-assembly-orders:view": "kuaizhizao:assembly-order:view",
        "kuaizhizao:warehouse-management-disassembly-orders:view": "kuaizhizao:disassembly-order:view",
        "kuaizhizao:warehouse-management-inventory:view": "kuaizhizao:inventory:view",
        "kuaizhizao:warehouse-management-batch-inventory-query:view": "kuaizhizao:batch-inventory-query:view",
        "kuaizhizao:warehouse-management-line-side-warehouse:view": "kuaizhizao:line-side-warehouse:view",
        "kuaizhizao:warehouse-management-backflush-records:view": "kuaizhizao:backflush-record:view",
        "kuaizhizao:warehouse-management-replenishment-suggestions:view": "kuaizhizao:replenishment-suggestion:view",
        "kuaizhizao:warehouse-management-inventory-alert:view": "kuaizhizao:inventory-alert:view",
        "kuaizhizao:warehouse-management-barcode-mapping-rules:view": "kuaizhizao:barcode-mapping-rule:view",
        "kuaizhizao:warehouse-management-initial-data:view": "kuaizhizao:initial-data:view",
        
        # Equipment
        "kuaizhizao:equipment-management-equipment:view": "kuaizhizao:equipment:view",
        "kuaizhizao:equipment-management-molds:view": "kuaizhizao:mold:view",
        "kuaizhizao:equipment-management-tool-ledger:view": "kuaizhizao:tool:view",
        
        # Plan
        "kuaizhizao:plan-management-demand-management:view": "kuaizhizao:demand:view",
        "kuaizhizao:plan-management-demand-computation:view": "kuaizhizao:lrp:compute",
        "kuaizhizao:plan-management-scheduling:view": "kuaizhizao:scheduling:view",
        
        # Production
        "kuaizhizao:production-execution-reporting:view": "kuaizhizao:reporting:view",
        "kuaizhizao:production-execution-reporting-statistics:view": "kuaizhizao:reporting-statistics:view",
        
        # Performance
        "kuaizhizao:performance-holidays:view": "kuaizhizao:performance:holiday:view",
        "kuaizhizao:performance-skills:view": "kuaizhizao:performance:skill:view",
        "kuaizhizao:performance-employee-configs:view": "kuaizhizao:performance-employee-config:view",
        "kuaizhizao:performance-piece-rates:view": "kuaizhizao:performance-piece-rate:view",
        "kuaizhizao:performance-hourly-rates:view": "kuaizhizao:performance-hourly-rate:view",
        "kuaizhizao:performance-kpi-definitions:view": "kuaizhizao:performance-kpi-definition:view",
        "kuaizhizao:performance-summaries:view": "kuaizhizao:performance-summary:view",
    }
    
    dashboards = [
        "sales-dashboard:view", "plan-dashboard:view", "purchase-dashboard:view", "production-dashboard:view",
        "quality-dashboard:view", "equipment-dashboard:view", "warehouse-dashboard:view", "quality-management-dashboard:view"
    ]
    
    def walk(node):
        if "permission" in node:
            title = node.get("title", "")
            old_perm = node["permission"]
            
            # Special case for dashboards
            if "dashboard" in title.lower() and old_perm in replacements:
                node["permission"] = replacements[old_perm]
            elif old_perm in replacements:
                node["permission"] = replacements[old_perm]
            
            # Terminal uses work-order:view, let's keep it or change it?
            if "terminal" in title.lower():
                pass # terminal uses work-order, maybe fine
            if "material-shortage-exceptions" in title:
                pass
                
        for child in node.get("children", []):
            walk(child)

    walk(manifest.get("menu_config", {}))
    
    # Now rebuild the permissions array
    new_perms = set()
    
    # Keep some explicitly needed existing ones (mostly actions)
    perms_arr = manifest.get("permissions", [])
    for p in perms_arr:
        # Ignore deprecated/redundant ones that we mapped AWAY from
        if p in replacements.keys():
            continue
        new_perms.add(p)
        
    # Add all new permissions needed by menus
    menu_perms = set()
    def get_menu_perms(node):
        if "permission" in node:
            menu_perms.add(node["permission"])
        for child in node.get("children", []):
            get_menu_perms(child)
    get_menu_perms(manifest.get("menu_config", {}))
    
    new_perms.update(menu_perms)
    # Also ensure the newly mapped functional permissions exist
    new_perms.add("kuaizhizao:reporting-statistics:view")
    new_perms.add("kuaizhizao:performance-employee-config:view")
    new_perms.add("kuaizhizao:performance-piece-rate:view")
    new_perms.add("kuaizhizao:performance-hourly-rate:view")
    new_perms.add("kuaizhizao:performance-kpi-definition:view")
    new_perms.add("kuaizhizao:performance-summary:view")
    new_perms.add("kuaizhizao:batching-center:view")
    new_perms.add("kuaizhizao:material-call:view")
    new_perms.add("kuaizhizao:inventory-alert:view")
    
    manifest["permissions"] = sorted(list(new_perms))
    
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
        f.write("\n")

process_file("f:/dev/riveredge/riveredge-frontend/src/apps/kuaizhizao/manifest.json")
process_file("f:/dev/riveredge/riveredge-backend/src/apps/kuaizhizao/manifest.json")
print("Done!")

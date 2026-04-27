import asyncio
import logging
from pathlib import Path
import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'src'))

from infra.infrastructure.database.database import get_db_connection

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def main():
    replacements = {
        # Dashboards
        "kuaizhizao:sales-order:view": "kuaizhizao:sales-dashboard:view", 
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
    
    conn = await get_db_connection()
    try:
        updated_count = 0
        for old_code, new_code in replacements.items():
            # For dashboards, only replace if path ends in dashboard
            if old_code in ["kuaizhizao:sales-order:view", "kuaizhizao:demand:view", "kuaizhizao:purchase-order:view", "kuaizhizao:work-order:view", "kuaizhizao:equipment:view", "kuaizhizao:inventory:view"]:
                res = await conn.execute("UPDATE core_menus SET permission_code = $1 WHERE permission_code = $2 AND path LIKE '%/dashboard'", new_code, old_code)
            else:
                res = await conn.execute("UPDATE core_menus SET permission_code = $1 WHERE permission_code = $2", new_code, old_code)
            # count affected rows by parsing 'UPDATE N'
            parts = res.split()
            if len(parts) > 1:
                updated_count += int(parts[1])
                
        logger.info(f"Updated {updated_count} menu configurations in DB.")
    finally:
        await conn.close()

asyncio.run(main())

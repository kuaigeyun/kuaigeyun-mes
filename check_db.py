import asyncio
import os
import sys

# Add backend src to path
sys.path.append('f:/dev/riveredge/riveredge-backend/src')

async def check_data():
    from tortoise import Tortoise
    from apps.kuaizhizao.models.sales_order import SalesOrder
    from datetime import date
    
    # Init DB (assuming sqlite for quick check, or get from config)
    # Actually, I should use the existing DB config.
    # But I don't know the password etc.
    # I'll try to find the DB config.
    pass

if __name__ == "__main__":
    # asyncio.run(check_data())
    pass

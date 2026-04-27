import asyncio
import os
import sys

# Ensure src is in sys.path
sys.path.insert(0, os.path.join(os.getcwd(), "src"))

from tortoise import Tortoise
from infra.infrastructure.database.database import TORTOISE_ORM

async def run():
    try:
        await Tortoise.init(config=TORTOISE_ORM)
        conn = Tortoise.get_connection("default")
        res = await conn.execute_query("SELECT count(*) FROM core_user_activities")
        print(f"Table core_user_activities count: {res[1][0]['count']}")
    except Exception as e:
        print(f"Error checking table: {e}")
    finally:
        await Tortoise.close_connections()

if __name__ == "__main__":
    asyncio.run(run())

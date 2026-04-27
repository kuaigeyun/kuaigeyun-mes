import asyncio
import os
import sys

# Ensure src is in sys.path
sys.path.insert(0, os.path.join(os.getcwd(), "src"))

from tortoise import Tortoise
from core.models.user_activity import UserActivity
from infra.infrastructure.database.database import TORTOISE_ORM

async def check():
    await Tortoise.init(config=TORTOISE_ORM)
    
    count = await UserActivity.all().count()
    print(f"Total UserActivity records: {count}")
    
    activities = await UserActivity.all().limit(10)
    for a in activities:
        print(f"User {a.user_id} (Tenant {a.tenant_id}): last_activity={a.last_activity_time}, expires={a.expires_at}")
    
    await Tortoise.close_connections()

if __name__ == "__main__":
    asyncio.run(check())

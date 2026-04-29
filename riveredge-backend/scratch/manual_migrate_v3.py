import asyncio
import os
import asyncpg
from dotenv import load_dotenv

# 加载环境变量
load_dotenv(".env")

async def run():
    db_host = os.environ.get("DB_HOST", "localhost")
    db_port = os.environ.get("DB_PORT", "5432")
    db_user = os.environ.get("DB_USER", "postgres")
    db_password = os.environ.get("DB_PASSWORD", "postgres")
    db_name = os.environ.get("DB_NAME", "riveredge")

    print(f"Connecting to {db_host}:{db_port}/{db_name}...")
    
    conn = await asyncpg.connect(
        host=db_host,
        port=db_port,
        user=db_user,
        password=db_password,
        database=db_name
    )
    
    try:
        print("Adding platform_name_en to infra_platform_settings...")
        await conn.execute("""
            ALTER TABLE "infra_platform_settings" ADD COLUMN IF NOT EXISTS "platform_name_en" VARCHAR(200);
            COMMENT ON COLUMN "infra_platform_settings"."platform_name_en" IS '平台名称（英文）';
        """)
        print("Done!")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(run())

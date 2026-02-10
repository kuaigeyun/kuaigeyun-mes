
import asyncio
import sys
from pathlib import Path

# Add src to sys.path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from infra.infrastructure.database.database import register_db
from fastapi import FastAPI
from tortoise import Tortoise
from loguru import logger

async def test_query():
    app = FastAPI()
    await register_db(app)
    
    # Try to query Operation with prefetch
    from apps.master_data.models.process import Operation
    
    # List registered models
    logger.info("Registered models in 'models' app:")
    for model_name, model_cls in Tortoise.apps.get("models", {}).items():
        logger.info(f" - {model_name}: table={getattr(model_cls._meta, 'db_table', 'N/A')}")
    
    try:
        logger.info("Testing query with prefetch_related('defect_types')...")
        ops = await Operation.all().limit(1).prefetch_related("defect_types")
        print(f"Query successful, found {len(ops)} operations.")
        for op in ops:
            dts = await op.defect_types.all()
            print(f"Op {op.code} has {len(dts)} defect types.")
    except Exception as e:
        logger.error(f"Query failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await Tortoise.close_connections()

if __name__ == "__main__":
    asyncio.run(test_query())

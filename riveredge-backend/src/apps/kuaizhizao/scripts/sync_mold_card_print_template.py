"""将模具卡打印模板同步为可视化设计器版（60×50mm 单卡）。

仅更新 MOLD_CARD_PRINT / MOLD_CARD_PRINT_*。

用法:
  cd riveredge-backend && PYTHONPATH=src python -m apps.kuaizhizao.scripts.sync_mold_card_print_template
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from loguru import logger


async def sync() -> int:
    src = Path(__file__).resolve().parents[3]
    if str(src) not in sys.path:
        sys.path.insert(0, str(src))

    from tortoise import Tortoise

    from apps.kuaizhizao.print.mold_card import build_mold_card_preset
    from core.models.print_template import PrintTemplate
    from infra.infrastructure.database.database import TORTOISE_ORM

    await Tortoise.init(config=TORTOISE_ORM)
    try:
        preset = build_mold_card_preset()
        rows = await PrintTemplate.filter(deleted_at__isnull=True).all()
        updated = 0
        for row in rows:
            code = (row.code or "").strip().upper()
            if code != "MOLD_CARD_PRINT" and not code.startswith("MOLD_CARD_PRINT_"):
                continue
            row.name = preset["name"]
            row.description = preset.get("description")
            row.content = preset["content"]
            row.config = preset.get("config")
            row.type = preset["type"]
            await row.save()
            updated += 1
            logger.info("updated tenant={} id={} code={}", row.tenant_id, row.id, row.code)
        return updated
    finally:
        await Tortoise.close_connections()


def main() -> None:
    n = asyncio.run(sync())
    logger.info("done, updated={}", n)


if __name__ == "__main__":
    main()

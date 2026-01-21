"""
获取模型状态，用于迁移文件的 MODELS_STATE

Author: Luigi Lu
Date: 2025-12-27
"""

import asyncio
import sys
from pathlib import Path

# 添加项目路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root / "src"))
sys.path.insert(0, str(project_root))

from tortoise import Tortoise
from aerich.utils import get_models_describe, compress_dict

# 导入数据库配置
import sys
from pathlib import Path
migrations_path = project_root / "migrations"
if str(migrations_path) not in sys.path:
    sys.path.insert(0, str(migrations_path))
from aerich_config import TORTOISE_ORM


async def get_models_state():
    """获取模型状态"""
    await Tortoise.init(config=TORTOISE_ORM)
    
    try:
        # 获取模型状态
        state = get_models_describe(app='models')
        print(f"模型状态键数量: {len(state) if state else 0}")
        
        # 压缩状态
        compressed = compress_dict(state)
        print(f"\n压缩后的MODELS_STATE:")
        print(f'MODELS_STATE = "{compressed}"')
        
        return compressed
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(get_models_state())


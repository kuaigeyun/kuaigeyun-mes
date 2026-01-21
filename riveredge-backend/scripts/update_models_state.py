"""
更新迁移文件的 MODELS_STATE

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
migrations_path = project_root / "migrations"
if str(migrations_path) not in sys.path:
    sys.path.insert(0, str(migrations_path))
from aerich_config import TORTOISE_ORM


async def update_models_state():
    """更新迁移文件的 MODELS_STATE"""
    await Tortoise.init(config=TORTOISE_ORM)
    
    try:
        # 获取模型状态
        state = get_models_describe(app='models')
        print(f"模型状态键数量: {len(state) if state else 0}")
        
        # 压缩状态
        compressed = compress_dict(state)
        print(f"\n压缩后的MODELS_STATE长度: {len(compressed)}")
        
        # 读取迁移文件
        migration_file = project_root / "migrations" / "models" / "0_init_schema.py"
        content = migration_file.read_text(encoding='utf-8')
        
        # 替换 MODELS_STATE
        import re
        pattern = r'MODELS_STATE = "[^"]*"'
        replacement = f'MODELS_STATE = "{compressed}"'
        new_content = re.sub(pattern, replacement, content)
        
        if new_content != content:
            migration_file.write_text(new_content, encoding='utf-8')
            print(f"✅ 已更新 {migration_file}")
        else:
            print("⚠️  未找到 MODELS_STATE，可能需要手动更新")
        
        return compressed
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(update_models_state())






































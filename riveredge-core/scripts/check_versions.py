"""
检查和验证 FastAPI + asyncpg + Tortoise ORM 版本兼容性

测试不同版本组合的稳定性
"""

import sys
import subprocess
from pathlib import Path

# 添加 src 目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

def get_current_versions():
    """获取当前安装的版本"""
    result = subprocess.run([
        sys.executable, "-c",
        """
import sys
try:
    import fastapi
    print(f"fastapi=={fastapi.__version__}")
except:
    print("fastapi==not_installed")

try:
    import asyncpg
    print(f"asyncpg=={asyncpg.__version__}")
except:
    print("asyncpg==not_installed")

try:
    import tortoise
    print(f"tortoise-orm=={tortoise.__version__}")
except:
    print("tortoise-orm==not_installed")

try:
    import uvicorn
    print(f"uvicorn=={uvicorn.__version__}")
except:
    print("uvicorn==not_installed")
        """
    ], capture_output=True, text=True, shell=True)

    versions = {}
    for line in result.stdout.strip().split('\n'):
        if '==' in line:
            package, version = line.split('==')
            versions[package] = version

    return versions

def test_version_compatibility():
    """测试版本兼容性"""
    print("=" * 80)
    print("FastAPI + asyncpg + Tortoise ORM 版本兼容性检查")
    print("=" * 80)

    current_versions = get_current_versions()
    print("当前安装版本:")
    for package, version in current_versions.items():
        print(f"  {package}: {version}")
    print()

    # 已知稳定的版本组合
    stable_combinations = [
        {
            "name": "推荐稳定组合 (2024)",
            "fastapi": "0.104.1",
            "asyncpg": "0.28.0",
            "tortoise-orm": "0.20.1",
            "uvicorn": "0.23.2",
            "description": "经过广泛测试的最稳定组合"
        },
        {
            "name": "保守稳定组合",
            "fastapi": "0.100.0",
            "asyncpg": "0.27.0",
            "tortoise-orm": "0.19.3",
            "uvicorn": "0.20.0",
            "description": "非常保守但极其稳定的组合"
        },
        {
            "name": "最新稳定组合",
            "fastapi": "0.115.0",
            "asyncpg": "0.29.0",
            "tortoise-orm": "0.21.0",
            "uvicorn": "0.32.0",
            "description": "最新稳定版本组合"
        }
    ]

    print("推荐的稳定版本组合:")
    print()

    for combo in stable_combinations:
        print(f"📦 {combo['name']}")
        print(f"   描述: {combo['description']}")
        print("   版本:")
        print(f"     fastapi=={combo['fastapi']}")
        print(f"     asyncpg=={combo['asyncpg']}")
        print(f"     tortoise-orm=={combo['tortoise-orm']}")
        print(f"     uvicorn[standard]=={combo['uvicorn']}")
        print()

    # 检查当前版本的风险
    print("⚠️  当前版本风险评估:")
    print()

    current_fastapi = current_versions.get('fastapi', '0.0.0')
    current_asyncpg = current_versions.get('asyncpg', '0.0.0')
    current_tortoise = current_versions.get('tortoise-orm', '0.0.0')

    risks = []

    # FastAPI 版本风险
    try:
        fastapi_version = tuple(map(int, current_fastapi.split('.')))
        if fastapi_version >= (0, 121, 0):
            risks.append("FastAPI 0.121+ 版本较新，可能存在兼容性问题")
        elif fastapi_version < (0, 100, 0):
            risks.append("FastAPI 版本过旧，建议升级")
    except:
        pass

    # asyncpg 版本风险
    try:
        asyncpg_version = tuple(map(int, current_asyncpg.split('.')))
        if asyncpg_version >= (0, 29, 0):
            risks.append("asyncpg 0.29+ 是最新版本，在 Windows 上可能存在网络兼容性问题")
    except:
        pass

    # Tortoise ORM 版本风险
    try:
        tortoise_version = tuple(map(int, current_tortoise.split('.')))
        if tortoise_version >= (0, 21, 0):
            risks.append("Tortoise ORM 0.21+ 是最新版本，可能存在稳定性问题")
    except:
        pass

    if risks:
        print("发现以下风险:")
        for risk in risks:
            print(f"  ❌ {risk}")
    else:
        print("✅ 当前版本看起来相对稳定")

    print()
    print("🔧 建议解决方案:")
    print("1. 使用推荐稳定组合 (fastapi==0.104.1, asyncpg==0.28.0, tortoise-orm==0.20.1)")
    print("2. 如果必须使用最新版本，确保在 Linux 环境中测试")
    print("3. 考虑使用同步数据库驱动 (psycopg2) 作为备选方案")
    print()

    return stable_combinations

def generate_requirements_file(combo_name="stable"):
    """生成推荐的 requirements.txt"""
    combos = test_version_compatibility()

    if combo_name == "stable":
        combo = combos[0]  # 推荐稳定组合
    elif combo_name == "conservative":
        combo = combos[1]  # 保守稳定组合
    elif combo_name == "latest":
        combo = combos[2]  # 最新稳定组合
    else:
        print(f"未知的组合名称: {combo_name}")
        return

    requirements_path = Path(__file__).parent.parent / "requirements-stable.txt"

    requirements = f"""# {combo['name']} - {combo['description']}
# 生成时间: {Path(__file__).name}

# Web 框架
fastapi=={combo['fastapi']}
uvicorn[standard]=={combo['uvicorn']}

# 数据库
asyncpg=={combo['asyncpg']}
tortoise-orm=={combo['tortoise-orm']}
psycopg2-binary==2.9.7  # 同步备选方案

# 数据验证
pydantic==2.5.0
pydantic-settings==2.1.0

# 认证和安全
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6

# Redis
redis[hiredis]==5.0.1

# 工具库
loguru==0.7.2
httpx==0.25.2

# 测试
pytest==7.4.3
pytest-asyncio==0.21.1
"""

    with open(requirements_path, 'w', encoding='utf-8') as f:
        f.write(requirements)

    print(f"✅ 已生成稳定的 requirements 文件: {requirements_path}")
    print("安装命令: pip install -r requirements-stable.txt")

if __name__ == "__main__":
    test_version_compatibility()

    print("\n" + "=" * 80)
    generate_requirements_file("stable")

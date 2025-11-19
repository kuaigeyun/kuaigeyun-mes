"""
测试数据库配置读取

验证是否正确从.env文件读取数据库密码，而不是使用默认值
"""

import sys
from pathlib import Path

# 添加 src 目录到 Python 路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

# 在导入配置前加载环境变量
from dotenv import load_dotenv
project_root = Path(__file__).parent.parent
env_file = project_root / ".env"

print("=" * 60)
print("数据库配置读取测试")
print("=" * 60)
print(f"项目根目录: {project_root}")
print(f".env 文件路径: {env_file}")
print(f".env 文件存在: {env_file.exists()}")

if env_file.exists():
    print(f"\n✅ .env 文件存在，正在加载...")
    load_dotenv(env_file)
    print(f"✅ 环境变量已加载")
else:
    print(f"\n❌ .env 文件不存在！")
    print(f"   请确保 .env 文件存在于: {env_file}")

print("\n" + "=" * 60)
print("从配置读取数据库信息")
print("=" * 60)

try:
    from app.config import settings
    
    print(f"DB_HOST: {settings.DB_HOST}")
    print(f"DB_PORT: {settings.DB_PORT}")
    print(f"DB_USER: {settings.DB_USER}")
    print(f"DB_NAME: {settings.DB_NAME}")
    
    # 显示密码长度和部分字符（不显示完整密码）
    password = settings.DB_PASSWORD
    password_length = len(password) if password else 0
    password_preview = password[:3] + "..." if password and len(password) > 3 else password
    
    print(f"DB_PASSWORD: {'*' * password_length} (长度: {password_length})")
    print(f"DB_PASSWORD 预览: {password_preview}")
    
    # 检查是否使用了默认值
    if password == "postgres":
        print("\n⚠️  警告: 密码是默认值 'postgres'")
        print("   如果.env文件中设置了其他密码，说明配置未正确读取")
    else:
        print(f"\n✅ 密码不是默认值，已从.env文件读取")
        print(f"   密码长度: {password_length} 字符")
    
    # 显示连接字符串（隐藏密码）
    db_url = settings.DB_URL
    # 从连接字符串中提取密码部分并隐藏
    if "@" in db_url and "://" in db_url:
        parts = db_url.split("@")
        if len(parts) == 2:
            auth_part = parts[0].split("://")[1]
            if ":" in auth_part:
                user_part = auth_part.split(":")[0]
                password_part = auth_part.split(":")[1]
                hidden_url = db_url.replace(f":{password_part}@", f":{'*' * len(password_part)}@")
                print(f"\n数据库连接字符串: {hidden_url}")
            else:
                print(f"\n数据库连接字符串: {db_url}")
        else:
            print(f"\n数据库连接字符串: {db_url}")
    else:
        print(f"\n数据库连接字符串: {db_url}")
    
    print("\n" + "=" * 60)
    print("测试数据库连接")
    print("=" * 60)
    
    # 尝试连接数据库
    try:
        import asyncpg
        import asyncio
        
        async def test_connection():
            try:
                conn = await asyncpg.connect(
                    host=settings.DB_HOST,
                    port=settings.DB_PORT,
                    user=settings.DB_USER,
                    password=settings.DB_PASSWORD,  # ⭐ 使用从配置读取的密码
                    database=settings.DB_NAME,
                )
                print("✅ 数据库连接成功！")
                print(f"   使用的密码长度: {len(settings.DB_PASSWORD)} 字符")
                await conn.close()
                return True
            except Exception as e:
                print(f"❌ 数据库连接失败: {e}")
                print(f"   使用的配置:")
                print(f"   - HOST: {settings.DB_HOST}")
                print(f"   - PORT: {settings.DB_PORT}")
                print(f"   - USER: {settings.DB_USER}")
                print(f"   - PASSWORD: {'*' * len(settings.DB_PASSWORD)}")
                print(f"   - DATABASE: {settings.DB_NAME}")
                return False
        
        # Windows 环境下使用 SelectorEventLoop
        if sys.platform == 'win32':
            asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        
        result = asyncio.run(test_connection())
        
        if result:
            print("\n✅ 所有测试通过！配置正确读取了.env文件中的密码")
        else:
            print("\n❌ 数据库连接失败，请检查:")
            print("   1. PostgreSQL 服务是否运行")
            print("   2. .env 文件中的密码是否正确")
            print("   3. 数据库用户是否有权限")
            
    except ImportError:
        print("⚠️  asyncpg 未安装，跳过连接测试")
        print("   但配置读取测试已完成")
    
except Exception as e:
    print(f"\n❌ 配置读取失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 60)


"""
为每个部门生成模拟用户数据

使用方法：
    python scripts/mock_users.py [tenant_id] [users_per_dept]
    
示例：
    python scripts/mock_users.py 1 3  # 为组织1的每个部门创建3个用户
"""

import asyncio
import random
import sys
import os
from pathlib import Path

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

# 导入拼音转换库
try:
    from pypinyin import lazy_pinyin, Style
except ImportError:
    print("⚠️  警告: pypinyin 未安装，将使用简化拼音生成")
    print("   请运行: pip install pypinyin")
    lazy_pinyin = None

# 设置时区环境变量（必须在导入 Tortoise 之前）
os.environ['USE_TZ'] = 'True'
os.environ['TIMEZONE'] = 'Asia/Shanghai'

from soil.config.platform_config import setup_tortoise_timezone_env, platform_settings
setup_tortoise_timezone_env()

from datetime import datetime
from tortoise import Tortoise
from soil.models.user import User
from tree_root.models.department import Department
from tree_root.models.position import Position
from tree_root.services.department_service import DepartmentService
from tree_root.services.user_service import UserService
from tree_root.schemas.user import UserCreate
from soil.infrastructure.database.database import TORTOISE_ORM


# 常见中文姓氏
SURNAMES = [
    "王", "李", "张", "刘", "陈", "杨", "赵", "黄", "周", "吴",
    "徐", "孙", "胡", "朱", "高", "林", "何", "郭", "马", "罗",
    "梁", "宋", "郑", "谢", "韩", "唐", "冯", "于", "董", "萧",
    "程", "曹", "袁", "邓", "许", "傅", "沈", "曾", "彭", "吕",
    "苏", "卢", "蒋", "蔡", "贾", "丁", "魏", "薛", "叶", "阎"
]

# 常见中文名字（单字）
GIVEN_NAMES_SINGLE = [
    "伟", "芳", "娜", "秀英", "敏", "静", "丽", "强", "磊", "军",
    "洋", "勇", "艳", "杰", "娟", "涛", "明", "超", "秀兰", "霞",
    "平", "刚", "桂英", "建华", "文", "华", "建国", "红", "桂兰", "志强",
    "桂芳", "桂香", "桂华", "桂英", "桂珍", "桂芝", "桂芬", "桂芳", "桂香", "桂华"
]

# 常见中文名字（双字）
GIVEN_NAMES_DOUBLE = [
    "志强", "建华", "建国", "秀英", "秀兰", "秀华", "秀芳", "秀香", "秀珍", "秀芝",
    "桂英", "桂兰", "桂芳", "桂香", "桂华", "桂珍", "桂芝", "桂芬", "桂芳", "桂香",
    "明华", "明强", "明芳", "明香", "明华", "明珍", "明芝", "明芬", "明芳", "明香",
    "文华", "文强", "文芳", "文香", "文华", "文珍", "文芝", "文芬", "文芳", "文香"
]


def generate_chinese_name(used_usernames: set = None) -> tuple[str, str]:
    """
    生成随机中文姓名，并转换为拼音用于用户名和邮箱
    
    Args:
        used_usernames: 已使用的用户名集合，用于避免重复
        
    Returns:
        tuple: (full_name, username) - full_name是中文姓名，username是拼音
    """
    if used_usernames is None:
        used_usernames = set()
    
    max_attempts = 100
    for _ in range(max_attempts):
        surname = random.choice(SURNAMES)
        # 随机选择单字或双字名字
        if random.random() < 0.5:
            given_name = random.choice(GIVEN_NAMES_SINGLE)
        else:
            given_name = random.choice(GIVEN_NAMES_DOUBLE)
        
        full_name = surname + given_name
        
        # 将中文姓名转换为拼音
        if lazy_pinyin:
            # 使用pypinyin将中文转换为拼音
            surname_pinyin = ''.join(lazy_pinyin(surname, style=Style.NORMAL))
            given_name_pinyin = ''.join(lazy_pinyin(given_name, style=Style.NORMAL))
            # 生成用户名：姓名拼音 + 随机数字（增加随机性）
            username = f"{surname_pinyin}{given_name_pinyin}{random.randint(100, 999)}"
        else:
            # 如果没有pypinyin，使用简化方式（首字母）
            username = f"{surname.lower()}{given_name[:1].lower()}{random.randint(1000, 9999)}"
        
        # 如果用户名已使用，继续尝试
        if username not in used_usernames:
            used_usernames.add(username)
            return full_name, username
    
    # 如果100次尝试都失败，使用时间戳
    import time
    surname = random.choice(SURNAMES)
    given_name = random.choice(GIVEN_NAMES_SINGLE)
    full_name = surname + given_name
    
    if lazy_pinyin:
        surname_pinyin = ''.join(lazy_pinyin(surname, style=Style.NORMAL))
        given_name_pinyin = ''.join(lazy_pinyin(given_name, style=Style.NORMAL))
        username = f"{surname_pinyin}{given_name_pinyin}{int(time.time())}"
    else:
        username = f"{surname.lower()}{given_name[:1].lower()}{int(time.time())}"
    
    used_usernames.add(username)
    return full_name, username


def generate_phone() -> str:
    """
    生成随机手机号
    
    Returns:
        str: 手机号
    """
    # 中国手机号格式：1开头，第二位是3/4/5/6/7/8/9
    second_digit = random.choice(['3', '4', '5', '6', '7', '8', '9'])
    remaining = ''.join([str(random.randint(0, 9)) for _ in range(9)])
    return f"1{second_digit}{remaining}"


def generate_email(username: str) -> str:
    """
    生成邮箱地址
    
    Args:
        username: 用户名
        
    Returns:
        str: 邮箱地址
    """
    domains = ['qq.com', '163.com', '126.com', 'gmail.com', 'sina.com', 'outlook.com']
    return f"{username}@{random.choice(domains)}"


async def mock_users_for_departments(tenant_id: int = 1, users_per_dept: int = 3, force_recreate: bool = False):
    """
    为每个部门生成模拟用户
    
    Args:
        tenant_id: 组织ID
        users_per_dept: 每个部门创建的用户数量
        force_recreate: 是否强制重新创建（删除现有用户后重新创建）
    """
    # 确保时区配置正确
    TORTOISE_ORM["use_tz"] = platform_settings.USE_TZ
    TORTOISE_ORM["timezone"] = platform_settings.TIMEZONE
    
    # 初始化数据库连接
    await Tortoise.init(config=TORTOISE_ORM)
    
    try:
        # 验证租户是否存在
        from soil.models.tenant import Tenant
        tenant = await Tenant.filter(id=tenant_id).first()
        if not tenant:
            print(f"❌ 错误：租户 ID {tenant_id} 不存在")
            return
        print(f"📋 使用租户: {tenant.name} (ID: {tenant_id})")
        
        # 获取所有部门
        departments = await Department.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).all()
        
        if not departments:
            print("❌ 没有找到部门，请先创建部门")
            return
        
        print(f"📋 找到 {len(departments)} 个部门，开始为每个部门创建 {users_per_dept} 个用户...")
        
        total_created = 0
        total_skipped = 0
        used_usernames = set()  # 用于跟踪已使用的用户名，避免重复
        
        for dept in departments:
            print(f"\n📁 处理部门: {dept.name} (UUID: {dept.uuid})")
            
            # 检查该部门是否已有用户
            existing_count = await User.filter(
                tenant_id=tenant_id,
                department_id=dept.id,
                deleted_at__isnull=True
            ).count()
            
            if existing_count > 0:
                if force_recreate:
                    # 强制重新创建：删除该部门的所有现有用户（软删除）
                    await User.filter(
                        tenant_id=tenant_id,
                        department_id=dept.id,
                        deleted_at__isnull=True
                    ).update(deleted_at=datetime.now())
                    print(f"   🗑️  删除该部门 {existing_count} 个现有用户，准备重新创建")
                else:
                    print(f"   ⚠️  该部门已有 {existing_count} 个用户，跳过")
                    total_skipped += existing_count
                    continue
            
            # 为该部门创建用户
            for i in range(users_per_dept):
                try:
                    full_name, username = generate_chinese_name(used_usernames)
                    phone = generate_phone()
                    email = generate_email(username)
                    
                    # 创建用户数据
                    user_data = UserCreate(
                        username=username,
                        email=email,
                        password="12345678",  # 默认密码
                        full_name=full_name,
                        phone=phone,
                        tenant_id=tenant_id,
                        department_uuid=dept.uuid,
                        is_active=True,
                        is_tenant_admin=False,
                    )
                    
                    # 创建用户
                    user = await UserService.create_user(
                        tenant_id=tenant_id,
                        data=user_data,
                        current_user_id=1  # 使用系统管理员ID
                    )
                    
                    print(f"   ✅ 创建用户: {full_name} ({username}) - {email}")
                    total_created += 1
                    
                except Exception as e:
                    print(f"   ❌ 创建用户失败: {str(e)}")
                    continue
        
        print(f"\n✨ 完成！")
        print(f"   - 成功创建: {total_created} 个用户")
        print(f"   - 跳过部门: {total_skipped} 个用户（已有用户）")
        
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    # 从命令行参数获取配置
    tenant_id = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    users_per_dept = int(sys.argv[2]) if len(sys.argv) > 2 else 3
    force_recreate = len(sys.argv) > 3 and sys.argv[3].lower() in ['true', '1', 'yes', 'force']
    
    if force_recreate:
        print(f"🚀 开始为组织 {tenant_id} 的每个部门强制重新创建 {users_per_dept} 个模拟用户（将删除现有用户）...")
    else:
        print(f"🚀 开始为组织 {tenant_id} 的每个部门创建 {users_per_dept} 个模拟用户...")
    
    asyncio.run(mock_users_for_departments(tenant_id=tenant_id, users_per_dept=users_per_dept, force_recreate=force_recreate))


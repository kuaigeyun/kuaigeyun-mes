"""
同步数据库操作模块

在 Windows 环境下使用同步数据库连接绕过 asyncpg 的异步兼容性问题
"""

import psycopg2
import psycopg2.extras
from typing import Optional, Dict, Any, List
from contextlib import contextmanager
from app.config import settings
import logging

logger = logging.getLogger(__name__)

# 数据库连接参数 - 动态获取以确保使用正确的环境变量
def get_sync_db_config():
    """获取数据库连接配置"""
    return {
        "host": settings.DB_HOST,
        "port": settings.DB_PORT,
        "user": settings.DB_USER,
        "password": settings.DB_PASSWORD,
        "database": settings.DB_NAME,
        "connect_timeout": 30,
    }


@contextmanager
def get_sync_connection():
    """
    获取同步数据库连接的上下文管理器

    Yields:
        psycopg2.connection: 数据库连接对象
    """
    conn = None
    try:
        # 使用动态配置确保获取最新的环境变量
        db_config = get_sync_db_config()
        conn = psycopg2.connect(**db_config)
        # 在连接建立后设置编码
        conn.set_client_encoding('UTF8')
        yield conn
    except Exception as e:
        logger.error(f"数据库连接失败: {e}")
        raise
    finally:
        if conn:
            conn.close()


def execute_query(query: str, params: tuple = None, fetch_one: bool = False) -> Optional[Dict[str, Any]]:
    """
    执行查询并返回结果

    Args:
        query: SQL 查询语句
        params: 查询参数
        fetch_one: 是否只返回一行结果

    Returns:
        查询结果字典或 None
    """
    with get_sync_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(query, params or ())

            if fetch_one:
                return cur.fetchone()
            else:
                return cur.fetchall()


def authenticate_user(username: str, password: str, tenant_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
    """
    验证用户身份

    Args:
        username: 用户名
        password: 密码
        tenant_id: 组织 ID（可选）

    Returns:
        用户信息字典或 None
    """
    from core.security import verify_password
    from app.config import settings

    logger.info(f"认证配置: host={settings.DB_HOST}, port={settings.DB_PORT}, user={settings.DB_USER}, db={settings.DB_NAME}")
    db_config = get_sync_db_config()
    logger.info(f"数据库配置: {db_config}")

    try:
        # 使用更安全的数据库连接方式
        with get_sync_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                # 优先查找超级管理员
                if username == "superadmin":
                    cur.execute("""
                        SELECT id, username, email, password_hash::text, is_platform_admin, is_active, tenant_id
                        FROM root_users
                        WHERE username = %s AND tenant_id IS NULL AND is_platform_admin = true
                    """, (username,))

                else:
                    # 查找普通用户
                    cur.execute("""
                        SELECT id, username, email, password_hash::text, is_platform_admin, is_active, tenant_id, is_tenant_admin
                        FROM root_users
                        WHERE username = %s AND tenant_id = %s
                    """, (username, tenant_id or 1))

                user = cur.fetchone()

        if user and user['is_active']:
            # 验证密码
            password_hash = str(user['password_hash'])  # 确保是字符串类型
            if verify_password(password, password_hash):
                return dict(user)

        return None

    except Exception as e:
        logger.error(f"用户认证失败: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return None


def test_connection() -> bool:
    """测试数据库连接"""
    try:
        with get_sync_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                result = cur.fetchone()
                return result == (1,)
    except Exception as e:
        logger.error(f"数据库连接测试失败: {e}")
        return False

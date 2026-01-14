#!/usr/bin/env python3
"""
数据库备份脚本

用于备份MRP/LRP和销售预测/销售订单相关表
自动从.env文件读取数据库配置
"""

import os
import sys
import subprocess
from datetime import datetime
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent.parent
backend_dir = project_root / "riveredge-backend"
sys.path.insert(0, str(backend_dir))

# 读取.env文件
def load_env_file(env_path):
    """从.env文件加载环境变量"""
    env_vars = {}
    if env_path.exists():
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    env_vars[key.strip()] = value.strip()
    return env_vars

# 加载环境变量
env_path = backend_dir / ".env"
env_vars = load_env_file(env_path)

# 数据库配置
DB_HOST = env_vars.get("DB_HOST", "localhost")
DB_PORT = env_vars.get("DB_PORT", "5432")
DB_USER = env_vars.get("DB_USER", "postgres")
DB_PASSWORD = env_vars.get("DB_PASSWORD", "postgres")
DB_NAME = env_vars.get("DB_NAME", "riveredge")

# 备份目录和文件
backup_dir = Path(__file__).parent
backup_file = backup_dir / f"database_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sql"

# 需要备份的表
TABLES = [
    "apps_kuaizhizao_mrp_results",
    "apps_kuaizhizao_lrp_results",
    "apps_kuaizhizao_sales_forecasts",
    "apps_kuaizhizao_sales_orders",
]

def check_table_exists(host, port, user, password, database, table):
    """检查表是否存在"""
    try:
        # 使用psql检查表是否存在
        cmd = [
            "psql",
            "-h", host,
            "-p", str(port),
            "-U", user,
            "-d", database,
            "-tAc",
            f"SELECT 1 FROM information_schema.tables WHERE table_name='{table}'"
        ]
        
        env = os.environ.copy()
        env["PGPASSWORD"] = password
        
        result = subprocess.run(
            cmd,
            env=env,
            capture_output=True,
            text=True,
            timeout=10
        )
        
        return result.returncode == 0 and result.stdout.strip() == "1"
    except Exception as e:
        print(f"⚠️  检查表 {table} 时出错: {e}")
        return False

def backup_tables(host, port, user, password, database, tables, output_file):
    """备份指定的表"""
    try:
        # 构建pg_dump命令
        cmd = [
            "pg_dump",
            "-h", host,
            "-p", str(port),
            "-U", user,
            "-d", database,
            "--clean",
            "--if-exists",
            "--no-owner",
            "--no-acl",
        ]
        
        # 添加表参数
        for table in tables:
            cmd.extend(["-t", table])
        
        # 设置环境变量
        env = os.environ.copy()
        env["PGPASSWORD"] = password
        
        print(f"执行备份命令...")
        print(f"数据库: {database}")
        print(f"主机: {host}:{port}")
        print(f"用户: {user}")
        print(f"备份表数: {len(tables)}")
        print(f"备份文件: {output_file}")
        print()
        
        # 执行备份
        with open(output_file, 'w', encoding='utf-8') as f:
            result = subprocess.run(
                cmd,
                env=env,
                stdout=f,
                stderr=subprocess.PIPE,
                text=True,
                timeout=300
            )
        
        if result.returncode == 0:
            file_size = output_file.stat().st_size
            file_size_mb = file_size / (1024 * 1024)
            print(f"✅ 数据库备份完成")
            print(f"备份文件: {output_file}")
            print(f"备份大小: {file_size_mb:.2f} MB")
            print(f"备份表数: {len(tables)}")
            print()
            print("备份的表:")
            for table in tables:
                print(f"  - {table}")
            return True
        else:
            print(f"❌ 数据库备份失败")
            print(f"错误信息: {result.stderr}")
            return False
            
    except subprocess.TimeoutExpired:
        print(f"❌ 数据库备份超时（超过5分钟）")
        return False
    except FileNotFoundError:
        print(f"❌ 错误: pg_dump 命令未找到")
        print("请确保已安装 PostgreSQL 客户端工具")
        print()
        print("Windows 安装方法:")
        print("  1. 下载 PostgreSQL: https://www.postgresql.org/download/windows/")
        print("  2. 安装时选择包含命令行工具")
        print("  3. 将 PostgreSQL bin 目录添加到 PATH 环境变量")
        return False
    except Exception as e:
        print(f"❌ 数据库备份失败: {e}")
        return False

def main():
    """主函数"""
    print("=== 数据库备份脚本 ===")
    print()
    
    # 检查pg_dump是否可用
    try:
        subprocess.run(["pg_dump", "--version"], capture_output=True, check=True)
    except (FileNotFoundError, subprocess.CalledProcessError):
        print("❌ 错误: pg_dump 命令未找到")
        print("请确保已安装 PostgreSQL 客户端工具")
        return 1
    
    # 检查表是否存在
    print("检查需要备份的表...")
    existing_tables = []
    for table in TABLES:
        if check_table_exists(DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, table):
            existing_tables.append(table)
            print(f"✅ 表 {table} 存在")
        else:
            print(f"⚠️  表 {table} 不存在（可能尚未创建）")
    
    print()
    
    if not existing_tables:
        print("⚠️  警告: 没有找到需要备份的表")
        print("可能原因:")
        print("  1. 数据库尚未初始化")
        print("  2. 表名不正确")
        print("  3. 数据库连接失败")
        print()
        print("创建占位符备份文件...")
        with open(backup_file, 'w', encoding='utf-8') as f:
            f.write(f"-- 数据库备份占位符\n")
            f.write(f"-- 备份时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"-- 说明: 未找到需要备份的表，可能数据库尚未初始化\n")
            f.write(f"-- 需要备份的表:\n")
            for table in TABLES:
                f.write(f"--   - {table}\n")
        print(f"✅ 占位符文件已创建: {backup_file}")
        return 0
    
    # 执行备份
    if backup_tables(DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, existing_tables, backup_file):
        return 0
    else:
        return 1

if __name__ == "__main__":
    sys.exit(main())

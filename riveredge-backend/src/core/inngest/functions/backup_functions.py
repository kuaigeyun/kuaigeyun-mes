"""
数据备份与恢复 Inngest 函数

处理后台的数据库转储、文件打包和数据恢复任务。
"""

import os
import subprocess
import zipfile
import shutil
from datetime import datetime
from loguru import logger
from inngest import Step, TriggerEvent
import inngest

from core.inngest.client import inngest_client
from core.models.data_backup import DataBackup
from infra.config.infra_config import infra_settings


@inngest_client.create_function(
    fn_id="data_backup_workflow",
    trigger=TriggerEvent(event="database/backup.requested"),
)
async def data_backup_workflow(ctx: inngest.Context, step: Step):
    """
    数据备份工作流
    
    1. 更新记录状态为 running
    2. 执行 pg_dump 导出数据库
    3. 打包 uploads 目录 (如果是全量备份)
    4. 压缩为最终 zip 文件
    5. 更新记录状态和文件信息
    """
    event_data = ctx.event.data
    backup_uuid = event_data.get("backup_uuid")
    tenant_id = event_data.get("tenant_id")
    backup_type = event_data.get("backup_type", "full")
    
    # 获取备份记录
    backup = await DataBackup.get(uuid=backup_uuid)
    backup.status = "running"
    backup.started_at = datetime.now()
    backup.inngest_run_id = ctx.run_id
    await backup.save()
    
    # 使用绝对路径，避免 Inngest 多步执行时不同请求的工作目录不一致导致文件找不到
    backup_dir = os.path.abspath("backups")
    os.makedirs(backup_dir, exist_ok=True)
    temp_dir = os.path.join(backup_dir, f"temp_{backup_uuid}")
    db_dump_file = os.path.join(temp_dir, "db_dump.dump")
    
    try:
        # 将 dump 和 zip 合并为单一步骤：Inngest 的 step.run 可能在不同 HTTP 请求中执行，
        # 第二次请求会跳过已完成的 step，导致 create_zip 在另一进程中找不到 dump 生成的文件
        def dump_and_create_zip():
            # 获取数据库连接配置
            db_user = infra_settings.DB_USER
            db_password = infra_settings.DB_PASSWORD
            db_host = infra_settings.DB_HOST
            db_port = infra_settings.DB_PORT
            db_name = infra_settings.DB_NAME
            
            env = os.environ.copy()
            env["PGPASSWORD"] = db_password
            
            os.makedirs(temp_dir, exist_ok=True)
            
            backup_scope = event_data.get("backup_scope", "full")
            if backup_scope == "tenant" and tenant_id:
                # 租户隔离备份：仅备份该租户的数据
                logger.info(f"开始执行租户隔离备份: tenant_id={tenant_id}")
                db_dump_path = os.path.join(temp_dir, "db_dump.sql")
                
                get_tables_cmd = [
                    "psql",
                    "-h", db_host,
                    "-p", str(db_port),
                    "-U", db_user,
                    "-d", db_name,
                    "-t",
                    "-c", f"SELECT table_name FROM information_schema.columns WHERE column_name = 'tenant_id' AND table_schema = 'public'"
                ]
                result = subprocess.run(get_tables_cmd, env=env, capture_output=True, text=True)
                if result.returncode != 0:
                    raise Exception(f"获取表列表失败: {result.stderr}")
                
                tables = [t.strip() for t in result.stdout.split('\n') if t.strip()]
                logger.info(f"发现 {len(tables)} 个租户相关表: {tables}")
                
                with open(db_dump_path, "w", encoding="utf-8") as f:
                    f.write("-- Tenant Isolated Backup\n")
                    f.write(f"-- Tenant ID: {tenant_id}\n")
                    f.write(f"-- Date: {datetime.now()}\n\n")
                    
                    for table in tables:
                        copy_cmd = [
                            "psql",
                            "-h", db_host,
                            "-p", str(db_port),
                            "-U", db_user,
                            "-d", db_name,
                            "-c", f"COPY (SELECT * FROM \"{table}\" WHERE tenant_id = {tenant_id}) TO STDOUT WITH (FORMAT CSV, HEADER, ENCODING 'UTF8')"
                        ]
                        logger.debug(f"正在导出表: {table}")
                        table_result = subprocess.run(copy_cmd, env=env, capture_output=True, text=True)
                        if table_result.returncode == 0:
                            f.write(f"-- Data for table: {table}\n")
                            f.write(f"--- TABLE: {table} ---\n")
                            f.write(table_result.stdout)
                            f.write("\n\n")
                        else:
                            logger.error(f"导出表 {table} 失败: {table_result.stderr}")
            else:
                # 全量备份：执行 pg_dump
                cmd = [
                    "pg_dump",
                    "-h", db_host,
                    "-p", str(db_port),
                    "-U", db_user,
                    "-F", "c",  # 自定义格式 (压缩格式)
                    "-b",       # 包含大对象
                    "-v",       # 详细输出
                    "-f", db_dump_file,
                    db_name
                ]
                logger.info(f"执行数据库全量转储: {' '.join(cmd)}")
                result = subprocess.run(cmd, env=env, capture_output=True, text=True)
                if result.returncode != 0:
                    raise Exception(f"pg_dump 失败: {result.stderr}")
            
            # 打包为 zip（在同一执行上下文中，文件一定存在）
            final_zip_name = f"{backup.name}_{datetime.now().strftime('%Y%m%d%H%M%S')}.zip"
            final_zip_path = os.path.join(backup_dir, final_zip_name)
            
            dump_path = db_dump_file if backup_scope != "tenant" else os.path.join(temp_dir, "db_dump.sql")
            with zipfile.ZipFile(final_zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                zipf.write(dump_path, "database.dump")
                if backup_type == "full":
                    upload_dir = infra_settings.FILE_UPLOAD_DIR
                    if upload_dir and os.path.exists(upload_dir):
                        for root, dirs, files in os.walk(upload_dir):
                            for file in files:
                                file_path = os.path.join(root, file)
                                arcname = os.path.join("uploads", os.path.relpath(file_path, upload_dir))
                                zipf.write(file_path, arcname)
            
            return final_zip_path

        final_zip_path = await step.run("dump_and_create_zip", dump_and_create_zip)
        
        # Step 3: 更新记录
        backup.status = "success"
        backup.completed_at = datetime.now()
        backup.file_path = final_zip_path
        backup.file_size = os.path.getsize(final_zip_path)
        await backup.save()
        
        logger.info(f"备份完成: {backup_uuid} -> {final_zip_path}")
        
    except Exception as e:
        logger.exception(f"备份任务失败: {e}")
        backup.status = "failed"
        backup.error_message = str(e)
        backup.completed_at = datetime.now()
        await backup.save()
    finally:
        # 清理临时目录
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)


@inngest_client.create_function(
    fn_id="data_restore_workflow",
    trigger=TriggerEvent(event="database/restore.requested"),
)
async def data_restore_workflow(ctx: inngest.Context, step: Step):
    """
    数据恢复工作流
    
    1. 解压备份文件
    2. 执行 pg_restore 恢复数据库
    3. 覆盖恢复 uploads 目录 (如果存在)
    """
    # 恢复逻辑目前仅作为占位，因为恢复操作极其危险且需要更复杂的连接管理
    # 在生产环境中通常需要停止应用服务
    logger.warning("收到恢复请求，当前实现仅记录日志。恢复功能建议手动执行 pg_restore。")
    pass

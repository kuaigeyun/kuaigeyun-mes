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
from inngest import Step, Trigger
import inngest

from core.inngest.client import inngest_client
from core.models.data_backup import DataBackup
from infra.config.infra_config import infra_settings


@inngest_client.create_function(
    fn_id="data_backup_workflow",
    trigger=Trigger(event="database/backup.requested"),
)
async def data_backup_workflow(ctx: inngest_client.Context, step: Step):
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
    
    # 定义临时目录
    temp_dir = os.path.join("temp", f"backup_{backup_uuid}")
    os.makedirs(temp_dir, exist_ok=True)
    
    db_dump_file = os.path.join(temp_dir, "db_dump.sql")
    
    try:
        # Step 1: 执行数据库转储
        def dump_db():
            # 获取数据库连接配置
            db_user = infra_settings.DB_USER
            db_password = infra_settings.DB_PASSWORD
            db_host = infra_settings.DB_HOST
            db_port = infra_settings.DB_PORT
            db_name = infra_settings.DB_NAME
            
            # 设置环境变量 PGPASSWORD 避免交互式输入密码
            env = os.environ.copy()
            env["PGPASSWORD"] = db_password
            
            # 构建 pg_dump 命令 (Windows 下需要确保 pg_dump 在 PATH 中)
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
            
            logger.info(f"执行数据库转储: {' '.join(cmd)}")
            result = subprocess.run(cmd, env=env, capture_output=True, text=True)
            if result.returncode != 0:
                raise Exception(f"pg_dump 失败: {result.stderr}")
            return True

        await step.run("dump_database", dump_db)
        
        # Step 2: 打包资源文件 (如果需要)
        final_zip_name = f"{backup.name}_{datetime.now().strftime('%Y%m%d%H%M%S')}.zip"
        backup_dir = os.path.abspath("backups")
        os.makedirs(backup_dir, exist_ok=True)
        final_zip_path = os.path.join(backup_dir, final_zip_name)
        
        def create_zip():
            with zipfile.ZipFile(final_zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                # 添加数据库转储文件
                zipf.write(db_dump_file, "database.dump")
                
                # 如果是全量备份，顺便打包 uploads
                if backup_type == "full":
                    upload_dir = infra_settings.FILE_UPLOAD_DIR
                    if os.path.exists(upload_dir):
                        for root, dirs, files in os.walk(upload_dir):
                            for file in files:
                                file_path = os.path.join(root, file)
                                arcname = os.path.join("uploads", os.path.relpath(file_path, upload_dir))
                                zipf.write(file_path, arcname)
            return True

        await step.run("create_zip_archive", create_zip)
        
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
    trigger=Trigger(event="database/restore.requested"),
)
async def data_restore_workflow(ctx: inngest_client.Context, step: Step):
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

"""
Taskiq 入口：PostgreSQL broker（taskiq-pg / AsyncpgBroker）+ PG 持久化调度。

API 进程与 worker 进程均需能 import 本模块以注册任务。
"""

import os
from urllib.parse import quote_plus

from loguru import logger
from taskiq import TaskiqDepends, TaskiqScheduler
from taskiq.context import Context
from taskiq.events import TaskiqEvents
from taskiq.state import TaskiqState

from taskiq_pg.asyncpg import AsyncpgBroker, AsyncpgScheduleSource

from infra.config.infra_config import infra_settings


def _taskiq_pool_kwargs() -> dict:
    """Taskiq asyncpg 池参数；默认远小于 asyncpg 内置 min_size=10，避免多进程占满 PG 连接。"""
    raw_min = os.environ.get("RIVEREDGE_TASKIQ_POOL_MIN", "1")
    raw_max = os.environ.get("RIVEREDGE_TASKIQ_POOL_MAX", "3")
    try:
        min_size = max(1, int(raw_min))
    except (TypeError, ValueError):
        min_size = 1
    try:
        max_size = max(min_size, int(raw_max))
    except (TypeError, ValueError):
        max_size = 3
    return {
        "min_size": min_size,
        "max_size": max_size,
        "command_timeout": 60,
        "server_settings": {"application_name": "riveredge_taskiq"},
    }


_TASKIQ_POOL = _taskiq_pool_kwargs()


def get_taskiq_postgres_dsn() -> str:
    """与 Tortoise 使用同一数据库；密码中的特殊字符需编码。"""
    user = quote_plus(infra_settings.DB_USER)
    password = quote_plus(infra_settings.DB_PASSWORD) if infra_settings.DB_PASSWORD else ""
    host = infra_settings.DB_HOST
    if host == "localhost":
        host = "127.0.0.1"
    db = infra_settings.DB_NAME
    if password:
        auth = f"{user}:{password}"
    else:
        auth = user
    return f"postgresql://{auth}@{host}:{infra_settings.DB_PORT}/{db}"


broker = AsyncpgBroker(
    dsn=get_taskiq_postgres_dsn,
    table_name="riveredge_taskiq_messages",
    channel_name="riveredge_taskiq",
    write_kwargs=_TASKIQ_POOL,
    read_kwargs={
        "server_settings": {"application_name": "riveredge_taskiq_listen"},
    },
)

schedule_source = AsyncpgScheduleSource(
    broker=broker,
    dsn=get_taskiq_postgres_dsn,
    table_name="riveredge_taskiq_schedules",
    **_TASKIQ_POOL,
)

scheduler = TaskiqScheduler(
    broker=broker,
    sources=[schedule_source],
)

task = broker.task


async def _on_worker_startup(_state: TaskiqState) -> None:
    """Worker 进程无 FastAPI lifespan，需在此初始化 Tortoise，否则 ORM 任务会静默失败（状态卡在 pending）。"""
    from infra.infrastructure.database.database import init_tortoise_for_worker_process

    await init_tortoise_for_worker_process()
    # 与 API 侧 kiq 的 task_name 必须一致；若缺漏，Receiver 会打 warning「task is not found」且备份永远 pending
    try:
        names = sorted(broker.get_all_tasks().keys())
        logger.info("Taskiq worker 已注册任务: {}", names)
    except Exception as e:  # pragma: no cover
        logger.warning("枚举 Taskiq 任务失败: {}", e)


async def _on_worker_shutdown(_state: TaskiqState) -> None:
    from tortoise import Tortoise
    from loguru import logger

    try:
        if Tortoise._inited:
            await Tortoise.close_connections()
        logger.info("Taskiq worker: Tortoise 连接已关闭")
    except Exception as e:  # pragma: no cover
        logger.warning("Taskiq worker: 关闭 Tortoise 时异常: {}", e)


broker.add_event_handler(TaskiqEvents.WORKER_STARTUP, _on_worker_startup)
broker.add_event_handler(TaskiqEvents.WORKER_SHUTDOWN, _on_worker_shutdown)


@task()
async def run_event_pipeline(
    event_name: str,
    data: dict | None = None,
    event_id: str | None = None,
    context: Context = TaskiqDepends(),
):
    """统一入口：按 event_name 执行 dispatcher 里注册的所有处理器。"""
    from core.tasks.dispatcher import execute_event_handlers

    return await execute_event_handlers(
        event_name=event_name,
        data=data or {},
        event_id=event_id,
        run_id=context.message.task_id,
    )


@task(schedule=[{"cron": "*/10 * * * *"}])
async def online_user_cleanup_task() -> None:
    from core.services.logging.online_user_service import OnlineUserService

    await OnlineUserService.cleanup_expired_activities()


@task(schedule=[{"cron": "* * * * *"}])
async def scheduled_tasks_minute_tick() -> dict:
    """每分钟扫描 ScheduledTask 并投递 scheduled-task/execute。"""
    from core.workflows.functions.scheduled_task_scheduler import run_scheduled_task_scheduler_tick

    return await run_scheduled_task_scheduler_tick()


@task(schedule=[{"cron": "0 * * * *"}])
async def exception_detection_hourly_tick() -> dict:
    """每小时投递 exception/detect-all（与原小时级 cron 一致）。"""
    from apps.kuaizhizao.workflows.functions.exception_detection_workflow import (
        run_exception_detection_scheduler,
    )

    return await run_exception_detection_scheduler()


@task(schedule=[{"cron": "0 8 * * *"}])
async def maintenance_reminder_daily_tick() -> dict:
    """每天 8:00 投递 maintenance-reminder/check。"""
    from apps.kuaizhizao.workflows.functions.maintenance_reminder_workflow import (
        run_maintenance_reminder_scheduler,
    )

    return await run_maintenance_reminder_scheduler()


@task(schedule=[{"cron": "*/30 * * * *"}])
async def work_order_score_recalc_tick() -> dict:
    """每 30 分钟批量重算 released 工单综合分。"""
    from apps.kuaizhizao.workflows.functions.work_order_score_workflow import (
        run_work_order_score_scheduler,
    )

    return await run_work_order_score_scheduler()


@task(schedule=[{"cron": "15 2 * * *"}])
async def permission_governance_daily_tick() -> dict:
    """每天凌晨执行一次全租户权限治理兜底。"""
    from core.services.authorization.permission_sync_service import PermissionSyncService
    from core.services.authorization.permission_policy_service import PermissionPolicyService

    permission_result = await PermissionSyncService.sync_all_active_tenants(dry_run=False, prune=True)
    field_result = await PermissionPolicyService.canonicalize_field_policies_all_tenants()
    return {
        "permission_governance": permission_result,
        "field_governance": field_result,
    }


@task(schedule=[{"cron": "30 2 * * *"}])
async def customer_pool_recycle_daily_tick() -> dict:
    """每天凌晨执行客户池自动回收。"""
    from apps.kuaizhizao.services.customer_pool_service import CustomerPoolService

    return await CustomerPoolService.execute_recycle_job()


# 数据备份/恢复仍通过 register_event_handler 注册
from core.tasks.data_backup_handlers import register_data_backup_handlers  # noqa: E402

register_data_backup_handlers()

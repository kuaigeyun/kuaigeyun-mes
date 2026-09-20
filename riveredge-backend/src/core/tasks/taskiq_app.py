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

    from core.tasks.workflow_bootstrap import bootstrap_worker_event_handlers

    await bootstrap_worker_event_handlers()

    try:
        from apps.kuaiiot.services.mqtt_subscriber_service import MqttSubscriberService

        await MqttSubscriberService.start_all()
    except ImportError:
        pass
    except Exception as e:  # pragma: no cover
        logger.warning("KuaiIoT MQTT 订阅启动失败: {}", e)

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
        from apps.kuaiiot.services.mqtt_subscriber_service import MqttSubscriberService

        await MqttSubscriberService.stop_all()
    except ImportError:
        pass
    except Exception as e:  # pragma: no cover
        logger.warning("KuaiIoT MQTT 订阅停止失败: {}", e)

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


@task(schedule=[{"cron": "* * * * *"}])
async def reporting_kingdee_push_retry_tick() -> dict:
    """每分钟重试到期的未推送成功金蝶生产汇报单（退避 1m/5m/30m/2h/8h，超限置 dead）。"""
    from apps.kuaizhizao.services.kingdee_production_report_push_service import (
        KingdeeProductionReportPushService,
    )

    return await KingdeeProductionReportPushService().retry_due_pushes()


@task(schedule=[{"cron": "*/10 * * * *"}])
async def online_user_cleanup_task() -> None:
    from core.services.logging.online_user_service import OnlineUserService

    await OnlineUserService.cleanup_expired_activities()


@task(schedule=[{"cron": "* * * * *"}])
async def scheduled_tasks_minute_tick() -> dict:
    """每分钟扫描 ScheduledTask 并投递 scheduled-task/execute。"""
    from core.workflows.functions.scheduled_task_scheduler import run_scheduled_task_scheduler_tick

    return await run_scheduled_task_scheduler_tick()


@task(schedule=[{"cron": "* * * * *"}])
async def reminder_event_dispatch_tick() -> dict:
    """每分钟扫描到期提醒事件并派发（INF-03）。"""
    from core.services.business.reminder_dispatch_service import ReminderDispatchService

    return await ReminderDispatchService.process_all_due()


@task(schedule=[{"cron": "* * * * *"}])
async def kuaiiot_offline_check_tick() -> dict:
    """每分钟检测快数采设备离线。"""
    from apps.kuaiiot.workflows.functions.device_lifecycle_workflow import run_kuaiiot_offline_check

    return await run_kuaiiot_offline_check()


@task(schedule=[{"cron": "*/2 * * * *"}])
async def kuaiiot_mqtt_reload_tick() -> dict:
    """每 2 分钟对齐 MQTT 连接源订阅。"""
    from apps.kuaiiot.workflows.functions.mqtt_subscriber_workflow import run_kuaiiot_mqtt_reload

    return await run_kuaiiot_mqtt_reload()


@task(schedule=[{"cron": "*/5 * * * *"}])
async def kuaiiot_telemetry_pull_tick() -> dict:
    """每 5 分钟拉取 ThingsBoard / JetLinks 最新遥测。"""
    from apps.kuaiiot.workflows.functions.telemetry_sync_workflow import run_kuaiiot_telemetry_pull

    return await run_kuaiiot_telemetry_pull()


@task(schedule=[{"cron": "*/5 * * * *"}])
async def kuaiiot_connection_health_tick() -> dict:
    """每 5 分钟探测启用连接源健康状态。"""
    from apps.kuaiiot.workflows.functions.connection_health_workflow import run_kuaiiot_connection_health_check

    return await run_kuaiiot_connection_health_check()


@task(schedule=[{"cron": "* * * * *"}])
async def kuaiiot_edge_agent_offline_tick() -> dict:
    """每分钟检测边缘 Agent 心跳超时。"""
    from apps.kuaiiot.workflows.functions.edge_agent_lifecycle_workflow import run_kuaiiot_edge_agent_offline_check

    return await run_kuaiiot_edge_agent_offline_check()


@task(schedule=[{"cron": "* * * * *"}])
async def kuaiiot_command_timeout_tick() -> dict:
    """每分钟将超时未回执指令置为 timeout。"""
    from apps.kuaiiot.workflows.functions.command_timeout_workflow import run_kuaiiot_command_timeout_check

    return await run_kuaiiot_command_timeout_check()


@task(schedule=[{"cron": "0 3 * * *"}])
async def kuaiiot_retention_tick() -> dict:
    """每天凌晨清理过期入站幂等记录与已确认告警。"""
    from apps.kuaiiot.workflows.functions.retention_workflow import run_kuaiiot_retention_cleanup

    return await run_kuaiiot_retention_cleanup()


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


# 数据备份/恢复仍通过 register_event_handler 注册
from core.tasks.data_backup_handlers import register_data_backup_handlers  # noqa: E402

register_data_backup_handlers()

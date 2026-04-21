"""
下线样品试用单功能：drop 表 + 清理菜单/权限残留。

背景：样品试用单（SampleTrial）在轻量系统中价值低，前后端已移除代码与路由；
此迁移负责数据库层的清理，与代码层保持一致。

- DROP 业务表：apps_kuaizhizao_sample_trials、apps_kuaizhizao_sample_trial_items
- 清理 core_menus 中残留菜单（路径匹配）
- 清理 core_permissions 中样品试用相关权限码（模式匹配）
- 清理 core_approval_processes 中 code='sample_trial' 的流程配置

不可逆：downgrade 仅返回空字符串，如需恢复需重新建表 + 恢复历史数据。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_sample_trial_items" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_sample_trials" CASCADE;

        DELETE FROM "core_menus"
        WHERE "path" LIKE '/apps/kuaizhizao/sales-management/sample-trials%'
           OR "path" LIKE '/apps/kuaizhizao/sales-management/reports/sample-trial-query%';

        DELETE FROM "core_permissions"
        WHERE "code" LIKE 'kuaizhizao:sample-trial:%'
           OR "code" = 'kuaizhizao:sales-management-reports-sample-trial-query:view';

        DELETE FROM "core_approval_processes"
        WHERE "code" = 'sample_trial';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return ""

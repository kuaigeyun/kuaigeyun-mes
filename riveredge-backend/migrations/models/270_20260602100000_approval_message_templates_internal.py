"""审批通过/驳回默认消息模板改为站内信。"""

from tortoise import BaseDBAsyncClient

CODES = ("approval_approved", "approval_rejected")
DESCRIPTIONS = {
    "approval_approved": "审批通过时发送的站内信",
    "approval_rejected": "审批驳回时发送的站内信",
}


async def upgrade(db: BaseDBAsyncClient) -> str:
    statements = []
    for code in CODES:
        desc = DESCRIPTIONS[code]
        statements.append(
            f"""
            UPDATE core_message_templates
            SET type = 'internal',
                description = '{desc}',
                updated_at = NOW()
            WHERE code = '{code}'
              AND type = 'email'
              AND deleted_at IS NULL;
            """
        )
    return "\n".join(statements)


async def downgrade(db: BaseDBAsyncClient) -> str:
    old_descriptions = {
        "approval_approved": "审批通过时发送的通知邮件",
        "approval_rejected": "审批驳回时发送的通知邮件",
    }
    statements = []
    for code in CODES:
        desc = old_descriptions[code]
        statements.append(
            f"""
            UPDATE core_message_templates
            SET type = 'email',
                description = '{desc}',
                updated_at = NOW()
            WHERE code = '{code}'
              AND type = 'internal'
              AND deleted_at IS NULL;
            """
        )
    return "\n".join(statements)

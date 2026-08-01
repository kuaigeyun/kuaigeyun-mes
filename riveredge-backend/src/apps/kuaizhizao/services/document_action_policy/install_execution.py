"""安装执行业务态 capabilities。"""



from __future__ import annotations



from typing import Any, Optional, Sequence



from infra.exceptions.exceptions import BusinessLogicError



from apps.kuaizhizao.services.document_action_policy.types import (

    CAPABILITY_REASON_MESSAGES,

    ActionCapability,

    InstallExecutionCapabilities,

)



_CLOSED = "已关闭"





def _cap(allowed: bool, reason: Optional[str] = None) -> ActionCapability:

    return ActionCapability(allowed=allowed, reason=reason if not allowed else None)





def derive_install_execution_capabilities(

    job: Any,

    stages: Optional[Sequence[Any]] = None,

) -> InstallExecutionCapabilities:

    status = str(getattr(job, "status", "") or "").strip()

    closed = status == _CLOSED



    has_stages = bool(stages)

    has_pending_stage = False

    if stages:

        has_pending_stage = any(str(getattr(s, "status", "") or "").strip() != "已完成" for s in stages)



    return InstallExecutionCapabilities(

        update=_cap(

            not closed,

            "install_execution.update.closed" if closed else None,

        ),

        delete=_cap(not closed, "install_execution.delete.closed" if closed else None),

        close=_cap(

            not closed,

            "install_execution.close.already_closed" if closed else None,

        ),

        assign_task=_cap(

            not closed,

            "install_execution.assign_task.closed" if closed else None,

        ),

        advance_stage=_cap(

            not closed and has_stages and has_pending_stage,

            "install_execution.advance_stage.closed"

            if closed

            else (

                "install_execution.advance_stage.no_stages"

                if not has_stages

                else "install_execution.advance_stage.no_pending"

            ),

        ),

        register_cost=_cap(

            not closed,

            "install_execution.register_cost.closed" if closed else None,

        ),

    )





def assert_install_execution_capability(

    job: Any,

    action: str,

    *,

    capabilities: Optional[InstallExecutionCapabilities] = None,

    stages: Optional[Sequence[Any]] = None,

) -> None:

    caps = capabilities or derive_install_execution_capabilities(job, stages=stages)

    cap = getattr(caps, action, None)

    if cap is None or cap.allowed:

        return

    reason = cap.reason or f"install_execution.{action}.denied"

    message = CAPABILITY_REASON_MESSAGES.get(reason, reason)

    raise BusinessLogicError(message)


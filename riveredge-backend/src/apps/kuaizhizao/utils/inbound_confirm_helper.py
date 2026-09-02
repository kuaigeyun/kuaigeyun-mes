"""入库确认：解析入库人/退料人（支持确认时二次选择，代入库）。"""

from typing import Awaitable, Callable, Optional, Protocol, Tuple


class InboundConfirmReceiverPayload(Protocol):
    receiver_id: Optional[int]
    receiver_name: Optional[str]


async def resolve_inbound_confirm_receiver(
    *,
    confirmed_by: int,
    confirmation_data: Optional[InboundConfirmReceiverPayload],
    get_user_name: Callable[[int], Awaitable[str]],
) -> Tuple[int, str]:
    """
    确认入库时的业务操作人（入库人/退料人/收货人）。

    若请求体显式传入 receiver_id，则以所选人员为准；否则默认为确认操作人。
    """
    if confirmation_data is not None:
        rid = getattr(confirmation_data, "receiver_id", None)
        if rid is not None and int(rid) > 0:
            receiver_id = int(rid)
            receiver_name = str(getattr(confirmation_data, "receiver_name", None) or "").strip()
            if not receiver_name:
                receiver_name = await get_user_name(receiver_id)
            return receiver_id, receiver_name

    confirmer_name = await get_user_name(confirmed_by)
    return confirmed_by, confirmer_name

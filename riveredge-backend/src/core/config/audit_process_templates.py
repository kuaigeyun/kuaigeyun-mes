"""内置审核流程模板（manifest.audit.template 真源）。

单据启用审核时按模板生成 ApprovalProcess.nodes；禁止按 node_key 硬编码流程图。
租户在审批设计器绑定角色/人员后启用；空审批人默认 block，不得静默跳过。
"""

from __future__ import annotations

from typing import Any, Dict, List, Sequence, Tuple

# 与 audit_registry.VALID_TEMPLATES 保持一致（注册表校验用那边；本模块负责构图）
TEMPLATE_SIMPLE = "simple"
TEMPLATE_SME = "sme"
TEMPLATE_RD_FILE_CHANGE = "rd_file_change"

# 研发文件下发变更（#31 / L34）：发起后五级签审
RD_FILE_CHANGE_APPROVAL_STEPS: Tuple[str, ...] = (
    "经理审核",
    "项目经理审核",
    "采购审核",
    "生产审核",
    "总监审核",
)


def build_serial_approval_flow(
    *,
    step_labels: Sequence[str],
    default_approver_type: str = "role",
    empty_approver_policy: str = "block",
    timeout_hours: int | None = 24,
    y_step: int = 140,
) -> Dict[str, Any]:
    """串行多级审批：开始 → N 个 approval → 结束。"""
    labels = [str(x).strip() for x in step_labels if str(x).strip()]
    if not labels:
        raise ValueError("串行审核模板至少需要一个审批节点标签")

    nodes: List[Dict[str, Any]] = [
        {
            "id": "start",
            "type": "start",
            "position": {"x": 250, "y": 40},
            "data": {"label": "开始", "layoutDirection": "vertical"},
        }
    ]
    edges: List[Dict[str, str]] = []
    prev = "start"
    for index, step_label in enumerate(labels, start=1):
        node_id = f"approval_{index}"
        data: Dict[str, Any] = {
            "label": step_label,
            "approverType": default_approver_type,
            "approvalType": "OR",
            "layoutDirection": "vertical",
            "emptyApproverPolicy": empty_approver_policy,
            "approverIds": [],
        }
        if timeout_hours is not None and int(timeout_hours) > 0:
            data["timeoutHours"] = int(timeout_hours)
        nodes.append(
            {
                "id": node_id,
                "type": "approval",
                "position": {"x": 250, "y": 40 + index * y_step},
                "data": data,
            }
        )
        edges.append({"source": prev, "target": node_id})
        prev = node_id
    nodes.append(
        {
            "id": "end",
            "type": "end",
            "position": {"x": 250, "y": 40 + (len(labels) + 1) * y_step},
            "data": {"label": "结束", "layoutDirection": "vertical"},
        }
    )
    edges.append({"source": prev, "target": "end"})
    return {"nodes": nodes, "edges": edges}


def build_simple_audit_flow(label: str) -> Dict[str, Any]:
    """单级审核：开始 → 直属主管 → 结束。"""
    title = (label or "审核").strip() or "审核"
    return {
        "nodes": [
            {
                "id": "start",
                "type": "start",
                "position": {"x": 250, "y": 50},
                "data": {"label": "开始", "layoutDirection": "vertical"},
            },
            {
                "id": "approval_1",
                "type": "approval",
                "position": {"x": 250, "y": 200},
                "data": {
                    "label": title,
                    "approverType": "manager",
                    "approvalType": "OR",
                    "layoutDirection": "vertical",
                    "emptyApproverPolicy": "block",
                },
            },
            {
                "id": "end",
                "type": "end",
                "position": {"x": 250, "y": 350},
                "data": {"label": "结束", "layoutDirection": "vertical"},
            },
        ],
        "edges": [
            {"source": "start", "target": "approval_1"},
            {"source": "approval_1", "target": "end"},
        ],
    }


def build_rd_file_change_flow() -> Dict[str, Any]:
    """研发文件下发变更内置链（五级签审，节点待租户绑定角色）。"""
    return build_serial_approval_flow(
        step_labels=RD_FILE_CHANGE_APPROVAL_STEPS,
        default_approver_type="role",
        empty_approver_policy="block",
        timeout_hours=24,
    )


def build_flow_from_template(template: str, label: str) -> Dict[str, Any]:
    """按 manifest.audit.template 构图。"""
    code = str(template or "").strip().lower()
    if code == TEMPLATE_RD_FILE_CHANGE:
        return build_rd_file_change_flow()
    if code in {TEMPLATE_SIMPLE, TEMPLATE_SME}:
        return build_simple_audit_flow(label)
    raise ValueError(f"未知审核流程模板: {template!r}")


def is_pristine_simple_default(nodes: Any, *, label: str) -> bool:
    """是否仍为「单级 manager」默认图（可安全按新模板升级）。"""
    if not isinstance(nodes, dict):
        return False
    node_list = nodes.get("nodes") or []
    if not isinstance(node_list, list):
        return False
    approvals = [n for n in node_list if isinstance(n, dict) and n.get("type") == "approval"]
    if len(approvals) != 1:
        return False
    data = approvals[0].get("data") if isinstance(approvals[0].get("data"), dict) else {}
    approver_type = str(data.get("approverType") or data.get("approver_type") or "").strip()
    node_label = str(data.get("label") or "").strip()
    expected = (label or "").strip()
    return approver_type == "manager" and (not expected or node_label == expected)

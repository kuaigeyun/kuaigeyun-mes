"""
CRM 数据模型模块

定义CRM相关的数据模型。
"""

from apps.kuaicrm.models.lead import Lead
from apps.kuaicrm.models.opportunity import Opportunity
from apps.kuaicrm.models.sales_order import SalesOrder
from apps.kuaicrm.models.service_workorder import ServiceWorkOrder
from apps.kuaicrm.models.warranty import Warranty
from apps.kuaicrm.models.complaint import Complaint
from apps.kuaicrm.models.installation import Installation
from apps.kuaicrm.models.service_contract import ServiceContract
from apps.kuaicrm.models.lead_followup import LeadFollowUp
from apps.kuaicrm.models.opportunity_followup import OpportunityFollowUp

__all__ = [
    "Lead",
    "Opportunity",
    "SalesOrder",
    "ServiceWorkOrder",
    "Warranty",
    "Complaint",
    "Installation",
    "ServiceContract",
    "LeadFollowUp",
    "OpportunityFollowUp",
]

"""
CRM 服务模块

提供CRM相关的业务逻辑处理，支持多组织隔离。
"""

from apps.kuaicrm.services.lead_service import LeadService
from apps.kuaicrm.services.opportunity_service import OpportunityService
from apps.kuaicrm.services.sales_order_service import SalesOrderService
from apps.kuaicrm.services.service_workorder_service import ServiceWorkOrderService
from apps.kuaicrm.services.warranty_service import WarrantyService
from apps.kuaicrm.services.complaint_service import ComplaintService
from apps.kuaicrm.services.installation_service import InstallationService
from apps.kuaicrm.services.service_contract_service import ServiceContractService
from apps.kuaicrm.services.sales_funnel_service import SalesFunnelService
from apps.kuaicrm.services.lead_followup_service import LeadFollowUpService
from apps.kuaicrm.services.opportunity_followup_service import OpportunityFollowUpService

__all__ = [
    "LeadService",
    "OpportunityService",
    "SalesOrderService",
    "ServiceWorkOrderService",
    "WarrantyService",
    "ComplaintService",
    "InstallationService",
    "ServiceContractService",
    "SalesFunnelService",
    "LeadFollowUpService",
    "OpportunityFollowUpService",
]

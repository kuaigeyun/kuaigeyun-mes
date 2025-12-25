"""
CRM Schema 模块

定义CRM相关的Pydantic Schema，用于数据验证和序列化。
"""

from apps.kuaicrm.schemas.lead_schemas import (
    LeadCreate, LeadUpdate, LeadResponse
)
from apps.kuaicrm.schemas.opportunity_schemas import (
    OpportunityCreate, OpportunityUpdate, OpportunityResponse
)
from apps.kuaicrm.schemas.sales_order_schemas import (
    SalesOrderCreate, SalesOrderUpdate, SalesOrderResponse
)
from apps.kuaicrm.schemas.service_workorder_schemas import (
    ServiceWorkOrderCreate, ServiceWorkOrderUpdate, ServiceWorkOrderResponse
)
from apps.kuaicrm.schemas.warranty_schemas import (
    WarrantyCreate, WarrantyUpdate, WarrantyResponse
)
from apps.kuaicrm.schemas.complaint_schemas import (
    ComplaintCreate, ComplaintUpdate, ComplaintResponse
)
from apps.kuaicrm.schemas.installation_schemas import (
    InstallationCreate, InstallationUpdate, InstallationResponse
)
from apps.kuaicrm.schemas.service_contract_schemas import (
    ServiceContractCreate, ServiceContractUpdate, ServiceContractResponse
)
from apps.kuaicrm.schemas.lead_followup_schemas import (
    LeadFollowUpCreate, LeadFollowUpUpdate, LeadFollowUpResponse
)
from apps.kuaicrm.schemas.opportunity_followup_schemas import (
    OpportunityFollowUpCreate, OpportunityFollowUpUpdate, OpportunityFollowUpResponse
)

__all__ = [
    "LeadCreate", "LeadUpdate", "LeadResponse",
    "OpportunityCreate", "OpportunityUpdate", "OpportunityResponse",
    "SalesOrderCreate", "SalesOrderUpdate", "SalesOrderResponse",
    "ServiceWorkOrderCreate", "ServiceWorkOrderUpdate", "ServiceWorkOrderResponse",
    "WarrantyCreate", "WarrantyUpdate", "WarrantyResponse",
    "ComplaintCreate", "ComplaintUpdate", "ComplaintResponse",
    "InstallationCreate", "InstallationUpdate", "InstallationResponse",
    "ServiceContractCreate", "ServiceContractUpdate", "ServiceContractResponse",
    "LeadFollowUpCreate", "LeadFollowUpUpdate", "LeadFollowUpResponse",
    "OpportunityFollowUpCreate", "OpportunityFollowUpUpdate", "OpportunityFollowUpResponse",
]

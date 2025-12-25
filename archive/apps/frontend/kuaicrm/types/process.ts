/**
 * CRM 数据类型定义
 * 
 * 定义线索、商机、订单等的数据类型
 */

// ==================== 线索相关 ====================

export interface Lead {
  id: number;
  uuid: string;
  tenantId: number;
  name: string;
  company?: string;
  phone?: string;
  email?: string;
  source: string;
  status: string;
  score?: number;
  ownerId?: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface LeadCreate {
  name: string;
  company?: string;
  phone?: string;
  email?: string;
  source: string;
  status?: string;
  ownerId?: number;
  description?: string;
}

export interface LeadUpdate {
  name?: string;
  company?: string;
  phone?: string;
  email?: string;
  source?: string;
  status?: string;
  score?: number;
  ownerId?: number;
  description?: string;
}

export interface LeadListParams {
  skip?: number;
  limit?: number;
  status?: string;
  source?: string;
  ownerId?: number;
}

// ==================== 商机相关 ====================

export interface Opportunity {
  id: number;
  uuid: string;
  tenantId: number;
  name: string;
  customerId: number;
  leadId?: number;
  amount: number;
  stage: string;
  probability?: number;
  expectedCloseDate?: string;
  ownerId?: number;
  source?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface OpportunityCreate {
  name: string;
  customerId: number;
  leadId?: number;
  amount: number;
  stage: string;
  probability?: number;
  expectedCloseDate?: string;
  ownerId?: number;
  source?: string;
  description?: string;
}

export interface OpportunityUpdate {
  name?: string;
  customerId?: number;
  amount?: number;
  stage?: string;
  probability?: number;
  expectedCloseDate?: string;
  ownerId?: number;
  source?: string;
  description?: string;
}

export interface OpportunityListParams {
  skip?: number;
  limit?: number;
  stage?: string;
  ownerId?: number;
  customerId?: number;
}

// ==================== 销售订单相关 ====================

export interface SalesOrder {
  id: number;
  uuid: string;
  tenantId: number;
  orderNo: string;
  orderDate: string;
  customerId: number;
  opportunityId?: number;
  status: string;
  totalAmount: number;
  deliveryDate?: string;
  priority: string;
  approvalInstanceId?: number;
  approvalStatus?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface SalesOrderCreate {
  orderNo: string;
  orderDate: string;
  customerId: number;
  opportunityId?: number;
  status?: string;
  totalAmount: number;
  deliveryDate?: string;
  priority?: string;
}

export interface SalesOrderUpdate {
  status?: string;
  totalAmount?: number;
  deliveryDate?: string;
  priority?: string;
}

export interface SalesOrderListParams {
  skip?: number;
  limit?: number;
  status?: string;
  customerId?: number;
}

// ==================== 销售漏斗相关 ====================

export interface FunnelView {
  stages: FunnelStage[];
  totalLeads: number;
  totalOpportunities: number;
  totalAmount: number;
}

export interface FunnelStage {
  stage: string;
  count: number;
  amount: number;
  conversionRate: number;
}

export interface FunnelForecast {
  forecastAmount: number;
  forecastDate: string;
  confidence: number;
}

// ==================== 跟进记录相关 ====================

export interface LeadFollowUp {
  id: number;
  uuid: string;
  tenantId: number;
  leadId: number;
  followUpDate: string;
  followUpType: string;
  content: string;
  nextFollowUpDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeadFollowUpCreate {
  leadId: number;
  followUpDate: string;
  followUpType: string;
  content: string;
  nextFollowUpDate?: string;
}

export interface OpportunityFollowUp {
  id: number;
  uuid: string;
  tenantId: number;
  opportunityId: number;
  followUpDate: string;
  followUpType: string;
  content: string;
  nextFollowUpDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OpportunityFollowUpCreate {
  opportunityId: number;
  followUpDate: string;
  followUpType: string;
  content: string;
  nextFollowUpDate?: string;
}

// ==================== 审批相关 ====================

export interface ApprovalStatus {
  hasApproval: boolean;
  approvalStatus?: string;
  approvalInstance?: {
    uuid: string;
    title: string;
    status: string;
    currentNode?: string;
    currentApproverId?: number;
    submitterId: number;
    submittedAt?: string;
    completedAt?: string;
  };
  process?: {
    uuid: string;
    name: string;
    code: string;
  };
  histories?: Array<{
    action: string;
    action_by: number;
    action_at: string;
    comment?: string;
    from_node?: string;
    to_node?: string;
  }>;
}

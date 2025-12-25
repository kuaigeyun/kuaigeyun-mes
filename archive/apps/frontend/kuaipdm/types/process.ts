/**
 * PDM 数据类型定义
 * 
 * 定义设计变更、工程变更、设计评审、研发流程、知识管理等的数据类型
 */

// ==================== 设计变更相关 ====================

export interface DesignChange {
  id: number;
  uuid: string;
  tenantId: number;
  changeNo: string;
  changeType: string;
  changeReason: string;
  changeContent: string;
  changeScope?: string;
  priority: string;
  status: string;
  productId?: number;
  bomId?: number;
  approvalInstanceId?: number;
  approvalStatus?: string;
  executorId?: number;
  executionStartDate?: string;
  executionEndDate?: string;
  executionResult?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface DesignChangeCreate {
  changeNo: string;
  changeType: string;
  changeReason: string;
  changeContent: string;
  changeScope?: string;
  priority?: string;
  productId?: number;
  bomId?: number;
}

export interface DesignChangeUpdate {
  changeType?: string;
  changeReason?: string;
  changeContent?: string;
  changeScope?: string;
  priority?: string;
  status?: string;
  productId?: number;
  bomId?: number;
  executorId?: number;
  executionStartDate?: string;
  executionEndDate?: string;
  executionResult?: string;
}

// ==================== 工程变更相关 ====================

export interface EngineeringChange {
  id: number;
  uuid: string;
  tenantId: number;
  changeNo: string;
  changeType: string;
  changeReason: string;
  changeContent: string;
  changeImpact?: string;
  priority: string;
  status: string;
  productId?: number;
  approvalInstanceId?: number;
  approvalStatus?: string;
  executorId?: number;
  executionStartDate?: string;
  executionEndDate?: string;
  executionResult?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface EngineeringChangeCreate {
  changeNo: string;
  changeType: string;
  changeReason: string;
  changeContent: string;
  changeImpact?: string;
  priority?: string;
  productId?: number;
}

export interface EngineeringChangeUpdate {
  changeType?: string;
  changeReason?: string;
  changeContent?: string;
  changeImpact?: string;
  priority?: string;
  status?: string;
  productId?: number;
  executorId?: number;
  executionStartDate?: string;
  executionEndDate?: string;
  executionResult?: string;
}

// ==================== 设计评审相关 ====================

export interface DesignReview {
  id: number;
  uuid: string;
  tenantId: number;
  reviewNo: string;
  reviewType: string;
  reviewStage?: string;
  productId?: number;
  reviewDate?: string;
  status: string;
  conclusion?: string;
  reviewContent?: string;
  reviewResult?: string;
  reviewers?: Array<{ userId: number; role: string }>;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface DesignReviewCreate {
  reviewNo: string;
  reviewType: string;
  reviewStage?: string;
  productId?: number;
  reviewDate?: string;
  reviewContent?: string;
  reviewers?: Array<{ userId: number; role: string }>;
}

export interface DesignReviewUpdate {
  reviewType?: string;
  reviewStage?: string;
  productId?: number;
  reviewDate?: string;
  status?: string;
  conclusion?: string;
  reviewContent?: string;
  reviewResult?: string;
  reviewers?: Array<{ userId: number; role: string }>;
}

// ==================== 研发流程相关 ====================

export interface ResearchProcess {
  id: number;
  uuid: string;
  tenantId: number;
  processNo: string;
  processName: string;
  processType: string;
  processTemplate?: any;
  currentStage?: string;
  status: string;
  productId?: number;
  projectId?: number;
  ownerId?: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface ResearchProcessCreate {
  processNo: string;
  processName: string;
  processType: string;
  processTemplate?: any;
  productId?: number;
  projectId?: number;
  ownerId?: number;
}

export interface ResearchProcessUpdate {
  processName?: string;
  processType?: string;
  processTemplate?: any;
  currentStage?: string;
  status?: string;
  productId?: number;
  projectId?: number;
  ownerId?: number;
}

// ==================== 知识管理相关 ====================

export interface Knowledge {
  id: number;
  uuid: string;
  tenantId: number;
  knowledgeNo: string;
  knowledgeType: string;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  authorId: number;
  viewCount: number;
  likeCount: number;
  rating?: number;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface KnowledgeCreate {
  knowledgeNo: string;
  knowledgeType: string;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  isPublic?: boolean;
}

export interface KnowledgeUpdate {
  knowledgeType?: string;
  title?: string;
  content?: string;
  category?: string;
  tags?: string[];
  isPublic?: boolean;
}

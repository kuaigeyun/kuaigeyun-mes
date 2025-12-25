/**
 * PM数据类型定义
 * 
 * 定义项目管理的数据类型
 */

export interface Project {
  id: number;
  uuid: string;
  tenantId?: number;
  projectNo: string;
  projectName: string;
  projectType: string;
  projectCategory?: string;
  managerId: number;
  managerName: string;
  departmentId?: number;
  startDate?: string;
  endDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  budgetAmount?: number;
  actualAmount?: number;
  progress: number;
  status: string;
  priority: string;
  description?: string;
  approvalInstanceId?: number;
  approvalStatus?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectCreate {
  projectNo: string;
  projectName: string;
  projectType: string;
  projectCategory?: string;
  managerId: number;
  managerName: string;
  departmentId?: number;
  startDate?: string;
  endDate?: string;
  budgetAmount?: number;
  progress?: number;
  status?: string;
  priority?: string;
  description?: string;
}

export interface ProjectUpdate {
  projectName?: string;
  projectType?: string;
  status?: string;
  progress?: number;
  priority?: string;
  description?: string;
}

export interface ProjectListParams {
  skip?: number;
  limit?: number;
  projectType?: string;
  status?: string;
  managerId?: number;
}

export interface ProjectApplication {
  id: number;
  uuid: string;
  tenantId?: number;
  applicationNo: string;
  projectId?: number;
  applicantId: number;
  applicantName: string;
  applicationDate: string;
  applicationReason: string;
  expectedStartDate?: string;
  expectedEndDate?: string;
  expectedBudget?: number;
  status: string;
  approvalInstanceId?: number;
  approvalStatus?: string;
  approvalComment?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectApplicationCreate {
  applicationNo: string;
  projectId?: number;
  applicantId: number;
  applicantName: string;
  applicationDate: string;
  applicationReason: string;
  expectedStartDate?: string;
  expectedEndDate?: string;
  expectedBudget?: number;
  status?: string;
}

export interface ProjectApplicationUpdate {
  status?: string;
  approvalComment?: string;
}

export interface ProjectApplicationListParams {
  skip?: number;
  limit?: number;
  status?: string;
  applicantId?: number;
}

// 其他模型类型定义（简化版，可根据需要扩展）
export interface ProjectWBS {
  id: number;
  uuid: string;
  tenantId?: number;
  wbsCode: string;
  projectId: number;
  parentId?: number;
  wbsName: string;
  wbsLevel: number;
  wbsPath?: string;
  description?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  plannedDuration?: number;
  plannedCost?: number;
  weight?: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectWBSCreate {
  wbsCode: string;
  projectId: number;
  parentId?: number;
  wbsName: string;
  wbsLevel: number;
  status?: string;
}

export interface ProjectWBSUpdate {
  status?: string;
}

export interface ProjectWBSListParams {
  skip?: number;
  limit?: number;
  projectId?: number;
  status?: string;
}

export interface ProjectTask {
  id: number;
  uuid: string;
  tenantId?: number;
  taskNo: string;
  projectId: number;
  wbsId?: number;
  parentId?: number;
  taskName: string;
  taskType?: string;
  assigneeId?: number;
  assigneeName?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  plannedHours?: number;
  actualHours?: number;
  progress: number;
  status: string;
  priority: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectTaskCreate {
  taskNo: string;
  projectId: number;
  wbsId?: number;
  taskName: string;
  status?: string;
}

export interface ProjectTaskUpdate {
  status?: string;
}

export interface ProjectTaskListParams {
  skip?: number;
  limit?: number;
  projectId?: number;
  status?: string;
}

export interface ProjectResource {
  id: number;
  uuid: string;
  tenantId?: number;
  resourceNo: string;
  projectId: number;
  taskId?: number;
  resourceType: string;
  resourceId: number;
  resourceName: string;
  plannedQuantity?: number;
  actualQuantity?: number;
  plannedCost?: number;
  actualCost?: number;
  startDate?: string;
  endDate?: string;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectResourceCreate {
  resourceNo: string;
  projectId: number;
  resourceType: string;
  resourceId: number;
  resourceName: string;
  status?: string;
}

export interface ProjectResourceUpdate {
  status?: string;
}

export interface ProjectResourceListParams {
  skip?: number;
  limit?: number;
  projectId?: number;
  status?: string;
}

export interface ProjectProgress {
  id: number;
  uuid: string;
  tenantId?: number;
  progressNo: string;
  projectId: number;
  taskId?: number;
  progressDate: string;
  progressPercentage: number;
  completedWork?: number;
  remainingWork?: number;
  progressDescription?: string;
  reporterId: number;
  reporterName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectProgressCreate {
  progressNo: string;
  projectId: number;
  progressDate: string;
  progressPercentage: number;
  reporterId: number;
  reporterName: string;
  status?: string;
}

export interface ProjectProgressUpdate {
  status?: string;
}

export interface ProjectProgressListParams {
  skip?: number;
  limit?: number;
  projectId?: number;
  status?: string;
}

export interface ProjectCost {
  id: number;
  uuid: string;
  tenantId?: number;
  costNo: string;
  projectId: number;
  taskId?: number;
  costType: string;
  costDate: string;
  costAmount: number;
  costDescription?: string;
  costCategory?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectCostCreate {
  costNo: string;
  projectId: number;
  costType: string;
  costDate: string;
  costAmount: number;
  status?: string;
}

export interface ProjectCostUpdate {
  status?: string;
}

export interface ProjectCostListParams {
  skip?: number;
  limit?: number;
  projectId?: number;
  status?: string;
}

export interface ProjectRisk {
  id: number;
  uuid: string;
  tenantId?: number;
  riskNo: string;
  projectId: number;
  riskName: string;
  riskType: string;
  riskLevel: string;
  probability?: number;
  impact?: string;
  riskDescription?: string;
  riskSource?: string;
  identifiedBy: number;
  identifiedDate: string;
  mitigationPlan?: string;
  ownerId?: number;
  ownerName?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectRiskCreate {
  riskNo: string;
  projectId: number;
  riskName: string;
  riskType: string;
  riskLevel: string;
  identifiedBy: number;
  identifiedDate: string;
  status?: string;
}

export interface ProjectRiskUpdate {
  status?: string;
}

export interface ProjectRiskListParams {
  skip?: number;
  limit?: number;
  projectId?: number;
  status?: string;
}

export interface ProjectQuality {
  id: number;
  uuid: string;
  tenantId?: number;
  qualityNo: string;
  projectId: number;
  taskId?: number;
  qualityType: string;
  qualityDate: string;
  qualityStandard?: string;
  qualityResult?: string;
  qualityScore?: number;
  qualityDescription?: string;
  inspectorId: number;
  inspectorName: string;
  issueCount: number;
  resolvedCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectQualityCreate {
  qualityNo: string;
  projectId: number;
  qualityType: string;
  qualityDate: string;
  inspectorId: number;
  inspectorName: string;
  status?: string;
}

export interface ProjectQualityUpdate {
  status?: string;
}

export interface ProjectQualityListParams {
  skip?: number;
  limit?: number;
  projectId?: number;
  status?: string;
}


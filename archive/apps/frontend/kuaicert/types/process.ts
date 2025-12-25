/**
 * 认证数据类型定义
 * 
 * 定义企业认证与评审的数据类型
 */

// ==================== 认证类型管理相关 ====================

export interface CertificationType {
  id: number;
  uuid: string;
  tenantId?: number;
  typeCode: string;
  typeName: string;
  typeCategory: string;
  description?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CertificationTypeCreate {
  typeCode: string;
  typeName: string;
  typeCategory: string;
  description?: string;
  status?: string;
}

export interface CertificationTypeUpdate {
  status?: string;
}

export interface CertificationTypeListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

export interface CertificationStandard {
  id: number;
  uuid: string;
  tenantId?: number;
  standardNo: string;
  certificationTypeId?: number;
  standardName: string;
  standardVersion?: string;
  issueDate?: string;
  effectiveDate?: string;
  standardContent?: string;
  applicableScope?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CertificationStandardCreate {
  standardNo: string;
  certificationTypeId?: number;
  standardName: string;
  standardVersion?: string;
  issueDate?: string;
  effectiveDate?: string;
  status?: string;
}

export interface CertificationStandardUpdate {
  status?: string;
}

export interface CertificationStandardListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

export interface ScoringRule {
  id: number;
  uuid: string;
  tenantId?: number;
  ruleNo: string;
  certificationTypeId?: number;
  standardId?: number;
  ruleName: string;
  ruleType: string;
  scoringMethod?: string;
  maxScore?: number;
  passingScore?: number;
  ruleContent?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScoringRuleCreate {
  ruleNo: string;
  certificationTypeId?: number;
  standardId?: number;
  ruleName: string;
  ruleType: string;
  status?: string;
}

export interface ScoringRuleUpdate {
  status?: string;
}

export interface ScoringRuleListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

// ==================== 认证评估相关 ====================

export interface CertificationRequirement {
  id: number;
  uuid: string;
  tenantId?: number;
  requirementNo: string;
  certificationTypeId?: number;
  standardId?: number;
  requirementName: string;
  requirementType: string;
  requirementContent?: string;
  isRequired: boolean;
  weight?: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CertificationRequirementCreate {
  requirementNo: string;
  certificationTypeId?: number;
  standardId?: number;
  requirementName: string;
  requirementType: string;
  isRequired: boolean;
  status?: string;
}

export interface CertificationRequirementUpdate {
  status?: string;
}

export interface CertificationRequirementListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

export interface CurrentAssessment {
  id: number;
  uuid: string;
  tenantId?: number;
  assessmentNo: string;
  certificationTypeId?: number;
  assessmentDate: string;
  assessorId: number;
  assessorName: string;
  assessmentContent?: string;
  assessmentResult?: string;
  totalScore?: number;
  passingScore?: number;
  isPassed: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CurrentAssessmentCreate {
  assessmentNo: string;
  certificationTypeId?: number;
  assessmentDate: string;
  assessorId: number;
  assessorName: string;
  status?: string;
}

export interface CurrentAssessmentUpdate {
  status?: string;
}

export interface CurrentAssessmentListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

export interface SelfAssessment {
  id: number;
  uuid: string;
  tenantId?: number;
  assessmentNo: string;
  certificationTypeId?: number;
  requirementId?: number;
  assessmentDate: string;
  assessorId: number;
  assessorName: string;
  selfScore?: number;
  assessmentContent?: string;
  evidenceFiles?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface SelfAssessmentCreate {
  assessmentNo: string;
  certificationTypeId?: number;
  requirementId?: number;
  assessmentDate: string;
  assessorId: number;
  assessorName: string;
  status?: string;
}

export interface SelfAssessmentUpdate {
  status?: string;
}

export interface SelfAssessmentListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

export interface AssessmentReport {
  id: number;
  uuid: string;
  tenantId?: number;
  assessmentNo: string;
  certificationTypeId?: number;
  reportDate: string;
  reportTitle: string;
  reportContent?: string;
  totalScore?: number;
  passingScore?: number;
  isPassed: boolean;
  authorId: number;
  authorName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentReportCreate {
  assessmentNo: string;
  certificationTypeId?: number;
  reportDate: string;
  reportTitle: string;
  authorId: number;
  authorName: string;
  status?: string;
}

export interface AssessmentReportUpdate {
  status?: string;
}

export interface AssessmentReportListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

// ==================== 提升建议相关 ====================

export interface ImprovementSuggestion {
  id: number;
  uuid: string;
  tenantId?: number;
  suggestionNo: string;
  certificationTypeId?: number;
  assessmentId?: number;
  requirementId?: number;
  suggestionTitle: string;
  suggestionContent?: string;
  priority: string;
  proposerId: number;
  proposerName: string;
  proposeDate: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImprovementSuggestionCreate {
  suggestionNo: string;
  certificationTypeId?: number;
  assessmentId?: number;
  requirementId?: number;
  suggestionTitle: string;
  priority: string;
  proposerId: number;
  proposerName: string;
  proposeDate: string;
  status?: string;
}

export interface ImprovementSuggestionUpdate {
  status?: string;
}

export interface ImprovementSuggestionListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

export interface ImprovementPlan {
  id: number;
  uuid: string;
  tenantId?: number;
  planNo: string;
  suggestionId?: number;
  planName: string;
  planContent?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  ownerId?: number;
  ownerName?: string;
  progress: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImprovementPlanCreate {
  planNo: string;
  suggestionId?: number;
  planName: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  status?: string;
}

export interface ImprovementPlanUpdate {
  status?: string;
}

export interface ImprovementPlanListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

export interface BestPractice {
  id: number;
  uuid: string;
  tenantId?: number;
  practiceNo: string;
  certificationTypeId?: number;
  practiceTitle: string;
  practiceContent?: string;
  practiceCategory?: string;
  applicableScope?: string;
  contributorId?: number;
  contributorName?: string;
  contributeDate?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface BestPracticeCreate {
  practiceNo: string;
  certificationTypeId?: number;
  practiceTitle: string;
  practiceCategory?: string;
  status?: string;
}

export interface BestPracticeUpdate {
  status?: string;
}

export interface BestPracticeListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

// ==================== 认证管理相关 ====================

export interface CertificationApplication {
  id: number;
  uuid: string;
  tenantId?: number;
  applicationNo: string;
  certificationTypeId?: number;
  applicantId: number;
  applicantName: string;
  applicationDate: string;
  applicationReason?: string;
  expectedCertificationDate?: string;
  status: string;
  approvalInstanceId?: number;
  approvalStatus?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CertificationApplicationCreate {
  applicationNo: string;
  certificationTypeId?: number;
  applicantId: number;
  applicantName: string;
  applicationDate: string;
  status?: string;
}

export interface CertificationApplicationUpdate {
  status?: string;
}

export interface CertificationApplicationListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

export interface CertificationProgress {
  id: number;
  uuid: string;
  tenantId?: number;
  progressNo: string;
  applicationId?: number;
  progressDate: string;
  progressStage: string;
  progressDescription?: string;
  progressPercentage: number;
  nextStage?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CertificationProgressCreate {
  progressNo: string;
  applicationId?: number;
  progressDate: string;
  progressStage: string;
  progressPercentage: number;
  status?: string;
}

export interface CertificationProgressUpdate {
  status?: string;
}

export interface CertificationProgressListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

export interface CertificationCertificate {
  id: number;
  uuid: string;
  tenantId?: number;
  certificateNo: string;
  applicationId?: number;
  certificationTypeId?: number;
  certificateName: string;
  issueDate: string;
  expiryDate?: string;
  issueAuthority?: string;
  certificateNumber?: string;
  certificateFile?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CertificationCertificateCreate {
  certificateNo: string;
  applicationId?: number;
  certificationTypeId?: number;
  certificateName: string;
  issueDate: string;
  status?: string;
}

export interface CertificationCertificateUpdate {
  status?: string;
}

export interface CertificationCertificateListParams {
  skip?: number;
  limit?: number;
  status?: string;
}


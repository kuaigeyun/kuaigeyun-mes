/**
 * 认证数据 API 服务
 * 
 * 提供企业认证与评审的 API 调用方法
 */

import { api } from '@/services/api';
import type {
  CertificationType,
  CertificationTypeCreate,
  CertificationTypeUpdate,
  CertificationTypeListParams,
  CertificationStandard,
  CertificationStandardCreate,
  CertificationStandardUpdate,
  CertificationStandardListParams,
  ScoringRule,
  ScoringRuleCreate,
  ScoringRuleUpdate,
  ScoringRuleListParams,
  CertificationRequirement,
  CertificationRequirementCreate,
  CertificationRequirementUpdate,
  CertificationRequirementListParams,
  CurrentAssessment,
  CurrentAssessmentCreate,
  CurrentAssessmentUpdate,
  CurrentAssessmentListParams,
  SelfAssessment,
  SelfAssessmentCreate,
  SelfAssessmentUpdate,
  SelfAssessmentListParams,
  AssessmentReport,
  AssessmentReportCreate,
  AssessmentReportUpdate,
  AssessmentReportListParams,
  ImprovementSuggestion,
  ImprovementSuggestionCreate,
  ImprovementSuggestionUpdate,
  ImprovementSuggestionListParams,
  ImprovementPlan,
  ImprovementPlanCreate,
  ImprovementPlanUpdate,
  ImprovementPlanListParams,
  BestPractice,
  BestPracticeCreate,
  BestPracticeUpdate,
  BestPracticeListParams,
  CertificationApplication,
  CertificationApplicationCreate,
  CertificationApplicationUpdate,
  CertificationApplicationListParams,
  CertificationProgress,
  CertificationProgressCreate,
  CertificationProgressUpdate,
  CertificationProgressListParams,
  CertificationCertificate,
  CertificationCertificateCreate,
  CertificationCertificateUpdate,
  CertificationCertificateListParams,
} from '../types/process';

/**
 * 认证类型 API 服务
 */
export const certificationTypeApi = {
  create: async (data: CertificationTypeCreate): Promise<CertificationType> => {
    return api.post('/kuaicert/certification-types', data);
  },
  list: async (params?: CertificationTypeListParams): Promise<CertificationType[]> => {
    return api.get('/kuaicert/certification-types', { params });
  },
  get: async (uuid: string): Promise<CertificationType> => {
    return api.get(`/kuaicert/certification-types/${uuid}`);
  },
  update: async (uuid: string, data: CertificationTypeUpdate): Promise<CertificationType> => {
    return api.put(`/kuaicert/certification-types/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaicert/certification-types/${uuid}`);
  },
};

/**
 * 认证标准 API 服务
 */
export const certificationStandardApi = {
  create: async (data: CertificationStandardCreate): Promise<CertificationStandard> => {
    return api.post('/kuaicert/certification-standards', data);
  },
  list: async (params?: CertificationStandardListParams): Promise<CertificationStandard[]> => {
    return api.get('/kuaicert/certification-standards', { params });
  },
  get: async (uuid: string): Promise<CertificationStandard> => {
    return api.get(`/kuaicert/certification-standards/${uuid}`);
  },
  update: async (uuid: string, data: CertificationStandardUpdate): Promise<CertificationStandard> => {
    return api.put(`/kuaicert/certification-standards/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaicert/certification-standards/${uuid}`);
  },
};

/**
 * 评分规则 API 服务
 */
export const scoringRuleApi = {
  create: async (data: ScoringRuleCreate): Promise<ScoringRule> => {
    return api.post('/kuaicert/scoring-rules', data);
  },
  list: async (params?: ScoringRuleListParams): Promise<ScoringRule[]> => {
    return api.get('/kuaicert/scoring-rules', { params });
  },
  get: async (uuid: string): Promise<ScoringRule> => {
    return api.get(`/kuaicert/scoring-rules/${uuid}`);
  },
  update: async (uuid: string, data: ScoringRuleUpdate): Promise<ScoringRule> => {
    return api.put(`/kuaicert/scoring-rules/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaicert/scoring-rules/${uuid}`);
  },
};

/**
 * 认证要求 API 服务
 */
export const certificationRequirementApi = {
  create: async (data: CertificationRequirementCreate): Promise<CertificationRequirement> => {
    return api.post('/kuaicert/certification-requirements', data);
  },
  list: async (params?: CertificationRequirementListParams): Promise<CertificationRequirement[]> => {
    return api.get('/kuaicert/certification-requirements', { params });
  },
  get: async (uuid: string): Promise<CertificationRequirement> => {
    return api.get(`/kuaicert/certification-requirements/${uuid}`);
  },
  update: async (uuid: string, data: CertificationRequirementUpdate): Promise<CertificationRequirement> => {
    return api.put(`/kuaicert/certification-requirements/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaicert/certification-requirements/${uuid}`);
  },
};

/**
 * 现状评估 API 服务
 */
export const currentAssessmentApi = {
  create: async (data: CurrentAssessmentCreate): Promise<CurrentAssessment> => {
    return api.post('/kuaicert/current-assessments', data);
  },
  list: async (params?: CurrentAssessmentListParams): Promise<CurrentAssessment[]> => {
    return api.get('/kuaicert/current-assessments', { params });
  },
  get: async (uuid: string): Promise<CurrentAssessment> => {
    return api.get(`/kuaicert/current-assessments/${uuid}`);
  },
  update: async (uuid: string, data: CurrentAssessmentUpdate): Promise<CurrentAssessment> => {
    return api.put(`/kuaicert/current-assessments/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaicert/current-assessments/${uuid}`);
  },
};

/**
 * 自评打分 API 服务
 */
export const selfAssessmentApi = {
  create: async (data: SelfAssessmentCreate): Promise<SelfAssessment> => {
    return api.post('/kuaicert/self-assessments', data);
  },
  list: async (params?: SelfAssessmentListParams): Promise<SelfAssessment[]> => {
    return api.get('/kuaicert/self-assessments', { params });
  },
  get: async (uuid: string): Promise<SelfAssessment> => {
    return api.get(`/kuaicert/self-assessments/${uuid}`);
  },
  update: async (uuid: string, data: SelfAssessmentUpdate): Promise<SelfAssessment> => {
    return api.put(`/kuaicert/self-assessments/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaicert/self-assessments/${uuid}`);
  },
};

/**
 * 评估报告 API 服务
 */
export const assessmentReportApi = {
  create: async (data: AssessmentReportCreate): Promise<AssessmentReport> => {
    return api.post('/kuaicert/assessment-reports', data);
  },
  list: async (params?: AssessmentReportListParams): Promise<AssessmentReport[]> => {
    return api.get('/kuaicert/assessment-reports', { params });
  },
  get: async (uuid: string): Promise<AssessmentReport> => {
    return api.get(`/kuaicert/assessment-reports/${uuid}`);
  },
  update: async (uuid: string, data: AssessmentReportUpdate): Promise<AssessmentReport> => {
    return api.put(`/kuaicert/assessment-reports/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaicert/assessment-reports/${uuid}`);
  },
};

/**
 * 改进建议 API 服务
 */
export const improvementSuggestionApi = {
  create: async (data: ImprovementSuggestionCreate): Promise<ImprovementSuggestion> => {
    return api.post('/kuaicert/improvement-suggestions', data);
  },
  list: async (params?: ImprovementSuggestionListParams): Promise<ImprovementSuggestion[]> => {
    return api.get('/kuaicert/improvement-suggestions', { params });
  },
  get: async (uuid: string): Promise<ImprovementSuggestion> => {
    return api.get(`/kuaicert/improvement-suggestions/${uuid}`);
  },
  update: async (uuid: string, data: ImprovementSuggestionUpdate): Promise<ImprovementSuggestion> => {
    return api.put(`/kuaicert/improvement-suggestions/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaicert/improvement-suggestions/${uuid}`);
  },
};

/**
 * 改进计划 API 服务
 */
export const improvementPlanApi = {
  create: async (data: ImprovementPlanCreate): Promise<ImprovementPlan> => {
    return api.post('/kuaicert/improvement-plans', data);
  },
  list: async (params?: ImprovementPlanListParams): Promise<ImprovementPlan[]> => {
    return api.get('/kuaicert/improvement-plans', { params });
  },
  get: async (uuid: string): Promise<ImprovementPlan> => {
    return api.get(`/kuaicert/improvement-plans/${uuid}`);
  },
  update: async (uuid: string, data: ImprovementPlanUpdate): Promise<ImprovementPlan> => {
    return api.put(`/kuaicert/improvement-plans/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaicert/improvement-plans/${uuid}`);
  },
};

/**
 * 最佳实践 API 服务
 */
export const bestPracticeApi = {
  create: async (data: BestPracticeCreate): Promise<BestPractice> => {
    return api.post('/kuaicert/best-practices', data);
  },
  list: async (params?: BestPracticeListParams): Promise<BestPractice[]> => {
    return api.get('/kuaicert/best-practices', { params });
  },
  get: async (uuid: string): Promise<BestPractice> => {
    return api.get(`/kuaicert/best-practices/${uuid}`);
  },
  update: async (uuid: string, data: BestPracticeUpdate): Promise<BestPractice> => {
    return api.put(`/kuaicert/best-practices/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaicert/best-practices/${uuid}`);
  },
};

/**
 * 认证申请 API 服务
 */
export const certificationApplicationApi = {
  create: async (data: CertificationApplicationCreate): Promise<CertificationApplication> => {
    return api.post('/kuaicert/certification-applications', data);
  },
  list: async (params?: CertificationApplicationListParams): Promise<CertificationApplication[]> => {
    return api.get('/kuaicert/certification-applications', { params });
  },
  get: async (uuid: string): Promise<CertificationApplication> => {
    return api.get(`/kuaicert/certification-applications/${uuid}`);
  },
  update: async (uuid: string, data: CertificationApplicationUpdate): Promise<CertificationApplication> => {
    return api.put(`/kuaicert/certification-applications/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaicert/certification-applications/${uuid}`);
  },
};

/**
 * 认证进度 API 服务
 */
export const certificationProgressApi = {
  create: async (data: CertificationProgressCreate): Promise<CertificationProgress> => {
    return api.post('/kuaicert/certification-progresss', data);
  },
  list: async (params?: CertificationProgressListParams): Promise<CertificationProgress[]> => {
    return api.get('/kuaicert/certification-progresss', { params });
  },
  get: async (uuid: string): Promise<CertificationProgress> => {
    return api.get(`/kuaicert/certification-progresss/${uuid}`);
  },
  update: async (uuid: string, data: CertificationProgressUpdate): Promise<CertificationProgress> => {
    return api.put(`/kuaicert/certification-progresss/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaicert/certification-progresss/${uuid}`);
  },
};

/**
 * 认证证书 API 服务
 */
export const certificationCertificateApi = {
  create: async (data: CertificationCertificateCreate): Promise<CertificationCertificate> => {
    return api.post('/kuaicert/certification-certificates', data);
  },
  list: async (params?: CertificationCertificateListParams): Promise<CertificationCertificate[]> => {
    return api.get('/kuaicert/certification-certificates', { params });
  },
  get: async (uuid: string): Promise<CertificationCertificate> => {
    return api.get(`/kuaicert/certification-certificates/${uuid}`);
  },
  update: async (uuid: string, data: CertificationCertificateUpdate): Promise<CertificationCertificate> => {
    return api.put(`/kuaicert/certification-certificates/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaicert/certification-certificates/${uuid}`);
  },
};


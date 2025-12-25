/**
 * EHS数据类型定义
 * 
 * 定义环境健康安全管理的数据类型
 */

// ==================== 环境管理相关 ====================

export interface EnvironmentMonitoring {
  id: number;
  uuid: string;
  tenantId?: number;
  monitoringNo: string;
  monitoringPoint: string;
  monitoringType: string;
  monitoringDate: string;
  parameterName: string;
  parameterValue: number;
  unit: string;
  standardValue?: number;
  isCompliant: boolean;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EnvironmentMonitoringCreate {
  monitoringNo: string;
  monitoringPoint: string;
  monitoringType: string;
  monitoringDate: string;
  parameterName: string;
  parameterValue: number;
  unit: string;
  status?: string;
}

export interface EnvironmentMonitoringUpdate {
  status?: string;
}

export interface EnvironmentMonitoringListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

export interface EmissionManagement {
  id: number;
  uuid: string;
  tenantId?: number;
  emissionNo: string;
  emissionSource: string;
  emissionType: string;
  emissionDate: string;
  emissionAmount: number;
  unit: string;
  controlMeasure?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmissionManagementCreate {
  emissionNo: string;
  emissionSource: string;
  emissionType: string;
  emissionDate: string;
  emissionAmount: number;
  unit: string;
  status?: string;
}

export interface EmissionManagementUpdate {
  status?: string;
}

export interface EmissionManagementListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

export interface EnvironmentalCompliance {
  id: number;
  uuid: string;
  tenantId?: number;
  complianceNo: string;
  complianceType: string;
  checkDate: string;
  checkResult?: string;
  checkContent?: string;
  inspectorId: number;
  inspectorName: string;
  reportId?: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface EnvironmentalComplianceCreate {
  complianceNo: string;
  complianceType: string;
  checkDate: string;
  inspectorId: number;
  inspectorName: string;
  status?: string;
}

export interface EnvironmentalComplianceUpdate {
  status?: string;
}

export interface EnvironmentalComplianceListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

export interface EnvironmentalIncident {
  id: number;
  uuid: string;
  tenantId?: number;
  incidentNo: string;
  incidentType: string;
  incidentDate: string;
  incidentLocation: string;
  incidentDescription: string;
  impactScope?: string;
  severity: string;
  reporterId: number;
  reporterName: string;
  handlerId?: number;
  handlerName?: string;
  handlingMeasure?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface EnvironmentalIncidentCreate {
  incidentNo: string;
  incidentType: string;
  incidentDate: string;
  incidentLocation: string;
  incidentDescription: string;
  severity: string;
  reporterId: number;
  reporterName: string;
  status?: string;
}

export interface EnvironmentalIncidentUpdate {
  status?: string;
}

export interface EnvironmentalIncidentListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

// ==================== 健康管理相关 ====================

export interface OccupationalHealthCheck {
  id: number;
  uuid: string;
  tenantId?: number;
  checkNo: string;
  checkPlanId?: number;
  employeeId: number;
  employeeName: string;
  checkDate: string;
  checkType: string;
  checkItem: string;
  checkResult?: string;
  checkInstitution?: string;
  doctorName?: string;
  diagnosis?: string;
  suggestion?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface OccupationalHealthCheckCreate {
  checkNo: string;
  employeeId: number;
  employeeName: string;
  checkDate: string;
  checkType: string;
  checkItem: string;
  status?: string;
}

export interface OccupationalHealthCheckUpdate {
  status?: string;
}

export interface OccupationalHealthCheckListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

export interface OccupationalDisease {
  id: number;
  uuid: string;
  tenantId?: number;
  diseaseNo: string;
  employeeId: number;
  employeeName: string;
  diseaseName: string;
  diseaseType?: string;
  diagnosisDate: string;
  diagnosisInstitution?: string;
  diagnosisLevel?: string;
  treatmentStatus?: string;
  compensationStatus?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface OccupationalDiseaseCreate {
  diseaseNo: string;
  employeeId: number;
  employeeName: string;
  diseaseName: string;
  diagnosisDate: string;
  status?: string;
}

export interface OccupationalDiseaseUpdate {
  status?: string;
}

export interface OccupationalDiseaseListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

export interface HealthRecord {
  id: number;
  uuid: string;
  tenantId?: number;
  recordNo: string;
  employeeId: number;
  employeeName: string;
  recordType: string;
  recordDate: string;
  healthStatus?: string;
  healthLevel?: string;
  medicalHistory?: string;
  allergyHistory?: string;
  familyHistory?: string;
  currentMedication?: string;
  healthAdvice?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface HealthRecordCreate {
  recordNo: string;
  employeeId: number;
  employeeName: string;
  recordType: string;
  recordDate: string;
  status?: string;
}

export interface HealthRecordUpdate {
  status?: string;
}

export interface HealthRecordListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

// ==================== 安全管理相关 ====================

export interface SafetyTraining {
  id: number;
  uuid: string;
  tenantId?: number;
  trainingNo: string;
  trainingPlanId?: number;
  trainingName: string;
  trainingType: string;
  trainingDate: string;
  trainerId: number;
  trainerName: string;
  trainingContent?: string;
  trainingDuration?: number;
  participantCount: number;
  trainingResult?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface SafetyTrainingCreate {
  trainingNo: string;
  trainingName: string;
  trainingType: string;
  trainingDate: string;
  trainerId: number;
  trainerName: string;
  status?: string;
}

export interface SafetyTrainingUpdate {
  status?: string;
}

export interface SafetyTrainingListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

export interface SafetyInspection {
  id: number;
  uuid: string;
  tenantId?: number;
  inspectionNo: string;
  inspectionPlanId?: number;
  inspectionType: string;
  inspectionDate: string;
  inspectionLocation: string;
  inspectorId: number;
  inspectorName: string;
  inspectionContent?: string;
  inspectionResult?: string;
  issueCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface SafetyInspectionCreate {
  inspectionNo: string;
  inspectionType: string;
  inspectionDate: string;
  inspectionLocation: string;
  inspectorId: number;
  inspectorName: string;
  status?: string;
}

export interface SafetyInspectionUpdate {
  status?: string;
}

export interface SafetyInspectionListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

export interface SafetyHazard {
  id: number;
  uuid: string;
  tenantId?: number;
  hazardNo: string;
  hazardType: string;
  hazardLevel: string;
  hazardLocation: string;
  hazardDescription: string;
  reporterId: number;
  reporterName: string;
  reportDate: string;
  handlerId?: number;
  handlerName?: string;
  handlingMeasure?: string;
  handlingDate?: string;
  verificationDate?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface SafetyHazardCreate {
  hazardNo: string;
  hazardType: string;
  hazardLevel: string;
  hazardLocation: string;
  hazardDescription: string;
  reporterId: number;
  reporterName: string;
  reportDate: string;
  status?: string;
}

export interface SafetyHazardUpdate {
  status?: string;
}

export interface SafetyHazardListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

export interface SafetyIncident {
  id: number;
  uuid: string;
  tenantId?: number;
  incidentNo: string;
  incidentType: string;
  incidentDate: string;
  incidentLocation: string;
  incidentDescription: string;
  severity: string;
  casualtyCount: number;
  propertyLoss?: number;
  reporterId: number;
  reporterName: string;
  handlerId?: number;
  handlerName?: string;
  handlingMeasure?: string;
  rootCause?: string;
  preventiveMeasure?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface SafetyIncidentCreate {
  incidentNo: string;
  incidentType: string;
  incidentDate: string;
  incidentLocation: string;
  incidentDescription: string;
  severity: string;
  reporterId: number;
  reporterName: string;
  status?: string;
}

export interface SafetyIncidentUpdate {
  status?: string;
}

export interface SafetyIncidentListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

// ==================== 合规管理相关 ====================

export interface Regulation {
  id: number;
  uuid: string;
  tenantId?: number;
  regulationNo: string;
  regulationName: string;
  regulationType: string;
  issueAuthority?: string;
  issueDate?: string;
  effectiveDate?: string;
  expiryDate?: string;
  regulationContent?: string;
  applicableScope?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegulationCreate {
  regulationNo: string;
  regulationName: string;
  regulationType: string;
  status?: string;
}

export interface RegulationUpdate {
  status?: string;
}

export interface RegulationListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

export interface ComplianceCheck {
  id: number;
  uuid: string;
  tenantId?: number;
  checkNo: string;
  checkPlanId?: number;
  regulationId?: number;
  checkType: string;
  checkDate: string;
  checkContent?: string;
  checkResult?: string;
  issueDescription?: string;
  inspectorId: number;
  inspectorName: string;
  handlerId?: number;
  handlerName?: string;
  handlingMeasure?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ComplianceCheckCreate {
  checkNo: string;
  checkType: string;
  checkDate: string;
  inspectorId: number;
  inspectorName: string;
  status?: string;
}

export interface ComplianceCheckUpdate {
  status?: string;
}

export interface ComplianceCheckListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

export interface ComplianceReport {
  id: number;
  uuid: string;
  tenantId?: number;
  reportNo: string;
  reportType: string;
  reportPeriod?: string;
  reportDate: string;
  reportTitle: string;
  reportContent?: string;
  complianceRate?: number;
  issueCount: number;
  resolvedCount: number;
  authorId: number;
  authorName: string;
  reviewerId?: number;
  reviewerName?: string;
  approvalStatus?: string;
  publishDate?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ComplianceReportCreate {
  reportNo: string;
  reportType: string;
  reportDate: string;
  reportTitle: string;
  authorId: number;
  authorName: string;
  status?: string;
}

export interface ComplianceReportUpdate {
  status?: string;
}

export interface ComplianceReportListParams {
  skip?: number;
  limit?: number;
  status?: string;
}


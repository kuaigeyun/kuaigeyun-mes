/**
 * LIMS 数据类型定义
 * 
 * 定义样品管理、实验管理、数据管理、报告管理等的数据类型
 */

// ==================== 样品管理相关 ====================

export interface SampleManagement {
  id: number;
  uuid: string;
  tenantId?: number;
  sampleNo: string;
  sampleName: string;
  sampleType: string;
  sampleCategory?: string;
  sampleSource?: string;
  registrationDate?: string;
  registrationPersonId?: number;
  registrationPersonName?: string;
  sampleStatus: string;
  storageLocation?: string;
  storageCondition?: any;
  currentLocation?: string;
  transferRecords?: any;
  expiryDate?: string;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SampleManagementCreate {
  sampleNo: string;
  sampleName: string;
  sampleType: string;
  sampleCategory?: string;
  sampleSource?: string;
  registrationDate?: string;
  registrationPersonId?: number;
  registrationPersonName?: string;
  sampleStatus?: string;
  storageLocation?: string;
  storageCondition?: any;
  currentLocation?: string;
  transferRecords?: any;
  expiryDate?: string;
  status?: string;
  remark?: string;
}

export interface SampleManagementUpdate {
  sampleName?: string;
  sampleType?: string;
  sampleCategory?: string;
  sampleSource?: string;
  registrationDate?: string;
  registrationPersonId?: number;
  registrationPersonName?: string;
  sampleStatus?: string;
  storageLocation?: string;
  storageCondition?: any;
  currentLocation?: string;
  transferRecords?: any;
  expiryDate?: string;
  status?: string;
  remark?: string;
}

export interface SampleManagementListParams {
  skip?: number;
  limit?: number;
  sampleType?: string;
  sampleStatus?: string;
  status?: string;
}

// ==================== 实验管理相关 ====================

export interface ExperimentManagement {
  id: number;
  uuid: string;
  tenantId?: number;
  experimentNo: string;
  experimentName: string;
  experimentType: string;
  sampleId?: number;
  sampleUuid?: string;
  sampleNo?: string;
  planStartDate?: string;
  planEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  experimenterId?: number;
  experimenterName?: string;
  experimentStatus: string;
  executionRecords?: any;
  confirmationStatus: string;
  confirmationPersonId?: number;
  confirmationPersonName?: string;
  confirmationDate?: string;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExperimentManagementCreate {
  experimentNo: string;
  experimentName: string;
  experimentType: string;
  sampleId?: number;
  sampleUuid?: string;
  sampleNo?: string;
  planStartDate?: string;
  planEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  experimenterId?: number;
  experimenterName?: string;
  experimentStatus?: string;
  executionRecords?: any;
  confirmationStatus?: string;
  confirmationPersonId?: number;
  confirmationPersonName?: string;
  confirmationDate?: string;
  status?: string;
  remark?: string;
}

export interface ExperimentManagementUpdate {
  experimentName?: string;
  experimentType?: string;
  sampleId?: number;
  sampleUuid?: string;
  sampleNo?: string;
  planStartDate?: string;
  planEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  experimenterId?: number;
  experimenterName?: string;
  experimentStatus?: string;
  executionRecords?: any;
  confirmationStatus?: string;
  confirmationPersonId?: number;
  confirmationPersonName?: string;
  confirmationDate?: string;
  status?: string;
  remark?: string;
}

export interface ExperimentManagementListParams {
  skip?: number;
  limit?: number;
  experimentType?: string;
  experimentStatus?: string;
  confirmationStatus?: string;
}

// ==================== 数据管理相关 ====================

export interface DataManagement {
  id: number;
  uuid: string;
  tenantId?: number;
  dataNo: string;
  dataName: string;
  experimentId?: number;
  experimentUuid?: string;
  experimentNo?: string;
  dataType: string;
  dataContent?: any;
  entryPersonId?: number;
  entryPersonName?: string;
  entryDate?: string;
  validationStatus: string;
  validationResult?: string;
  auditStatus: string;
  auditPersonId?: number;
  auditPersonName?: string;
  auditDate?: string;
  auditRecords?: any;
  archiveStatus: string;
  archiveDate?: string;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DataManagementCreate {
  dataNo: string;
  dataName: string;
  experimentId?: number;
  experimentUuid?: string;
  experimentNo?: string;
  dataType: string;
  dataContent?: any;
  entryPersonId?: number;
  entryPersonName?: string;
  entryDate?: string;
  validationStatus?: string;
  validationResult?: string;
  auditStatus?: string;
  auditPersonId?: number;
  auditPersonName?: string;
  auditDate?: string;
  auditRecords?: any;
  archiveStatus?: string;
  archiveDate?: string;
  status?: string;
  remark?: string;
}

export interface DataManagementUpdate {
  dataName?: string;
  experimentId?: number;
  experimentUuid?: string;
  experimentNo?: string;
  dataType?: string;
  dataContent?: any;
  entryPersonId?: number;
  entryPersonName?: string;
  entryDate?: string;
  validationStatus?: string;
  validationResult?: string;
  auditStatus?: string;
  auditPersonId?: number;
  auditPersonName?: string;
  auditDate?: string;
  auditRecords?: any;
  archiveStatus?: string;
  archiveDate?: string;
  status?: string;
  remark?: string;
}

export interface DataManagementListParams {
  skip?: number;
  limit?: number;
  dataType?: string;
  validationStatus?: string;
  auditStatus?: string;
}

// ==================== 报告管理相关 ====================

export interface ReportManagement {
  id: number;
  uuid: string;
  tenantId?: number;
  reportNo: string;
  reportName: string;
  experimentId?: number;
  experimentUuid?: string;
  experimentNo?: string;
  reportTemplate?: string;
  reportContent?: string;
  generationMethod: string;
  generationDate?: string;
  auditStatus: string;
  auditPersonId?: number;
  auditPersonName?: string;
  auditDate?: string;
  auditRecords?: any;
  publishStatus: string;
  publishDate?: string;
  publishRecords?: any;
  status: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReportManagementCreate {
  reportNo: string;
  reportName: string;
  experimentId?: number;
  experimentUuid?: string;
  experimentNo?: string;
  reportTemplate?: string;
  reportContent?: string;
  generationMethod?: string;
  generationDate?: string;
  auditStatus?: string;
  auditPersonId?: number;
  auditPersonName?: string;
  auditDate?: string;
  auditRecords?: any;
  publishStatus?: string;
  publishDate?: string;
  publishRecords?: any;
  status?: string;
  remark?: string;
}

export interface ReportManagementUpdate {
  reportName?: string;
  experimentId?: number;
  experimentUuid?: string;
  experimentNo?: string;
  reportTemplate?: string;
  reportContent?: string;
  generationMethod?: string;
  generationDate?: string;
  auditStatus?: string;
  auditPersonId?: number;
  auditPersonName?: string;
  auditDate?: string;
  auditRecords?: any;
  publishStatus?: string;
  publishDate?: string;
  publishRecords?: any;
  status?: string;
  remark?: string;
}

export interface ReportManagementListParams {
  skip?: number;
  limit?: number;
  auditStatus?: string;
  publishStatus?: string;
  status?: string;
}


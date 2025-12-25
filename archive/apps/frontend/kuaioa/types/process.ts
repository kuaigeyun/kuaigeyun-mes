/**
 * OA数据类型定义
 * 
 * 定义协同办公的数据类型
 */

// ==================== 流程审批相关 ====================

export interface ApprovalProcess {
  id: number;
  uuid: string;
  tenantId?: number;
  processNo: string;
  processName: string;
  processType: string;
  processConfig?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalProcessCreate {
  processNo: string;
  processName: string;
  processType: string;
  status?: string;
}

export interface ApprovalProcessUpdate {
  status?: string;
}

export interface ApprovalProcessListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

export interface ApprovalInstance {
  id: number;
  uuid: string;
  tenantId?: number;
  instanceNo: string;
  processId?: number;
  businessType?: string;
  businessId?: number;
  applicantId: number;
  applicantName: string;
  applicationDate: string;
  currentNodeId?: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalInstanceCreate {
  instanceNo: string;
  processId?: number;
  businessType?: string;
  businessId?: number;
  applicantId: number;
  applicantName: string;
  applicationDate: string;
  status?: string;
}

export interface ApprovalInstanceUpdate {
  status?: string;
}

export interface ApprovalInstanceListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

export interface ApprovalNode {
  id: number;
  uuid: string;
  tenantId?: number;
  nodeNo: string;
  processId?: number;
  nodeName: string;
  nodeType: string;
  approverId?: number;
  approverName?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalNodeCreate {
  nodeNo: string;
  processId?: number;
  nodeName: string;
  nodeType: string;
  status?: string;
}

export interface ApprovalNodeUpdate {
  status?: string;
}

export interface ApprovalNodeListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

// ==================== 文档管理相关 ====================

export interface Document {
  id: number;
  uuid: string;
  tenantId?: number;
  documentNo: string;
  documentName: string;
  documentType: string;
  documentCategory?: string;
  filePath?: string;
  fileSize?: number;
  fileType?: string;
  tags?: string;
  description?: string;
  authorId: number;
  authorName: string;
  currentVersion?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentCreate {
  documentNo: string;
  documentName: string;
  documentType: string;
  authorId: number;
  authorName: string;
  status?: string;
}

export interface DocumentUpdate {
  status?: string;
}

export interface DocumentListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

export interface DocumentVersion {
  id: number;
  uuid: string;
  tenantId?: number;
  versionNo: string;
  documentId?: number;
  versionNumber: string;
  versionDescription?: string;
  filePath?: string;
  fileSize?: number;
  creatorId: number;
  creatorName: string;
  createDate: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentVersionCreate {
  versionNo: string;
  documentId?: number;
  versionNumber: string;
  creatorId: number;
  creatorName: string;
  createDate: string;
  status?: string;
}

export interface DocumentVersionUpdate {
  status?: string;
}

export interface DocumentVersionListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

// ==================== 会议管理相关 ====================

export interface Meeting {
  id: number;
  uuid: string;
  tenantId?: number;
  meetingNo: string;
  meetingName: string;
  meetingType: string;
  meetingDate?: string;
  startTime?: string;
  endTime?: string;
  meetingLocation?: string;
  organizerId: number;
  organizerName: string;
  participantCount: number;
  resourceId?: number;
  reminderTime?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingCreate {
  meetingNo: string;
  meetingName: string;
  meetingType: string;
  organizerId: number;
  organizerName: string;
  status?: string;
}

export interface MeetingUpdate {
  status?: string;
}

export interface MeetingListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

export interface MeetingMinutes {
  id: number;
  uuid: string;
  tenantId?: number;
  minutesNo: string;
  meetingId?: number;
  minutesTitle: string;
  minutesContent?: string;
  recorderId: number;
  recorderName: string;
  recordDate: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingMinutesCreate {
  minutesNo: string;
  meetingId?: number;
  minutesTitle: string;
  recorderId: number;
  recorderName: string;
  recordDate: string;
  status?: string;
}

export interface MeetingMinutesUpdate {
  status?: string;
}

export interface MeetingMinutesListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

export interface MeetingResource {
  id: number;
  uuid: string;
  tenantId?: number;
  resourceNo: string;
  meetingId?: number;
  resourceType: string;
  resourceName: string;
  resourceLocation?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingResourceCreate {
  resourceNo: string;
  meetingId?: number;
  resourceType: string;
  resourceName: string;
  status?: string;
}

export interface MeetingResourceUpdate {
  status?: string;
}

export interface MeetingResourceListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

// ==================== 公告通知相关 ====================

export interface Notice {
  id: number;
  uuid: string;
  tenantId?: number;
  noticeNo: string;
  noticeTitle: string;
  noticeType: string;
  noticeContent?: string;
  publishDate?: string;
  expiryDate?: string;
  priority: string;
  publisherId: number;
  publisherName: string;
  reviewerId?: number;
  reviewerName?: string;
  approvalStatus?: string;
  viewCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface NoticeCreate {
  noticeNo: string;
  noticeTitle: string;
  noticeType: string;
  priority: string;
  publisherId: number;
  publisherName: string;
  status?: string;
}

export interface NoticeUpdate {
  status?: string;
}

export interface NoticeListParams {
  skip?: number;
  limit?: number;
  status?: string;
}

export interface Notification {
  id: number;
  uuid: string;
  tenantId?: number;
  notificationNo: string;
  notificationTitle: string;
  notificationType: string;
  notificationContent?: string;
  recipientId: number;
  recipientName: string;
  sendDate: string;
  readDate?: string;
  isRead: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationCreate {
  notificationNo: string;
  notificationTitle: string;
  notificationType: string;
  recipientId: number;
  recipientName: string;
  sendDate: string;
  status?: string;
}

export interface NotificationUpdate {
  status?: string;
}

export interface NotificationListParams {
  skip?: number;
  limit?: number;
  status?: string;
}


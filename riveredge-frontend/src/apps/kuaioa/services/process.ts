/**
 * OA数据 API 服务
 * 
 * 提供协同办公的 API 调用方法
 */

import { api } from '@/services/api';
import type {
  ApprovalProcess,
  ApprovalProcessCreate,
  ApprovalProcessUpdate,
  ApprovalProcessListParams,
  ApprovalInstance,
  ApprovalInstanceCreate,
  ApprovalInstanceUpdate,
  ApprovalInstanceListParams,
  ApprovalNode,
  ApprovalNodeCreate,
  ApprovalNodeUpdate,
  ApprovalNodeListParams,
  Document,
  DocumentCreate,
  DocumentUpdate,
  DocumentListParams,
  DocumentVersion,
  DocumentVersionCreate,
  DocumentVersionUpdate,
  DocumentVersionListParams,
  Meeting,
  MeetingCreate,
  MeetingUpdate,
  MeetingListParams,
  MeetingMinutes,
  MeetingMinutesCreate,
  MeetingMinutesUpdate,
  MeetingMinutesListParams,
  MeetingResource,
  MeetingResourceCreate,
  MeetingResourceUpdate,
  MeetingResourceListParams,
  Notice,
  NoticeCreate,
  NoticeUpdate,
  NoticeListParams,
  Notification,
  NotificationCreate,
  NotificationUpdate,
  NotificationListParams,
} from '../types/process';

/**
 * 审批流程 API 服务
 */
export const approvalProcessApi = {
  create: async (data: ApprovalProcessCreate): Promise<ApprovalProcess> => {
    return api.post('/kuaioa/approval-processs', data);
  },
  list: async (params?: ApprovalProcessListParams): Promise<ApprovalProcess[]> => {
    return api.get('/kuaioa/approval-processs', { params });
  },
  get: async (uuid: string): Promise<ApprovalProcess> => {
    return api.get(`/kuaioa/approval-processs/${uuid}`);
  },
  update: async (uuid: string, data: ApprovalProcessUpdate): Promise<ApprovalProcess> => {
    return api.put(`/kuaioa/approval-processs/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaioa/approval-processs/${uuid}`);
  },
};

/**
 * 审批实例 API 服务
 */
export const approvalInstanceApi = {
  create: async (data: ApprovalInstanceCreate): Promise<ApprovalInstance> => {
    return api.post('/kuaioa/approval-instances', data);
  },
  list: async (params?: ApprovalInstanceListParams): Promise<ApprovalInstance[]> => {
    return api.get('/kuaioa/approval-instances', { params });
  },
  get: async (uuid: string): Promise<ApprovalInstance> => {
    return api.get(`/kuaioa/approval-instances/${uuid}`);
  },
  update: async (uuid: string, data: ApprovalInstanceUpdate): Promise<ApprovalInstance> => {
    return api.put(`/kuaioa/approval-instances/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaioa/approval-instances/${uuid}`);
  },
};

/**
 * 审批节点 API 服务
 */
export const approvalNodeApi = {
  create: async (data: ApprovalNodeCreate): Promise<ApprovalNode> => {
    return api.post('/kuaioa/approval-nodes', data);
  },
  list: async (params?: ApprovalNodeListParams): Promise<ApprovalNode[]> => {
    return api.get('/kuaioa/approval-nodes', { params });
  },
  get: async (uuid: string): Promise<ApprovalNode> => {
    return api.get(`/kuaioa/approval-nodes/${uuid}`);
  },
  update: async (uuid: string, data: ApprovalNodeUpdate): Promise<ApprovalNode> => {
    return api.put(`/kuaioa/approval-nodes/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaioa/approval-nodes/${uuid}`);
  },
};

/**
 * 文档 API 服务
 */
export const documentApi = {
  create: async (data: DocumentCreate): Promise<Document> => {
    return api.post('/kuaioa/documents', data);
  },
  list: async (params?: DocumentListParams): Promise<Document[]> => {
    return api.get('/kuaioa/documents', { params });
  },
  get: async (uuid: string): Promise<Document> => {
    return api.get(`/kuaioa/documents/${uuid}`);
  },
  update: async (uuid: string, data: DocumentUpdate): Promise<Document> => {
    return api.put(`/kuaioa/documents/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaioa/documents/${uuid}`);
  },
};

/**
 * 文档版本 API 服务
 */
export const documentVersionApi = {
  create: async (data: DocumentVersionCreate): Promise<DocumentVersion> => {
    return api.post('/kuaioa/document-versions', data);
  },
  list: async (params?: DocumentVersionListParams): Promise<DocumentVersion[]> => {
    return api.get('/kuaioa/document-versions', { params });
  },
  get: async (uuid: string): Promise<DocumentVersion> => {
    return api.get(`/kuaioa/document-versions/${uuid}`);
  },
  update: async (uuid: string, data: DocumentVersionUpdate): Promise<DocumentVersion> => {
    return api.put(`/kuaioa/document-versions/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaioa/document-versions/${uuid}`);
  },
};

/**
 * 会议 API 服务
 */
export const meetingApi = {
  create: async (data: MeetingCreate): Promise<Meeting> => {
    return api.post('/kuaioa/meetings', data);
  },
  list: async (params?: MeetingListParams): Promise<Meeting[]> => {
    return api.get('/kuaioa/meetings', { params });
  },
  get: async (uuid: string): Promise<Meeting> => {
    return api.get(`/kuaioa/meetings/${uuid}`);
  },
  update: async (uuid: string, data: MeetingUpdate): Promise<Meeting> => {
    return api.put(`/kuaioa/meetings/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaioa/meetings/${uuid}`);
  },
};

/**
 * 会议纪要 API 服务
 */
export const meetingMinutesApi = {
  create: async (data: MeetingMinutesCreate): Promise<MeetingMinutes> => {
    return api.post('/kuaioa/meeting-minutess', data);
  },
  list: async (params?: MeetingMinutesListParams): Promise<MeetingMinutes[]> => {
    return api.get('/kuaioa/meeting-minutess', { params });
  },
  get: async (uuid: string): Promise<MeetingMinutes> => {
    return api.get(`/kuaioa/meeting-minutess/${uuid}`);
  },
  update: async (uuid: string, data: MeetingMinutesUpdate): Promise<MeetingMinutes> => {
    return api.put(`/kuaioa/meeting-minutess/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaioa/meeting-minutess/${uuid}`);
  },
};

/**
 * 会议资源 API 服务
 */
export const meetingResourceApi = {
  create: async (data: MeetingResourceCreate): Promise<MeetingResource> => {
    return api.post('/kuaioa/meeting-resources', data);
  },
  list: async (params?: MeetingResourceListParams): Promise<MeetingResource[]> => {
    return api.get('/kuaioa/meeting-resources', { params });
  },
  get: async (uuid: string): Promise<MeetingResource> => {
    return api.get(`/kuaioa/meeting-resources/${uuid}`);
  },
  update: async (uuid: string, data: MeetingResourceUpdate): Promise<MeetingResource> => {
    return api.put(`/kuaioa/meeting-resources/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaioa/meeting-resources/${uuid}`);
  },
};

/**
 * 公告 API 服务
 */
export const noticeApi = {
  create: async (data: NoticeCreate): Promise<Notice> => {
    return api.post('/kuaioa/notices', data);
  },
  list: async (params?: NoticeListParams): Promise<Notice[]> => {
    return api.get('/kuaioa/notices', { params });
  },
  get: async (uuid: string): Promise<Notice> => {
    return api.get(`/kuaioa/notices/${uuid}`);
  },
  update: async (uuid: string, data: NoticeUpdate): Promise<Notice> => {
    return api.put(`/kuaioa/notices/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaioa/notices/${uuid}`);
  },
};

/**
 * 通知 API 服务
 */
export const notificationApi = {
  create: async (data: NotificationCreate): Promise<Notification> => {
    return api.post('/kuaioa/notifications', data);
  },
  list: async (params?: NotificationListParams): Promise<Notification[]> => {
    return api.get('/kuaioa/notifications', { params });
  },
  get: async (uuid: string): Promise<Notification> => {
    return api.get(`/kuaioa/notifications/${uuid}`);
  },
  update: async (uuid: string, data: NotificationUpdate): Promise<Notification> => {
    return api.put(`/kuaioa/notifications/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaioa/notifications/${uuid}`);
  },
};


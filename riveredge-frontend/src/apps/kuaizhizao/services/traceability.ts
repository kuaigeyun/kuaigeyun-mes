/**
 * 追溯管理 API
 */

import { api } from '../../../services/api';

export type TraceDirection = 'forward' | 'backward' | 'both';

function parseDownloadFilename(contentDisposition: string, fallback: string): string {
  const rfc5987 = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (rfc5987?.[1]) {
    try {
      return decodeURIComponent(rfc5987[1]);
    } catch {
      return fallback;
    }
  }
  const quoted = contentDisposition.match(/filename="([^"]+)"/i);
  if (quoted?.[1]) return quoted[1];
  const plain = contentDisposition.match(/filename=([^;]+)/i);
  if (plain?.[1]) return plain[1].trim().replace(/^"|"$/g, '');
  return fallback;
}

export interface TraceAnchor {
  identifierType: 'serial' | 'batch' | 'work_order';
  code: string;
  materialId?: number;
  materialCode?: string;
  materialName?: string;
  materialModel?: string;
  status?: string;
  inboundDate?: string;
  serialUuid?: string;
  batchUuid?: string;
  workOrderId?: number;
}

export interface TraceEvent {
  eventId: string;
  eventTime?: string;
  bizStep: string;
  documentType: string;
  documentCode: string;
  documentId?: number;
  materialCode?: string;
  materialName?: string;
  quantity?: number | string;
  location?: string;
  operator?: string;
  remark?: string;
  sourceTable?: string;
  qualityStatus?: string;
}

export interface TraceNode {
  id: string;
  label: string;
  type: string;
  data?: Record<string, unknown>;
}

export interface TraceEdge {
  source: string;
  target: string;
  label?: string;
}

export interface TraceSummary {
  eventCount: number;
  nodeCount: number;
  edgeCount: number;
  timeFrom?: string;
  timeTo?: string;
  direction: TraceDirection;
}

export interface TraceProfile {
  anchor: TraceAnchor;
  summary: TraceSummary;
  events: TraceEvent[];
  nodes: TraceNode[];
  edges: TraceEdge[];
}

export const traceabilityApi = {
  getProfile: async (code: string, direction: TraceDirection = 'both'): Promise<TraceProfile> => {
    return api.get('/apps/kuaizhizao/traceability/profile', {
      params: { code, direction },
    });
  },

  downloadReport: async (code: string, direction: TraceDirection = 'both'): Promise<void> => {
    const token = localStorage.getItem('token');
    const tenantId = localStorage.getItem('tenant_id');
    const params = new URLSearchParams({ code, direction, format: 'pdf' });
    const response = await fetch(`/api/v1/apps/kuaizhizao/traceability/report?${params.toString()}`, {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}),
      },
      cache: 'no-store',
    });
    if (!response.ok) {
      const text = await response.text();
      let message = text;
      try {
        const parsed = JSON.parse(text);
        message = parsed.detail || parsed.message || text;
      } catch {
        /* keep text */
      }
      throw new Error(typeof message === 'string' ? message : '导出追溯报告失败');
    }
    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') || '';
    const filename = parseDownloadFilename(disposition, `追溯报告_${code}.pdf`);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};

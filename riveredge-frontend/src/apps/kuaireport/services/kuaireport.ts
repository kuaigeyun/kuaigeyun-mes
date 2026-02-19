import { apiRequest } from '../../../services/api';

/**
 * 报表相关 API
 */
export async function getReports(params: any) {
    return apiRequest('/apps/kuaireport/reports', {
        method: 'GET',
        params,
    });
}

export async function getReport(id: string | number) {
    return apiRequest(`/apps/kuaireport/reports/${id}`, {
        method: 'GET',
    });
}

export async function createReport(data: any) {
    return apiRequest('/apps/kuaireport/reports', {
        method: 'POST',
        data,
    });
}

export async function updateReport(id: string | number, data: any) {
    return apiRequest(`/apps/kuaireport/reports/${id}`, {
        method: 'PUT',
        data,
    });
}

export async function deleteReport(id: string | number) {
    return apiRequest(`/apps/kuaireport/reports/${id}`, {
        method: 'DELETE',
    });
}

/** 获取系统报表列表 */
export async function getSystemReports(params?: { skip?: number; limit?: number }) {
    return apiRequest<{ data: any[]; total: number; success: boolean }>('/apps/kuaireport/reports/system', {
        method: 'GET',
        params: { skip: params?.skip ?? 0, limit: params?.limit ?? 50 },
    });
}

/** 获取我的报表列表 */
export async function getMyReports(params?: { skip?: number; limit?: number }) {
    return apiRequest<{ data: any[]; total: number; success: boolean }>('/apps/kuaireport/reports/my', {
        method: 'GET',
        params: { skip: params?.skip ?? 0, limit: params?.limit ?? 50 },
    });
}

/** 执行报表查询，返回数据 */
export async function executeReport(id: string | number, filters: any = {}) {
    return apiRequest<{ data: any[]; total?: number; success: boolean }>(`/apps/kuaireport/reports/${id}/execute`, {
        method: 'POST',
        data: filters,
    });
}

/** @deprecated 使用 executeReport */
export async function queryReportData(id: string | number, filters: any = {}) {
    return executeReport(id, filters);
}

export async function previewReportData(datasource: any, filters: any = {}) {
    return apiRequest('/apps/kuaireport/reports/preview', {
        method: 'POST',
        data: {
            datasource,
            filters
        },
    });
}

/** 生成报表分享链接 */
export async function shareReport(id: number, expiresDays = 30) {
    return apiRequest<{ share_token: string; share_expires_at?: string; is_shared: boolean }>(`/apps/kuaireport/reports/${id}/share`, {
        method: 'POST',
        data: { expires_days: expiresDays },
    });
}

/** 取消报表分享 */
export async function unshareReport(id: number) {
    return apiRequest(`/apps/kuaireport/reports/${id}/unshare`, { method: 'POST' });
}

/** 将报表挂载到菜单 */
export async function mountReportToMenu(id: number, menuName?: string, parentUuid?: string) {
    return apiRequest<{ success: boolean; menu: any }>(`/apps/kuaireport/reports/${id}/mount-to-menu`, {
        method: 'POST',
        data: { menu_name: menuName, parent_uuid: parentUuid },
    });
}

/** 通过分享令牌获取报表（公开） */
export async function getReportByShareToken(token: string) {
    return apiRequest(`/apps/kuaireport/reports/shared?token=${encodeURIComponent(token)}`, { method: 'GET' });
}

/** 通过分享令牌执行报表查询（公开） */
export async function executeReportByShareToken(token: string, filters: any = {}) {
    return apiRequest(`/apps/kuaireport/reports/shared/execute?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        data: filters,
    });
}

/**
 * 看板相关 API
 */
export async function getDashboards(params: any) {
    return apiRequest('/apps/kuaireport/dashboards', {
        method: 'GET',
        params,
    });
}

export async function getDashboard(id: string | number) {
    return apiRequest(`/apps/kuaireport/dashboards/${id}`, {
        method: 'GET',
    });
}

export async function createDashboard(data: any) {
    return apiRequest('/apps/kuaireport/dashboards', {
        method: 'POST',
        data,
    });
}

export async function updateDashboard(id: string | number, data: any) {
    return apiRequest(`/apps/kuaireport/dashboards/${id}`, {
        method: 'PUT',
        data,
    });
}

/** 生成大屏分享链接 */
export async function shareDashboard(id: number, expiresDays = 30) {
    return apiRequest<{ share_token: string; share_expires_at?: string; is_shared: boolean }>(`/apps/kuaireport/dashboards/${id}/share`, {
        method: 'POST',
        data: { expires_days: expiresDays },
    });
}

/** 取消大屏分享 */
export async function unshareDashboard(id: number) {
    return apiRequest(`/apps/kuaireport/dashboards/${id}/unshare`, { method: 'POST' });
}

/** 将大屏挂载到菜单 */
export async function mountDashboardToMenu(id: number, menuName?: string, parentUuid?: string) {
    return apiRequest<{ success: boolean; menu: any }>(`/apps/kuaireport/dashboards/${id}/mount-to-menu`, {
        method: 'POST',
        data: { menu_name: menuName, parent_uuid: parentUuid },
    });
}

/** 通过分享令牌获取大屏（公开） */
export async function getDashboardByShareToken(token: string) {
    return apiRequest(`/apps/kuaireport/dashboards/shared?token=${encodeURIComponent(token)}`, { method: 'GET' });
}

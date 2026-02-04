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
export async function queryReportData(id: string | number, filters: any = {}) {
    return apiRequest(`/apps/kuaireport/reports/${id}/query`, {
        method: 'POST',
        data: filters,
    });
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

export type ReportType = 'univer' | 'jimu';

export interface Report {
    id: number;
    uuid: string;
    code: string;
    name: string;
    report_type: ReportType;
    content?: any; // For Univer
    template_config?: any; // For JimuReport
    status: string;
    description?: string;
    tenant_id: number;
    created_at: string;
    updated_at: string;
}

export interface ReportListItem {
    id: number;
    uuid: string;
    code: string;
    name: string;
    report_type: ReportType;
    status: string;
    created_at: string;
}

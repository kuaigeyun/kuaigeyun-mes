export type WidgetType = 'chart' | 'decoration' | 'border' | 'text' | 'indicator' | 'media';

export interface WidgetConfig {
    id: string;
    type: WidgetType;
    subType: string; // e.g. 'line', 'pie', 'decoration-1', 'border-1'
    title?: string;
    props?: any; // Specific props for the widget
    data?: any[]; // Static data or data source binding info
    value?: number;
    unit?: string;
    content?: string;
    url?: string;
}

export interface DashboardLayout {
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface DashboardConfig {
    name: string;
    layout: DashboardLayout[];
    widgets: Record<string, WidgetConfig>;
    theme?: any;
}

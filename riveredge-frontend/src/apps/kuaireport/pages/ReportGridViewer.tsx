import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { PageContainer, ProTable, ProColumns } from '@ant-design/pro-components';
import { Button, message } from 'antd';
import { ArrowLeftOutlined, ExportOutlined, ReloadOutlined } from '@ant-design/icons';
import { getReport, queryReportData } from '../services/kuaireport';

const ReportGridViewer: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const id = searchParams.get('id');

    const [report, setReport] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [columns, setColumns] = useState<ProColumns[]>([]);

    useEffect(() => {
        if (id) {
            loadReportConfig();
        }
    }, [id]);

    const loadReportConfig = async () => {
        setLoading(true);
        try {
            const res = await getReport(id!);
            if (res) {
                setReport(res);
                // 解析列配置
                if (res.template_config && res.template_config.columns) {
                    const dynamicColumns: ProColumns[] = res.template_config.columns.map((col: any) => ({
                        title: col.title,
                        dataIndex: col.dataIndex,
                        key: col.dataIndex,
                        width: col.width || 120,
                        sorter: col.sortable,
                        hideInSearch: true, // 明细列默认不在搜索区
                    }));

                    // 解析搜索框配置
                    const searchColumns: ProColumns[] = (res.template_config.search_fields || []).map((field: any) => ({
                        title: field.label,
                        dataIndex: field.field,
                        key: field.field,
                        valueType: field.type === 'date_range' ? 'dateRange' :
                            field.type === 'select' ? 'select' : 'text',
                        hideInTable: true,
                    }));

                    setColumns([...searchColumns, ...dynamicColumns]);
                }
            }
        } catch (error) {
            message.error('加载报表配置失败');
        } finally {
            setLoading(false);
        }
    };

    const handleExport = () => {
        message.info('正在导出 Excel...');
    };

    return (
        <PageContainer
            header={{
                title: report?.name || '报表加载中...',
                breadcrumb: {
                    items: [
                        { title: '首页' },
                        { title: '快报 - 报表中心' },
                        { title: report?.name || '报表' },
                    ],
                },
                extra: [
                    <Button key="refresh" icon={<ReloadOutlined />} onClick={() => loadReportConfig()}>刷新配置</Button>,
                    <Button key="export" icon={<ExportOutlined />} onClick={handleExport}>导出数据</Button>,
                    <Button key="back" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>返回列表</Button>,
                ],
            }}
        >
            <ProTable
                headerTitle={report?.name}
                loading={loading}
                columns={columns}
                rowKey={(_, index) => `${index}`}
                request={async (params) => {
                    if (!id) return { data: [], success: true };
                    try {
                        const res = await queryReportData(id, params);
                        return {
                            data: res.data || [],
                            success: true,
                            total: res.total || 0,
                        };
                    } catch (error) {
                        message.error('数据查询失败');
                        return { data: [], success: false };
                    }
                }}
                search={{
                    labelWidth: 'auto',
                    defaultCollapsed: false,
                }}
                pagination={{
                    pageSize: 20,
                }}
                options={{
                    setting: true,
                    fullScreen: true,
                    density: true,
                }}
                bordered
                size="small"
                tableStyle={{ background: '#fff' }}
            />
        </PageContainer>
    );
};

export default ReportGridViewer;

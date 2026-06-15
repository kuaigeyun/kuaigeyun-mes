import React from 'react';
import { Button, Space, Typography, Spin, Empty, Card, Statistic } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { Column, Line, Pie } from '@ant-design/charts';
import { getReport, executeReport } from '../services/kuaireport';
import { UniReport } from '../../../components/uni-report';
import type { ReportConfigSchema } from '../../../components/uni-report';

const { Title, Text } = Typography;

type ChartPanelProps = {
    report: { id: number; name: string };
    chartType: string;
    xField?: string;
    yField?: string;
};

const ChartPanel: React.FC<ChartPanelProps> = ({ report, chartType, xField, yField }) => {
    const [reportData, setReportData] = React.useState<any[]>([]);
    const [dataLoading, setDataLoading] = React.useState(false);

    React.useEffect(() => {
        if (!report?.id) return;
        let cancelled = false;
        setDataLoading(true);
        executeReport(report.id, {})
            .then((res: any) => {
                if (!cancelled) setReportData(res?.data ?? []);
            })
            .finally(() => {
                if (!cancelled) setDataLoading(false);
            });
        return () => { cancelled = true; };
    }, [report?.id]);

    if (dataLoading) {
        return (
            <div style={{ textAlign: 'center', padding: 40 }}>
                <Spin tip="加载数据中...">
                    <div style={{ minHeight: 24 }} />
                </Spin>
            </div>
        );
    }
    if (reportData.length === 0) return <Empty description="暂无数据" />;

    switch (chartType) {
        case 'bar':
            return (
                <Column
                    data={reportData}
                    xField={xField}
                    yField={yField}
                    label={{ position: 'center', style: { fill: '#FFFFFF', opacity: 0.6 } }}
                />
            );
        case 'line':
            return (
                <Line
                    data={reportData}
                    xField={xField}
                    yField={yField}
                    point={{ size: 5, shape: 'diamond' }}
                />
            );
        case 'pie':
            return (
                <Pie
                    data={reportData}
                    angleField={yField}
                    colorField={xField}
                    radius={0.8}
                    label={{ type: 'outer' }}
                />
            );
        case 'card': {
            const val = reportData[0]?.[yField!] ?? 0;
            return (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <Statistic title={report.name} value={val} />
                </div>
            );
        }
        default:
            return null;
    }
};

const ReportViewer: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const [report, setReport] = React.useState<any>(null);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        if (!id) return;
        let cancelled = false;
        setIsLoading(true);
        getReport(id)
            .then((res) => {
                if (!cancelled) setReport(res);
            })
            .catch(() => {
                if (!cancelled) setReport(null);
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });
        return () => { cancelled = true; };
    }, [id]);

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
                <Spin size="large" />
            </div>
        );
    }

    if (!report) {
        return <Empty description="报表不存在" style={{ marginTop: 60 }} />;
    }

    const config: ReportConfigSchema = report.report_config || {};
    const chartType = config.chart_type || 'table';
    const xField = config.fields?.find((f) => f.x_axis)?.field;
    const yField = config.fields?.find((f) => f.y_axis)?.field;

    if (chartType === 'table') {
        return (
            <div style={{ padding: 24, minHeight: '100vh', background: '#f5f5f5' }}>
                <Space style={{ marginBottom: 16 }}>
                    <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>返回</Button>
                </Space>
                <UniReport
                    mode="config"
                    title={report.name}
                    subtitle={report.description}
                    reportConfig={config}
                    reportId={report.id}
                    permissionResource="kuaireport:report"
                    columnPersistenceId={`apps.kuaireport.pages.ReportViewer.${report.id}`}
                />
            </div>
        );
    }

    return (
        <div style={{ padding: 24, minHeight: '100vh', background: '#f5f5f5' }}>
            <Space style={{ marginBottom: 16 }}>
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>返回</Button>
                <Title level={4} style={{ margin: 0 }}>{report.name}</Title>
                <Text type="secondary">{report.description}</Text>
            </Space>
            <Card style={{ minHeight: 400 }}>
                <ChartPanel report={report} chartType={chartType} xField={xField} yField={yField} />
            </Card>
        </div>
    );
};

export default ReportViewer;

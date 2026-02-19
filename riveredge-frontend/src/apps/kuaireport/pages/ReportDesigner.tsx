import React, { useState } from 'react';
import {
    Steps, Button, Space, Typography, Form, Input, Select, Card,
    Row, Col, Radio, message, Tag, Spin,
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { getReport, createReport, updateReport } from '../services/kuaireport';

const { Title, Text } = Typography;
const { TextArea } = Input;

// ── 步骤1：基本信息 ─────────────────────────────────────────────
const StepBasicInfo: React.FC<{ form: any }> = ({ form }) => (
    <Form form={form} layout="vertical">
        <Row gutter={16}>
            <Col span={12}>
                <Form.Item name="name" label="报表名称" rules={[{ required: true, message: '请输入报表名称' }]}>
                    <Input placeholder="例：月度销售报表" />
                </Form.Item>
            </Col>
            <Col span={12}>
                <Form.Item name="code" label="报表编码" rules={[{ required: true, message: '请输入报表编码' }]}>
                    <Input placeholder="例：monthly_sales" />
                </Form.Item>
            </Col>
        </Row>
        <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="报表用途说明（可选）" />
        </Form.Item>
        <Form.Item name="category" label="报表类型" initialValue="custom">
            <Radio.Group>
                <Radio value="custom">我的报表（个人使用）</Radio>
                <Radio value="system">系统报表（需管理员权限）</Radio>
            </Radio.Group>
        </Form.Item>
    </Form>
);

// ── 步骤2：数据配置 ───────────────────────────────────────────
const StepDataConfig: React.FC<{ config: any; onChange: (v: any) => void }> = ({ config, onChange }) => {
    const [datasets, setDatasets] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const { getDatasetList } = await import('../../../services/dataset');
                const res = await getDatasetList({ page_size: 100, is_active: true });
                if (!cancelled && res?.items) {
                    setDatasets(res.items);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const handleSourceChange = (val: string) => {
        const ds = datasets.find((d: any) => d.uuid === val);
        onChange({
            ...config,
            dataset_uuid: val,
            dataset_code: ds?.code,
            // 模拟拉取字段信息，实际工程中应有单独的接口获取数据集元数据
            fields: [
                { field: 'id', label: 'ID', visible: true },
                { field: 'name', label: '名称', visible: true },
                { field: 'amount', label: '金额', visible: true, y_axis: true },
                { field: 'created_at', label: '创建日期', visible: true, x_axis: true },
            ]
        });
    };

    // 自动选择第一个数据集（无默认时）
    React.useEffect(() => {
        if (!config.dataset_uuid && datasets.length > 0) {
            handleSourceChange(datasets[0].uuid);
        }
    }, [datasets.length, config.dataset_uuid]);

    return (
        <div>
            <Title level={5}>数据集配置</Title>
            <Text type="secondary">选择报表引用的基础数据集（来自系统数据中心）</Text>
            <Form layout="vertical" style={{ marginTop: 24 }}>
                <Form.Item label="选择数据集" required>
                    <Select
                        placeholder="请选择"
                        loading={loading}
                        value={config.dataset_uuid}
                        onChange={handleSourceChange}
                        options={datasets.map((d: any) => ({ label: `${d.name} (${d.code})`, value: d.uuid }))}
                    />
                </Form.Item>
                {config.dataset_uuid && (
                    <div style={{ marginTop: 16 }}>
                        <Text strong>检测到字段：</Text>
                        <Space wrap style={{ marginTop: 8 }}>
                            {config.fields?.map((f: any) => (
                                <Tag color="blue" key={f.field}>{f.label} ({f.field})</Tag>
                            ))}
                        </Space>
                    </div>
                )}
            </Form>
        </div>
    );
};

// ── 步骤3：可视化设计 ────────────────────────────────────────
const StepVisualDesign: React.FC<{ config: any; onChange: (v: any) => void }> = ({ config, onChange }) => (
    <Row gutter={24}>
        <Col span={8}>
            <Title level={5}>配置选项</Title>
            <Form layout="vertical" style={{ marginTop: 16 }}>
                <Form.Item label="图表类型">
                    <Select
                        value={config.chart_type ?? 'table'}
                        onChange={val => onChange({ ...config, chart_type: val })}
                        options={[
                            { label: '基础表格', value: 'table' },
                            { label: '柱状图', value: 'bar' },
                            { label: '折线图', value: 'line' },
                            { label: '饼图', value: 'pie' },
                            { label: '指标卡', value: 'card' },
                        ]}
                    />
                </Form.Item>
                <Form.Item label="X轴 / 分组字段">
                    <Select
                        placeholder="选择字段"
                        value={config.fields?.find((f: any) => f.x_axis)?.field}
                        onChange={val => {
                            const newFields = config.fields.map((f: any) => ({
                                ...f,
                                x_axis: f.field === val
                            }));
                            onChange({ ...config, fields: newFields });
                        }}
                        options={config.fields?.map((f: any) => ({ label: f.label, value: f.field }))}
                    />
                </Form.Item>
                <Form.Item label="Y轴 / 数值字段">
                    <Select
                        placeholder="选择字段"
                        value={config.fields?.find((f: any) => f.y_axis)?.field}
                        onChange={val => {
                            const newFields = config.fields.map((f: any) => ({
                                ...f,
                                y_axis: f.field === val
                            }));
                            onChange({ ...config, fields: newFields });
                        }}
                        options={config.fields?.map((f: any) => ({ label: f.label, value: f.field }))}
                    />
                </Form.Item>
            </Form>
        </Col>
        <Col span={16}>
            <Title level={5}>预览 (模拟)</Title>
            <div style={{ background: '#fafafa', border: '1px border #e8e8e8', height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4 }}>
                <Text type="secondary">此处将显示 [{config.chart_type}] 的实时预览</Text>
            </div>
        </Col>
    </Row>
);

// ── 主组件 ──────────────────────────────────────────────────────
const ReportDesigner: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id?: string }>();
    const [current, setCurrent] = useState(0);
    const [basicForm] = Form.useForm();
    const [reportConfig, setReportConfig] = useState<any>({ chart_type: 'table' });
    const [saving, setSaving] = useState(false);

    const [initialLoading, setInitialLoading] = React.useState(!!id);

    React.useEffect(() => {
        if (!id) return;
        let cancelled = false;
        setInitialLoading(true);
        getReport(id)
            .then((report: any) => {
                if (!cancelled && report) {
                    basicForm.setFieldsValue({
                        name: report.name,
                        code: report.code,
                        description: report.description,
                        category: report.category,
                    });
                    if (report.report_config) {
                        setReportConfig(report.report_config);
                    }
                }
            })
            .catch(() => {
                if (!cancelled) message.error('加载报表失败');
            })
            .finally(() => {
                if (!cancelled) setInitialLoading(false);
            });
        return () => { cancelled = true; };
    }, [id, basicForm]);

    const handleSave = async () => {
        try {
            const basic = await basicForm.validateFields();
            const payload = { ...basic, report_config: reportConfig, status: 'DRAFT' };
            setSaving(true);
            try {
                if (id) {
                    await updateReport(id, payload);
                    message.success('保存成功');
                } else {
                    await createReport(payload);
                    message.success('创建成功');
                }
                navigate(-1);
            } catch (err: any) {
                message.error(err?.message || '保存失败');
            } finally {
                setSaving(false);
            }
        } catch {
            message.error('请检查表单填写');
        }
    };

    const steps = [
        { title: '基本信息', content: <StepBasicInfo form={basicForm} /> },
        { title: '数据配置', content: <StepDataConfig config={reportConfig} onChange={setReportConfig} /> },
        { title: '可视化设计', content: <StepVisualDesign config={reportConfig} onChange={setReportConfig} /> },
    ];

    return (
        <div style={{ padding: 24, minHeight: '100vh', background: '#f5f5f5' }}>
            <Space style={{ marginBottom: 16 }}>
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>返回</Button>
                <Title level={4} style={{ margin: 0 }}>{id ? '编辑报表' : '新建报表'}</Title>
            </Space>

            <Card style={{ marginBottom: 16 }}>
                <Steps
                    current={current}
                    items={steps.map(s => ({ title: s.title }))}
                />
            </Card>

            <Card style={{ minHeight: 400, marginBottom: 16 }}>
                {initialLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
                        <Spin size="large" />
                    </div>
                ) : (
                    steps[current].content
                )}
            </Card>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Button disabled={current === 0} onClick={() => setCurrent(c => c - 1)}>上一步</Button>
                <Space>
                    {current < steps.length - 1 ? (
                        <Button type="primary" onClick={() => setCurrent(c => c + 1)}>下一步</Button>
                    ) : (
                        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
                            保存报表
                        </Button>
                    )}
                </Space>
            </div>
        </div>
    );
};

export default ReportDesigner;


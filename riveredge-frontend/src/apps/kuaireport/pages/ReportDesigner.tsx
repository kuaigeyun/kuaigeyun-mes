import React, { useEffect, useRef, useState } from 'react';
import { Button, message, Space, Drawer, Form, Input, Table, Tabs } from 'antd';
import { SaveOutlined, ArrowLeftOutlined, DatabaseOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';

// Univer Imports
import '@univerjs/design/lib/index.css';
import '@univerjs/ui/lib/index.css';
import '@univerjs/sheets-ui/lib/index.css';
import '@univerjs/presets/lib/styles/preset-sheets-core.css';

import { createUniver, defaultTheme, LocaleType, merge } from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/presets/preset-sheets-core';
import { UniverSheetsAdvancedPreset } from '@univerjs/presets/preset-sheets-advanced';
import UniverPresetSheetsCoreZhCN from '@univerjs/presets/preset-sheets-core/locales/zh-CN';

import { getReport, createReport, updateReport, previewReportData } from '../services/kuaireport';

const ReportDesigner: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const id = searchParams.get('id');

    const containerRef = useRef<HTMLDivElement>(null);
    const univerInstanceRef = useRef<any>(null);
    const [name, setName] = useState('新建报表');
    const [saving, setSaving] = useState(false);

    // Data Source State
    const [dsDrawerVisible, setDsDrawerVisible] = useState(false);
    const [dataSourceConfig, setDataSourceConfig] = useState<any>({ type: 'sql', query: 'SELECT * FROM work_orders' });
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [previewLoading, setPreviewLoading] = useState(false);

    useEffect(() => {
        if (!containerRef.current) return;

        // Initialize Univer using Presets
        const { univer, univerAPI } = createUniver({
            locale: LocaleType.ZH_CN,
            locales: {
                [LocaleType.ZH_CN]: merge({}, UniverPresetSheetsCoreZhCN),
            },
            theme: defaultTheme,
            presets: [
                UniverSheetsCorePreset({
                    container: containerRef.current,
                }),
                UniverSheetsAdvancedPreset()
            ],
        });

        univerInstanceRef.current = { univer, univerAPI };

        // Load data if ID exists
        if (id) {
            loadReport(id);
        } else {
            // Create a blank sheet
            univerAPI.createUniverSheet({});
        }

        return () => {
            if (univerInstanceRef.current?.univer) {
                univerInstanceRef.current.univer.dispose();
                univerInstanceRef.current = null;
            }
        };
    }, []);

    const loadReport = async (reportId: string) => {
        try {
            const res = await getReport(reportId);
            if (res) {
                setName(res.name);
                if (res.template_config?.datasource) {
                    setDataSourceConfig(res.template_config.datasource);
                }
                if (res.content && univerInstanceRef.current?.univerAPI) {
                    univerInstanceRef.current.univerAPI.createUniverSheet(res.content);
                }
            }
        } catch (error) {
            message.error('加载报表失败');
            univerInstanceRef.current?.univerAPI.createUniverSheet({});
        }
    };

    const handleSave = async () => {
        if (!univerInstanceRef.current?.univerAPI) return;
        setSaving(true);
        try {
            const univerAPI = univerInstanceRef.current.univerAPI;
            const activeWorkbook = univerAPI.getActiveWorkbook();
            if (!activeWorkbook) {
                message.error('没有活动的工作簿');
                return;
            }

            // In Univer 0.12, getSnapshot() might be on the workbook
            const snapshot = activeWorkbook.getSnapshot();
            const data = {
                name,
                code: id ? undefined : `RPT_${Date.now()}`,
                content: snapshot,
                template_config: { datasource: dataSourceConfig },
                status: 'PUBLISHED'
            };

            if (id) {
                await updateReport(id, data);
                message.success('更新成功');
            } else {
                const res = await createReport(data);
                message.success('保存成功');
                if (res?.id) navigate(`?id=${res.id}`, { replace: true });
            }
        } catch (error) {
            console.error('Save error:', error);
            message.error('保存失败');
        } finally {
            setSaving(false);
        }
    };

    const handlePreviewData = async () => {
        setPreviewLoading(true);
        try {
            const res = await previewReportData(dataSourceConfig);
            if (res.success) {
                setPreviewData(res.data);
                message.success(`预览成功，获取到 ${res.total} 条数据`);
            } else {
                message.error(res.message || '预览失败');
            }
        } catch (error) {
            message.error('预览请求失败');
        } finally {
            setPreviewLoading(false);
        }
    };

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{
                height: '48px',
                background: '#fff',
                borderBottom: '1px solid #d9d9d9',
                display: 'flex',
                alignItems: 'center',
                padding: '0 16px',
                justifyContent: 'space-between'
            }}>
                <Space>
                    <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('../reports')} />
                    <span style={{ fontWeight: 'bold' }}>{name}</span>
                </Space>
                <Space>
                    <Button icon={<DatabaseOutlined />} onClick={() => setDsDrawerVisible(true)}>数据源配置</Button>
                    <Button
                        type="primary"
                        icon={<SaveOutlined />}
                        loading={saving}
                        onClick={handleSave}
                    >
                        保存
                    </Button>
                </Space>
            </div>
            <div ref={containerRef} style={{ flex: 1, position: 'relative' }} />

            <Drawer
                title="数据源配置"
                width={600}
                placement="right"
                onClose={() => setDsDrawerVisible(false)}
                open={dsDrawerVisible}
            >
                <Tabs defaultActiveKey="1" items={[
                    {
                        key: '1',
                        label: 'SQL配置',
                        children: (
                            <Form layout="vertical">
                                <Form.Item label="SQL查询语句" help="仅支持 SELECT 查询，系统会自动限制返回条数">
                                    <Input.TextArea
                                        rows={6}
                                        value={dataSourceConfig.query}
                                        onChange={e => setDataSourceConfig({ ...dataSourceConfig, query: e.target.value })}
                                        placeholder="SELECT * FROM table_name"
                                        style={{ fontFamily: 'monospace' }}
                                    />
                                </Form.Item>
                                <Button type="primary" icon={<PlayCircleOutlined />} onClick={handlePreviewData} loading={previewLoading}>
                                    执行并预览
                                </Button>
                            </Form>
                        )
                    },
                    {
                        key: '2',
                        label: 'API配置',
                        children: <div>暂未支持 API 数据源，请使用 SQL。</div>
                    }
                ]} />

                <div style={{ marginTop: '24px' }}>
                    <h4>数据预览 (Top 20)</h4>
                    <Table
                        size="small"
                        dataSource={previewData}
                        columns={previewData.length > 0 ? Object.keys(previewData[0]).map(key => ({ title: key, dataIndex: key, key, ellipsis: true })) : []}
                        scroll={{ x: 'max-content' }}
                        pagination={false}
                        loading={previewLoading}
                        bordered
                    />
                </div>
            </Drawer>
        </div>
    );
};

export default ReportDesigner;

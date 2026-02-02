import React, { useState } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Input, Card, Space, Select, Empty, Spin, message, Drawer, Descriptions, Tag, Button } from 'antd';
import { useRequest } from 'ahooks';
import { api } from '../../../../../services/api';
import { useTranslation } from 'react-i18next';
import { FlowGraph } from '@ant-design/graphs';

const TraceabilityPage: React.FC = () => {
    const { t } = useTranslation();
    const [searchParams, setSearchParams] = useState<{ batch_no: string, direction: string }>({
        batch_no: '',
        direction: 'both'
    });
    const [detailVisible, setDetailVisible] = useState(false);
    const [selectedNode, setSelectedNode] = useState<any>(null);

    const { data, loading, run } = useRequest(
        async (batch_no: string, direction: string) => {
            if (!batch_no) return null;
            // Assuming API_BASE_URL is /api/v1 and kuaizhizao routes are under /kuaizhizao
            return api.get('/kuaizhizao/traceability/graph', {
                params: { batch_no, direction }
            });
        },
        {
            manual: true,
            onError: (err) => {
                message.error('Fetch failed: ' + err.message);
            }
        }
    );

    const handleSearch = (value: string) => {
        if (!value) return;
        setSearchParams({ ...searchParams, batch_no: value });
        run(value, searchParams.direction);
    };

    // Graph Configuration
    const config = {
        data: data ? {
            nodes: data.nodes.map((n: any) => ({
                id: n.id,
                label: n.label,
                style: {
                    fill: n.type === 'work_order' ? '#E6F7FF' : '#F6FFED',
                    stroke: n.type === 'work_order' ? '#1890FF' : '#52C41A',
                }
            })),
            edges: data.edges.map((e: any) => ({
                source: e.source,
                target: e.target,
                label: e.label,
            })),
        } : { nodes: [], edges: [] },
        layout: {
            type: 'dagre',
            rankdir: 'LR',
            nodesep: 30,
            ranksep: 50,
        },
        behaviors: ['drag-canvas', 'zoom-canvas', 'drag-node'],
        node: {
            type: 'rect',
            style: {
                radius: 4,
            },
            labelCfg: {
                style: {
                    fontSize: 12,
                },
            },
        },
        edge: {
            type: 'polyline',
            style: {
                endArrow: true,
                radius: 20,
            },
            labelCfg: {
                autoRotate: true,
                style: {
                    fill: '#aaa',
                    fontSize: 12,
                }
            }
        },
        markerCfg: () => {
            return { show: false };
        },
        onReady: (graph: any) => {
            graph.on('node:click', (evt: any) => {
                const nodeData = evt.item.getModel();
                // Find the original node data from 'data' returned by useRequest
                const originalNode = data?.nodes.find((n: any) => n.id === nodeData.id);
                if (originalNode) {
                    setSelectedNode(originalNode);
                    setDetailVisible(true);
                }
            });
        },
    };

    return (
        <PageContainer title={t('app.kuaizhizao.menu.quality-management.traceability')}>
            <Card>
                <Space style={{ marginBottom: 24 }}>
                    <Input.Search
                        placeholder={t('pages.traceability.searchPlaceholder', { defaultValue: '请输入批次号 / 条码' })}
                        enterButton
                        onSearch={handleSearch}
                        style={{ width: 400 }}
                    />
                    <Select
                        defaultValue="both"
                        style={{ width: 150 }}
                        onChange={(val) => setSearchParams({ ...searchParams, direction: val })}
                        options={[
                            { value: 'forward', label: t('pages.traceability.forward', { defaultValue: '正向 (-> 成品)' }) },
                            { value: 'backward', label: t('pages.traceability.backward', { defaultValue: '反向 (-> 原料)' }) },
                            { value: 'both', label: t('pages.traceability.both', { defaultValue: '双向' }) },
                        ]}
                    />
                </Space>

                <div style={{ minHeight: 600, border: '1px solid #f0f0f0', position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
                    {loading && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 100 }}><Spin size="large" /></div>}

                    {!data && !loading && <Empty description={t('pages.traceability.empty', { defaultValue: '请输入批次号进行查询' })} style={{ paddingTop: 150 }} />}

                    {data && (
                        <FlowGraph {...config} />
                    )}
                </div>
            </Card>

            <Drawer
                title={t('pages.traceability.details', { defaultValue: '详情信息' })}
                placement="right"
                onClose={() => setDetailVisible(false)}
                open={detailVisible}
                width={400}
            >
                {selectedNode && (
                    <Descriptions column={1} bordered size="small">
                        <Descriptions.Item label={t('pages.traceability.nodeType', { defaultValue: '类型' })}>
                            <Tag color={selectedNode.type === 'work_order' ? 'blue' : 'green'}>
                                {selectedNode.type === 'work_order' ? t('pages.traceability.workOrder', { defaultValue: '产线工单' }) : t('pages.traceability.batch', { defaultValue: '物料批次' })}
                            </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label={t('pages.traceability.nodeId', { defaultValue: '标识' })}>
                            {selectedNode.id}
                        </Descriptions.Item>
                        {selectedNode.data?.material_name && (
                            <Descriptions.Item label={t('pages.traceability.materialName', { defaultValue: '物料名称' })}>
                                {selectedNode.data.material_name}
                            </Descriptions.Item>
                        )}
                        {selectedNode.data?.material_code && (
                            <Descriptions.Item label={t('pages.traceability.materialCode', { defaultValue: '物料编码' })}>
                                {selectedNode.data.material_code}
                            </Descriptions.Item>
                        )}
                        {selectedNode.data?.operation_name && (
                            <Descriptions.Item label={t('pages.traceability.operationName', { defaultValue: '执行工序' })}>
                                {selectedNode.data.operation_name}
                            </Descriptions.Item>
                        )}
                    </Descriptions>
                )}
                {selectedNode?.type === 'work_order' && selectedNode.data?.work_order_id && (
                    <div style={{ marginTop: 24 }}>
                        <Button type="primary" block>{t('pages.traceability.viewWorkOrder', { defaultValue: '查看工单详情' })}</Button>
                    </div>
                )}
            </Drawer>
        </PageContainer>
    );
};

export default TraceabilityPage;

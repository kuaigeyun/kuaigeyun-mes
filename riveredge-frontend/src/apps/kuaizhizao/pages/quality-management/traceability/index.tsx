import React, { useState } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Input, Card, Space, Select, Empty, Spin, message } from 'antd';
import { useRequest } from 'ahooks';
import { api } from '@/services/api';
import { Graph } from '@ant-design/graphs';

const TraceabilityPage: React.FC = () => {
    const [searchParams, setSearchParams] = useState<{ batch_no: string, direction: string }>({
        batch_no: '',
        direction: 'both'
    });

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
        markerCfg: (cfg: any) => {
            return { show: false };
        },
    };

    return (
        <PageContainer title="产品追溯">
            <Card>
                <Space style={{ marginBottom: 24 }}>
                    <Input.Search
                        placeholder="请输入批次号 / 条码"
                        enterButton
                        onSearch={handleSearch}
                        style={{ width: 400 }}
                    />
                    <Select
                        defaultValue="both"
                        style={{ width: 120 }}
                        onChange={(val) => setSearchParams({ ...searchParams, direction: val })}
                        options={[
                            { value: 'forward', label: '正向 (-> 成品)' },
                            { value: 'backward', label: '反向 (-> 原料)' },
                            { value: 'both', label: '双向' },
                        ]}
                    />
                </Space>

                <div style={{ minHeight: 600, border: '1px solid #f0f0f0', position: 'relative' }}>
                    {loading && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 100 }}><Spin /></div>}

                    {!data && !loading && <Empty description="请输入批次号进行查询" style={{ paddingTop: 100 }} />}

                    {data && (
                        <Graph {...config} />
                    )}
                </div>
            </Card>
        </PageContainer>
    );
};

export default TraceabilityPage;

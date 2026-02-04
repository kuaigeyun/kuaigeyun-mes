import React from 'react';
import { Form, Input, InputNumber, Divider, Tabs, Select, Typography } from 'antd';

const { Text } = Typography;
import { WidgetConfig } from '../../types/dashboard';

interface PropertiesPanelProps {
    selectedWidget: WidgetConfig | null;
    onChange: (id: string, updates: Partial<WidgetConfig>) => void;
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ selectedWidget, onChange }) => {
    if (!selectedWidget) return null;

    const items = [
        {
            key: 'style',
            label: '样式',
            children: (
                <div style={{ padding: '4px 0' }}>
                    <Form.Item label="组件标题">
                        <Input
                            value={selectedWidget.title}
                            onChange={(e) => onChange(selectedWidget.id, { title: e.target.value })}
                            className="dark-input"
                        />
                    </Form.Item>

                    <Divider className="dark-divider">视觉配置</Divider>

                    <Form.Item label="背景模糊 (px)">
                        <InputNumber
                            min={0}
                            max={20}
                            value={selectedWidget.props?.blur || 0}
                            onChange={(val) => onChange(selectedWidget.id, { props: { ...selectedWidget.props, blur: val } })}
                            className="dark-input-number"
                        />
                    </Form.Item>

                    {['indicator', 'water'].includes(selectedWidget.type || (selectedWidget as any).category) && (
                        <>
                            <Form.Item label="数字颜色">
                                <Input
                                    type="color"
                                    value={selectedWidget.props?.color || '#00f2ff'}
                                    onChange={(e) => onChange(selectedWidget.id, { props: { ...selectedWidget.props, color: e.target.value } })}
                                    style={{ height: '32px', padding: '2px' }}
                                />
                            </Form.Item>
                            <Form.Item label="单位">
                                <Input
                                    value={selectedWidget.unit}
                                    onChange={(e) => onChange(selectedWidget.id, { unit: e.target.value })}
                                    className="dark-input"
                                />
                            </Form.Item>
                        </>
                    )}

                    {selectedWidget.type === 'text' && (
                        <Form.Item label="文本内容">
                            <Input.TextArea
                                value={selectedWidget.content}
                                onChange={(e) => onChange(selectedWidget.id, { content: e.target.value })}
                                className="dark-input"
                            />
                        </Form.Item>
                    )}
                </div>
            )
        },
        {
            key: 'data',
            label: '数据',
            children: (
                <div style={{ padding: '4px 0' }}>
                    <Form.Item label="数据来源">
                        <Select
                            defaultValue="static"
                            className="dark-select"
                            options={[
                                { value: 'static', label: '静态数据' },
                                { value: 'api', label: 'API 接口' },
                                { value: 'sql', label: 'SQL 查询' }
                            ]}
                        />
                    </Form.Item>

                    {['indicator', 'water'].includes(selectedWidget.type || (selectedWidget as any).category) && (
                        <Form.Item label="指标数值">
                            <InputNumber
                                value={selectedWidget.value}
                                onChange={(val) => onChange(selectedWidget.id, { value: val as number })}
                                className="dark-input-number"
                            />
                        </Form.Item>
                    )}

                    <Text type="secondary" style={{ fontSize: '12px' }}>* 目前仅支持静态数据，动态绑定开发中</Text>
                </div>
            )
        },
        {
            key: 'interaction',
            label: '交互',
            children: (
                <div style={{ padding: '20px 0', textAlign: 'center', color: '#666' }}>
                    <p>联动、钻取等交互功能</p>
                    <p>敬请期待...</p>
                </div>
            )
        }
    ];

    return (
        <div className="properties-container">
            <Tabs
                defaultActiveKey="style"
                size="small"
                items={items}
                className="dark-tabs"
            />

            <style>{`
                .properties-container .dark-tabs .ant-tabs-nav::before { border-bottom: 1px solid #303030; }
                .properties-container .ant-form-item-label > label { color: rgba(255,255,255,0.45) !important; font-size: 12px; }
                .dark-input { background: #1f1f1f !important; color: #fff !important; border: 1px solid #303030 !important; }
                .dark-input-number { width: 100%; background: #1f1f1f !important; color: #fff !important; border: 1px solid #303030 !important; }
                .dark-input-number .ant-input-number-input { color: #fff !important; }
                .dark-divider { border-color: #303030 !important; margin: 12px 0 !important; color: rgba(22, 119, 255, 0.8) !important; font-size: 12px !important; }
                .dark-select .ant-select-selector { background: #1f1f1f !important; border-color: #303030 !important; color: #fff !important; }
            `}</style>
        </div>
    );
};

export default PropertiesPanel;

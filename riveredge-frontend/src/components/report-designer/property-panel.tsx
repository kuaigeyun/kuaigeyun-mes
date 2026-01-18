/**
 * 属性配置面板组件
 *
 * 用于配置选中组件的属性（数据源、样式、格式等）
 *
 * @author Luigi Lu
 * @date 2025-01-15
 */

import React, { useEffect, useState } from 'react';
import { Card, Form, Input, InputNumber, Select, ColorPicker, Switch, Button } from 'antd';
import { ReportComponent } from './index';
import { getDataSourceList } from '../../services/dataSource';

/**
 * 数据源接口
 */
interface DataSource {
  uuid: string;
  code: string;
  name: string;
}

/**
 * 属性配置面板Props
 */
export interface PropertyPanelProps {
  /** 选中的组件 */
  selectedComponent: ReportComponent | null;
  /** 更新组件回调 */
  onUpdate?: (component: ReportComponent) => void;
}

/**
 * 属性配置面板组件
 */
const PropertyPanel: React.FC<PropertyPanelProps> = ({
  selectedComponent,
  onUpdate,
}) => {
  const [form] = Form.useForm();
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(false);

  /**
   * 加载数据源列表
   */
  useEffect(() => {
    loadDataSources();
  }, []);

  /**
   * 加载数据源
   */
  const loadDataSources = async () => {
    setLoading(true);
    try {
      const response = await getDataSourceList({ page_size: 100, is_active: true });
      setDataSources(response.items || []);
    } catch (error) {
      console.error('加载数据源失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedComponent) {
      form.setFieldsValue(selectedComponent);
    } else {
      form.resetFields();
    }
  }, [selectedComponent, form]);

  /**
   * 处理属性更新
   */
  const handleUpdate = (values: any) => {
    if (selectedComponent && onUpdate) {
      onUpdate({
        ...selectedComponent,
        ...values,
      });
    }
  };

  if (!selectedComponent) {
    return (
      <Card title="属性配置" size="small">
        <div style={{ textAlign: 'center', color: '#999', padding: '40px 0' }}>
          请选择组件进行配置
        </div>
      </Card>
    );
  }

  return (
    <Card title="属性配置" size="small">
      <Form
        form={form}
        layout="vertical"
        onValuesChange={handleUpdate}
      >
        {/* 位置和大小 */}
        <Form.Item label="X坐标" name="x">
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="Y坐标" name="y">
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="宽度" name="width">
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="高度" name="height">
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>

        {/* 根据组件类型显示不同的配置项 */}
        {selectedComponent.type === 'table' && (
          <>
            <Form.Item label="数据源" name={['dataSource', 'code']}>
              <Select
                placeholder="请选择数据源"
                loading={loading}
                allowClear
                showSearch
                optionFilterProp="label"
              >
                {dataSources.map((ds) => (
                  <Select.Option key={ds.uuid} value={ds.code} label={ds.name}>
                    {ds.name} ({ds.code})
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item label="数据源类型" name={['dataSource', 'type']}>
              <Select placeholder="请选择数据源类型">
                <Select.Option value="datasource">数据源</Select.Option>
                <Select.Option value="api">API接口</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) =>
                prevValues?.dataSource?.type !== currentValues?.dataSource?.type
              }
            >
              {({ getFieldValue }) =>
                getFieldValue(['dataSource', 'type']) === 'api' ? (
                  <Form.Item label="API地址" name={['dataSource', 'url']}>
                    <Input placeholder="请输入API地址" />
                  </Form.Item>
                ) : null
              }
            </Form.Item>
          </>
        )}

        {selectedComponent.type === 'chart' && (
          <>
            <Form.Item label="图表类型" name="chartType">
              <Select>
                <Select.Option value="column">柱状图</Select.Option>
                <Select.Option value="line">折线图</Select.Option>
                <Select.Option value="pie">饼图</Select.Option>
                <Select.Option value="scatter">散点图</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item label="数据源" name={['dataSource', 'code']}>
              <Select
                placeholder="请选择数据源"
                loading={loading}
                allowClear
                showSearch
                optionFilterProp="label"
              >
                {dataSources.map((ds) => (
                  <Select.Option key={ds.uuid} value={ds.code} label={ds.name}>
                    {ds.name} ({ds.code})
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item label="数据源类型" name={['dataSource', 'type']}>
              <Select placeholder="请选择数据源类型">
                <Select.Option value="datasource">数据源</Select.Option>
                <Select.Option value="api">API接口</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) =>
                prevValues?.dataSource?.type !== currentValues?.dataSource?.type
              }
            >
              {({ getFieldValue }) =>
                getFieldValue(['dataSource', 'type']) === 'api' ? (
                  <Form.Item label="API地址" name={['dataSource', 'url']}>
                    <Input placeholder="请输入API地址" />
                  </Form.Item>
                ) : null
              }
            </Form.Item>
          </>
        )}

        {selectedComponent.type === 'text' && (
          <>
            <Form.Item label="文本类型" name="textType">
              <Select>
                <Select.Option value="title">标题</Select.Option>
                <Select.Option value="paragraph">段落</Select.Option>
                <Select.Option value="label">标签</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item label="文本内容" name="content">
              <Input.TextArea rows={4} placeholder="请输入文本内容" />
            </Form.Item>
            {selectedComponent.textType === 'title' && (
              <Form.Item label="标题级别" name="level">
                <InputNumber min={1} max={6} style={{ width: '100%' }} />
              </Form.Item>
            )}
          </>
        )}

        {selectedComponent.type === 'image' && (
          <>
            <Form.Item label="图片URL" name="src">
              <Input placeholder="请输入图片URL" />
            </Form.Item>
            <Form.Item label="图片描述" name="alt">
              <Input placeholder="请输入图片描述" />
            </Form.Item>
          </>
        )}
      </Form>
    </Card>
  );
};

export default PropertyPanel;


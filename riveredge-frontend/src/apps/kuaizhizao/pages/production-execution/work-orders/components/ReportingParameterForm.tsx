/**
 * 报工参数收集表单 (Reporting Parameter Form)
 * 
 * 功能：
 * 1. 动态生成输入项（数字、文本、布尔值）
 * 2. 针对触屏优化的大尺寸输入框
 * 3. 实时校验
 * 
 * Author: Antigravity
 * Date: 2026-02-05
 */

import React from 'react';
import { Form, Input, InputNumber, Switch, Space, Typography, Card } from 'antd';

const { Text } = Typography;

export interface ParameterDefinition {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean';
  unit?: string;
  required?: boolean;
  defaultValue?: any;
}

export interface ReportingParameterFormProps {
  parameters: ParameterDefinition[];
  form: any;
  onValuesChange?: (changedValues: any, allValues: any) => void;
}

const ReportingParameterForm: React.FC<ReportingParameterFormProps> = ({
  parameters,
  form,
  onValuesChange,
}) => {
  if (!parameters || parameters.length === 0) {
    return null;
  }

  return (
    <Card 
      title={<Text style={{ color: '#fff', fontSize: 18 }}>报工参数采集</Text>}
      style={{ 
        background: 'rgba(255, 255, 255, 0.05)', 
        border: '1px solid rgba(255, 255, 255, 0.1)',
        marginBottom: 16 
      }}
      styles={{ body: { padding: '12px 24px' } }}
    >
      <Form
        form={form}
        layout="vertical"
        onValuesChange={onValuesChange}
        requiredMark={false}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {parameters.map(param => (
            <Form.Item
              key={param.id}
              name={param.id}
              label={<Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: 16 }}>{param.name}{param.unit ? ` (${param.unit})` : ''}</Text>}
              rules={[{ required: param.required, message: `${param.name}为必填项` }]}
              initialValue={param.defaultValue}
              valuePropName={param.type === 'boolean' ? 'checked' : 'value'}
            >
              {param.type === 'number' ? (
                <InputNumber
                  style={{ width: '100%', height: 50, fontSize: 20, background: 'rgba(255, 255, 255, 0.05)', color: '#fff' }}
                  placeholder="请输入数值"
                />
              ) : param.type === 'boolean' ? (
                <Switch size="large" />
              ) : (
                <Input
                  style={{ height: 50, fontSize: 20, background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff' }}
                  placeholder="请输入内容"
                />
              )}
            </Form.Item>
          ))}
        </div>
      </Form>
    </Card>
  );
};

export default ReportingParameterForm;

/**
 * 编码规则组件配置对话框
 * 
 * 用于编辑规则组件的详细配置
 */

import React, { useState, useEffect } from 'react';
import { Modal, Form, theme } from 'antd';
import { ProForm, ProFormText, ProFormDigit, ProFormSwitch, ProFormSelect, ProFormRadio } from '@ant-design/pro-components';
import {
  CodeRuleComponent,
  AutoCounterComponent,
  DateComponent,
  FixedTextComponent,
  FormFieldComponent,
  DATE_PRESET_FORMATS,
} from '../../types/codeRuleComponent';

interface CodeRuleComponentConfigModalProps {
  visible: boolean;
  component: CodeRuleComponent;
  availableFields?: Array<{ field_name: string; field_label: string; field_type: string }>;
  onSave: (component: CodeRuleComponent) => void;
  onCancel: () => void;
}

const CodeRuleComponentConfigModal: React.FC<CodeRuleComponentConfigModalProps> = ({
  visible,
  component,
  availableFields = [],
  onSave,
  onCancel,
}) => {
  const { token } = theme.useToken();
  const [form] = Form.useForm();
  const [formValues, setFormValues] = useState<Partial<CodeRuleComponent>>(component);

  useEffect(() => {
    if (visible) {
      form.setFieldsValue(component);
      setFormValues(component);
    }
  }, [visible, component, form]);

  const handleSave = () => {
    form.validateFields().then(values => {
      const updatedComponent: CodeRuleComponent = {
        ...component,
        ...values,
      } as CodeRuleComponent;
      onSave(updatedComponent);
    });
  };

  const renderComponentConfig = () => {
    switch (component.type) {
      case 'auto_counter':
        return (
          <>
            <ProFormDigit
              name="digits"
              label="计数位数"
              rules={[{ required: true, message: '请输入计数位数' }]}
              fieldProps={{ min: 2, max: 12 }}
              initialValue={(component as AutoCounterComponent).digits}
              extra="计数位数范围：2-12"
            />
            <ProFormSwitch
              name="fixed_width"
              label="位数固定"
              initialValue={(component as AutoCounterComponent).fixed_width}
              extra="开启后显示固定位数，如00001；关闭后显示实际位数，如1"
            />
            <ProFormSelect
              name="reset_cycle"
              label="重置周期"
              rules={[{ required: true, message: '请选择重置周期' }]}
              options={[
                { label: '不自动重置', value: 'never' },
                { label: '每日重置', value: 'daily' },
                { label: '每月重置', value: 'monthly' },
                { label: '每年重置', value: 'yearly' },
              ]}
              initialValue={(component as AutoCounterComponent).reset_cycle}
              extra="重置周期是指流水号重新计数的条件"
            />
            <ProFormDigit
              name="initial_value"
              label="初始值"
              rules={[{ required: true, message: '请输入初始值' }]}
              fieldProps={{ min: 0 }}
              initialValue={(component as AutoCounterComponent).initial_value}
              extra="计数的初始数值，也就是从哪一个数字开始计数"
            />
            <ProFormSelect
              name="scope_fields"
              label="隔离字段 (分类计数)"
              mode="multiple"
              options={availableFields.map(field => ({
                label: `${field.field_label} (${field.field_name})`,
                value: field.field_name,
              }))}
              placeholder="选择按哪些字段隔离计数"
              initialValue={(component as AutoCounterComponent).scope_fields}
              extra="例如：如果选择“部门”字段，则不同部门的流水号相互独立（如销售部0001，市场部0001）"
            />
          </>
        );

      case 'date':
        return (
          <>
            <ProFormRadio.Group
              name="format_type"
              label="格式类型"
              rules={[{ required: true, message: '请选择格式类型' }]}
              options={[
                { label: '预定义格式', value: 'preset' },
                { label: '自定义格式', value: 'custom' },
              ]}
              initialValue={(component as DateComponent).format_type}
            />
            {(formValues as DateComponent).format_type === 'preset' || (component as DateComponent).format_type === 'preset' ? (
              <ProFormSelect
                name="preset_format"
                label="预定义格式"
                rules={[{ required: true, message: '请选择预定义格式' }]}
                options={DATE_PRESET_FORMATS}
                initialValue={(component as DateComponent).preset_format}
                extra="选择预定义的日期格式"
              />
            ) : (
              <ProFormText
                name="custom_format"
                label="自定义格式"
                rules={[{ required: true, message: '请输入自定义格式' }]}
                placeholder="例如：yMd 表示年月日，yyyyMMdd 表示4位年+2位月+2位日"
                initialValue={(component as DateComponent).custom_format}
                extra="使用 y 表示年，M 表示月，d 表示日。例如：yMd 表示年月日"
              />
            )}
          </>
        );

      case 'fixed_text':
        return (
          <ProFormText
            name="text"
            label="固定字符"
            rules={[{ required: true, message: '请输入固定字符' }]}
            placeholder="请输入要添加的字符"
            initialValue={(component as FixedTextComponent).text}
            extra="用于区分不同业务的流水号"
          />
        );

      case 'form_field':
        return (
          <ProFormSelect
            name="field_name"
            label="表单字段"
            rules={[{ required: true, message: '请选择表单字段' }]}
            options={availableFields.map(field => ({
              label: `${field.field_label} (${field.field_name})`,
              value: field.field_name,
            }))}
            placeholder="请选择要引用的表单字段"
            initialValue={(component as FormFieldComponent).field_name}
            extra="选择要添加到流水号中的表单字段"
          />
        );

      default:
        return null;
    }
  };

  const getTitle = () => {
    const typeLabels: Record<string, string> = {
      auto_counter: '自动计数',
      date: '提交日期',
      fixed_text: '固定字符',
      form_field: '表单字段',
    };
    return `配置${typeLabels[component.type] || '组件'}`;
  };

  return (
    <Modal
      title={getTitle()}
      open={visible}
      onOk={handleSave}
      onCancel={onCancel}
      width={600}
      destroyOnHidden
    >
      <ProForm
        form={form}
        submitter={false}
        layout="vertical"
        onValuesChange={(changedValues) => {
          setFormValues(prev => ({ ...prev, ...changedValues }));
        }}
      >
        {renderComponentConfig()}
      </ProForm>
    </Modal>
  );
};

export default CodeRuleComponentConfigModal;

/**
 * 编号规则组件配置对话框
 * 
 * 用于编辑规则组件的详细配置
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
              label={t('components.codeRuleComponentConfig.autoCounter.digits')}
              rules={[{ required: true, message: t('components.codeRuleComponentConfig.autoCounter.digitsRequired') }]}
              fieldProps={{ min: 2, max: 12 }}
              initialValue={(component as AutoCounterComponent).digits}
              extra={t('components.codeRuleComponentConfig.autoCounter.digitsExtra')}
            />
            <ProFormSwitch
              name="fixed_width"
              label={t('components.codeRuleComponentConfig.autoCounter.fixedWidth')}
              initialValue={(component as AutoCounterComponent).fixed_width}
              extra={t('components.codeRuleComponentConfig.autoCounter.fixedWidthExtra')}
            />
            <ProFormSelect
              name="reset_cycle"
              label={t('components.codeRuleComponentConfig.autoCounter.resetCycle')}
              rules={[{ required: true, message: t('components.codeRuleComponentConfig.autoCounter.resetCycleRequired') }]}
              options={[
                { label: t('components.codeRuleComponent.resetCycle.never'), value: 'never' },
                { label: t('components.codeRuleComponent.resetCycle.daily'), value: 'daily' },
                { label: t('components.codeRuleComponent.resetCycle.monthly'), value: 'monthly' },
                { label: t('components.codeRuleComponent.resetCycle.yearly'), value: 'yearly' },
              ]}
              initialValue={(component as AutoCounterComponent).reset_cycle}
              extra={t('components.codeRuleComponentConfig.autoCounter.resetCycleExtra')}
            />
            <ProFormDigit
              name="initial_value"
              label={t('components.codeRuleComponentConfig.autoCounter.initialValue')}
              rules={[{ required: true, message: t('components.codeRuleComponentConfig.autoCounter.initialValueRequired') }]}
              fieldProps={{ min: 0 }}
              initialValue={(component as AutoCounterComponent).initial_value}
              extra={t('components.codeRuleComponentConfig.autoCounter.initialValueExtra')}
            />
            <ProFormSelect
              name="scope_fields"
              label={t('components.codeRuleComponentConfig.autoCounter.scopeFields')}
              mode="multiple"
              options={availableFields.map(field => ({
                label: `${field.field_label} (${field.field_name})`,
                value: field.field_name,
              }))}
              placeholder={t('components.codeRuleComponentConfig.autoCounter.scopeFieldsPlaceholder')}
              initialValue={(component as AutoCounterComponent).scope_fields}
              extra={t('components.codeRuleComponentConfig.autoCounter.scopeFieldsExtra')}
            />
          </>
        );

      case 'date':
        return (
          <>
            <ProFormRadio.Group
              name="format_type"
              label={t('components.codeRuleComponentConfig.date.formatType')}
              rules={[{ required: true, message: t('components.codeRuleComponentConfig.date.formatTypeRequired') }]}
              options={[
                { label: t('components.codeRuleComponentConfig.date.formatTypePreset'), value: 'preset' },
                { label: t('components.codeRuleComponentConfig.date.formatTypeCustom'), value: 'custom' },
              ]}
              initialValue={(component as DateComponent).format_type}
            />
            {(formValues as DateComponent).format_type === 'preset' || (component as DateComponent).format_type === 'preset' ? (
              <ProFormSelect
                name="preset_format"
                label={t('components.codeRuleComponentConfig.date.presetFormat')}
                rules={[{ required: true, message: t('components.codeRuleComponentConfig.date.presetFormatRequired') }]}
                options={DATE_PRESET_FORMATS}
                initialValue={(component as DateComponent).preset_format}
                extra={t('components.codeRuleComponentConfig.date.presetFormatExtra')}
              />
            ) : (
              <ProFormText
                name="custom_format"
                label={t('components.codeRuleComponentConfig.date.customFormat')}
                rules={[{ required: true, message: t('components.codeRuleComponentConfig.date.customFormatRequired') }]}
                placeholder={t('components.codeRuleComponentConfig.date.customFormatPlaceholder')}
                initialValue={(component as DateComponent).custom_format}
                extra={t('components.codeRuleComponentConfig.date.customFormatExtra')}
              />
            )}
          </>
        );

      case 'fixed_text':
        return (
          <ProFormText
            name="text"
            label={t('components.codeRuleComponentConfig.fixedText.text')}
            rules={[{ required: true, message: t('components.codeRuleComponentConfig.fixedText.textRequired') }]}
            placeholder={t('components.codeRuleComponentConfig.fixedText.textPlaceholder')}
            initialValue={(component as FixedTextComponent).text}
            extra={t('components.codeRuleComponentConfig.fixedText.textExtra')}
          />
        );

      case 'form_field':
        return (
          <ProFormSelect
            name="field_name"
            label={t('components.codeRuleComponentConfig.formField.fieldName')}
            rules={[{ required: true, message: t('components.codeRuleComponentConfig.formField.fieldNameRequired') }]}
            options={availableFields.map(field => ({
              label: `${field.field_label} (${field.field_name})`,
              value: field.field_name,
            }))}
            placeholder={t('components.codeRuleComponentConfig.formField.fieldNamePlaceholder')}
            initialValue={(component as FormFieldComponent).field_name}
            extra={t('components.codeRuleComponentConfig.formField.fieldNameExtra')}
          />
        );

      default:
        return null;
    }
  };

  const getTitle = () => {
    const typeLabelKeyMap: Record<string, string> = {
      auto_counter: 'components.codeRuleComponent.type.autoCounter',
      date: 'components.codeRuleComponent.type.date',
      fixed_text: 'components.codeRuleComponent.type.fixedText',
      form_field: 'components.codeRuleComponent.type.formField',
    };
    const name = t(typeLabelKeyMap[component.type] || 'components.codeRuleComponentConfig.component');
    return t('components.codeRuleComponentConfig.modalTitle', { name });
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

/**
 * 动态表单字段组件
 * 
 * 基于 Formily 渲染自定义字段的动态表单
 */

import React, { useEffect, useState } from 'react';
import { createForm, FormProvider, FormConsumer, Field } from '@formily/react';
import { createSchemaField } from '@formily/react';
import {
  FormItem,
  Input,
  InputNumber,
  DatePicker,
  Select,
  FormLayout,
} from '@formily/antd-v5';
import { App } from 'antd';
import { getCustomFieldsByTable, getFieldValues, batchSetFieldValues, CustomField } from '../../../services/customField';
import { customFieldsToFormilySchema, fieldValuesToFormilyValues, formilyValuesToFieldValues } from '../../../utils/customFieldToFormily';

const SchemaField = createSchemaField({
  components: {
    FormItem,
    Input,
    InputNumber,
    DatePicker,
    Select,
  },
});

/**
 * 动态表单字段组件属性
 */
export interface DynamicFormFieldProps {
  /** 关联表名 */
  tableName: string;
  /** 关联记录ID */
  recordId?: number;
  /** 是否只显示启用的字段 */
  onlyActive?: boolean;
  /** 表单值变化回调 */
  onChange?: (values: Record<string, any>) => void;
  /** 是否只读 */
  readOnly?: boolean;
}

/**
 * 动态表单字段组件
 */
const DynamicFormField: React.FC<DynamicFormFieldProps> = ({
  tableName,
  recordId,
  onlyActive = true,
  onChange,
  readOnly = false,
}) => {
  const { message: messageApi } = App.useApp();
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(false);
  const [form] = useState(() => createForm());

  /**
   * 加载自定义字段
   */
  useEffect(() => {
    const loadFields = async () => {
      try {
        setLoading(true);
        const fieldList = await getCustomFieldsByTable(tableName, onlyActive);
        setFields(fieldList);
        
        // 如果有记录ID，加载字段值
        if (recordId) {
          const values = await getFieldValues(tableName, recordId);
          const formValues = fieldValuesToFormilyValues(fieldList, values);
          form.setValues(formValues);
        }
      } catch (error: any) {
        messageApi.error(error?.message || '加载自定义字段失败');
      } finally {
        setLoading(false);
      }
    };
    
    loadFields();
  }, [tableName, recordId, onlyActive, form, messageApi]);

  /**
   * 处理表单值变化
   */
  useEffect(() => {
    const dispose = form.onValuesChange((values) => {
      if (onChange) {
        const fieldValues = formilyValuesToFieldValues(fields, values);
        onChange(fieldValues);
      }
    });
    
    return () => {
      dispose();
    };
  }, [form, fields, onChange]);

  if (loading) {
    return <div>加载中...</div>;
  }

  if (fields.length === 0) {
    return null;
  }

  const schema = customFieldsToFormilySchema(fields);

  return (
    <FormProvider form={form}>
      <FormLayout labelCol={6} wrapperCol={18}>
        <SchemaField schema={schema} />
      </FormLayout>
      {!readOnly && recordId && (
        <FormConsumer>
          {() => (
            <div style={{ marginTop: 16 }}>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const values = form.values;
                    const fieldValues = formilyValuesToFieldValues(fields, values);
                    const valueRequests = fields.map((field) => ({
                      field_uuid: field.uuid,
                      value: fieldValues[field.code] || null,
                    }));
                    
                    await batchSetFieldValues({
                      record_id: recordId,
                      record_table: tableName,
                      values: valueRequests,
                    });
                    
                    messageApi.success('保存成功');
                  } catch (error: any) {
                    messageApi.error(error?.message || '保存失败');
                  }
                }}
              >
                保存自定义字段
              </button>
            </div>
          )}
        </FormConsumer>
      )}
    </FormProvider>
  );
};

export default DynamicFormField;


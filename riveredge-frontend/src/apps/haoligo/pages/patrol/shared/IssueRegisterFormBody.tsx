/**
 * 问题登记表单 01～04（用于新建/编辑问题 Modal）
 */

import React from 'react';
import { Radio, Spin, Typography } from 'antd';
import { ProForm, ProFormDateTimePicker, ProFormSelect, ProFormText } from '@ant-design/pro-components';
import type { DictionaryItem } from '../../../../../services/dataDictionary';
import { listEquipments, type WorkshopRow } from '../../../services/haoligo';

const { Text } = Typography;

function SectionLabel({ num, label }: { num: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
      <Text style={{ color: '#1677ff', fontWeight: 700, fontSize: 16, minWidth: 28 }}>{num}</Text>
      <Text style={{ fontWeight: 500, fontSize: 15 }}>{label}</Text>
    </div>
  );
}

function FieldLabel({ label }: { label: string }) {
  return (
    <Text style={{ fontWeight: 500, fontSize: 15, display: 'block', marginBottom: 8 }}>
      {label}
    </Text>
  );
}

export interface IssueRegisterFormBodyProps {
  workshops: WorkshopRow[];
  issueTypes: DictionaryItem[];
  dictLoading: boolean;
  userOptions: { label: string; value: number }[];
  readOnly?: boolean;
}

export const IssueRegisterFormBody: React.FC<IssueRegisterFormBodyProps> = ({
  workshops,
  issueTypes,
  dictLoading,
  userOptions,
  readOnly,
}) => (
  <>
    <div style={{ marginBottom: 12 }}>
      <SectionLabel num="01" label="车间名称" />
      <ProFormSelect
        name="workshop_id"
        rules={readOnly ? undefined : [{ required: true, message: '请选择车间' }]}
        placeholder="请选择"
        options={workshops.map((w) => ({ label: w.name, value: w.id }))}
        fieldProps={{ showSearch: true, optionFilterProp: 'label', disabled: readOnly }}
      />
    </div>
    <div style={{ marginBottom: 12 }}>
      <FieldLabel label="关联设备（可选）" />
      <ProFormSelect
        name="equipment_id"
        placeholder="请选择设备（可选）"
        fieldProps={{
          showSearch: true,
          filterOption: false,
          allowClear: true,
          disabled: readOnly,
        }}
        request={async ({ keyWords }) => {
          const res = await listEquipments({ keyword: keyWords || undefined, limit: 50 });
          return (res.items || []).map((e) => ({ label: `${e.asset_code} ${e.name}`, value: e.id }));
        }}
      />
    </div>
    <div style={{ marginBottom: 12 }}>
      <SectionLabel num="02" label="巡查时间" />
      <ProFormDateTimePicker
        name="reported_at"
        rules={readOnly ? undefined : [{ required: true, message: '请选择巡查时间' }]}
        placeholder="请选择"
        fieldProps={{ style: { width: '100%' }, format: 'YYYY-MM-DD HH:mm', disabled: readOnly }}
      />
    </div>
    <div style={{ marginBottom: 12 }}>
      <SectionLabel num="03" label="巡查区域" />
      <ProFormText
        name="workshop_area"
        placeholder="请输入"
        rules={readOnly ? undefined : [{ required: true, message: '请输入巡查区域' }]}
        fieldProps={{ disabled: readOnly }}
      />
    </div>
    <div style={{ marginBottom: 4 }}>
      <SectionLabel num="04" label="问题类型" />
      {dictLoading ? (
        <Spin />
      ) : (
        <ProForm.Item name="issue_type_code" rules={readOnly ? undefined : [{ required: true, message: '请选择问题类型' }]}>
          <Radio.Group disabled={readOnly} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {issueTypes.map((it) => (
              <Radio key={it.uuid} value={it.value} style={{ margin: 0, padding: '8px 12px', background: '#fafafa', borderRadius: 8 }}>
                {it.label}
              </Radio>
            ))}
          </Radio.Group>
        </ProForm.Item>
      )}
    </div>
    <div style={{ marginBottom: 12 }}>
      <FieldLabel label="登记人" />
      <ProFormSelect
        name="registrant_user_id"
        placeholder="请选择"
        options={userOptions}
        fieldProps={{ showSearch: true, optionFilterProp: 'label', disabled: readOnly }}
      />
    </div>
    <div style={{ marginBottom: 4 }}>
      <FieldLabel label="责任人" />
      <ProFormSelect
        name="responsible_user_id"
        placeholder="请选择（可选）"
        options={userOptions}
        fieldProps={{
          showSearch: true,
          optionFilterProp: 'label',
          allowClear: true,
          disabled: readOnly,
        }}
      />
    </div>
  </>
);

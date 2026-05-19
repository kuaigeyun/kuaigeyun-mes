/**
 * 问题登记表单 01～04（用于新建/编辑问题 Modal）
 */

import React, { useCallback } from 'react';
import { Checkbox, Col, Row, Spin, Typography, Upload } from 'antd';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import {
  ProForm,
  ProFormDateTimePicker,
  ProFormDependency,
  ProFormInstance,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
} from '@ant-design/pro-components';
import { getUserList } from '../../../../../services/user';
import { uploadFile, type FileUploadResponse } from '../../../../../services/file';
import type { DictionaryItem } from '../../../../../services/dataDictionary';
import { listEquipments, type WorkshopRow } from '../../../services/haoligo';
import { PatrolImagePreview } from './PatrolImagePreview';

const { Text } = Typography;

/** 与 SectionLabel 编号区同宽，保证并排字段标签、控件纵向对齐 */
const LABEL_NUM_SLOT_WIDTH = 28;
const LABEL_GAP = 10;
const LABEL_ROW_MIN_HEIGHT = 24;

function FormRowLabel({ num, label }: { num?: string; label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: LABEL_GAP,
        marginBottom: 8,
        minHeight: LABEL_ROW_MIN_HEIGHT,
      }}
    >
      <span
        style={{
          flex: `0 0 ${LABEL_NUM_SLOT_WIDTH}px`,
          width: LABEL_NUM_SLOT_WIDTH,
          fontSize: 16,
          fontWeight: 700,
          lineHeight: `${LABEL_ROW_MIN_HEIGHT}px`,
          color: num ? '#1677ff' : 'transparent',
          userSelect: 'none',
        }}
        aria-hidden={!num}
      >
        {num ?? '·'}
      </span>
      <Text style={{ fontWeight: 500, fontSize: 15, lineHeight: `${LABEL_ROW_MIN_HEIGHT}px` }}>{label}</Text>
    </div>
  );
}

function SectionLabel({ num, label }: { num: string; label: string }) {
  return <FormRowLabel num={num} label={label} />;
}

function FieldLabel({ label }: { label: string }) {
  return <FormRowLabel label={label} />;
}

const inlineFormItemProps = { style: { marginBottom: 0 } };

export interface IssueRegisterFormBodyProps {
  formRef: React.RefObject<ProFormInstance | null>;
  workshops: WorkshopRow[];
  issueTypes: DictionaryItem[];
  dictLoading: boolean;
  userOptions: { label: string; value: number }[];
  beforeFiles: UploadFile[];
  onBeforeFilesChange: (files: UploadFile[]) => void;
  readOnly?: boolean;
}

export const IssueRegisterFormBody: React.FC<IssueRegisterFormBodyProps> = ({
  formRef,
  workshops,
  issueTypes,
  dictLoading,
  userOptions,
  beforeFiles,
  onBeforeFilesChange,
  readOnly,
}) => {
  const searchReportNotifyUsers = useCallback(
    async (keyword?: string) => {
      const res = await getUserList({
        page: 1,
        page_size: 50,
        is_active: true,
        keyword: keyword?.trim() || undefined,
      });
      const opts = (res.items || []).map((u) => ({
        label: (u.full_name || '').trim() || u.username,
        value: u.id,
      }));
      const selIds = (formRef.current?.getFieldValue('report_notify_user_ids') as number[] | undefined) || [];
      for (const id of selIds) {
        if (Number.isFinite(id) && !opts.some((o) => o.value === id)) {
          opts.unshift({ value: id, label: `用户#${id}` });
        }
      }
      return opts;
    },
    [formRef],
  );

  const uploadProps: UploadProps = {
    listType: 'picture-card',
    accept: '.jpg,.jpeg,.png,.gif,.webp',
    fileList: beforeFiles,
    disabled: readOnly,
    onChange: ({ fileList }) => onBeforeFilesChange(fileList),
    customRequest: async (options) => {
      try {
        const file = options.file as File;
        const res: FileUploadResponse = await uploadFile(file, { category: 'haoligo_patrol_hazard' });
        options.onSuccess?.(res, options.file);
      } catch (e) {
        options.onError?.(e instanceof Error ? e : new Error(String(e)));
      }
    },
  };

  return (
    <>
      <Row gutter={16} align="top" style={{ marginBottom: 12 }}>
        <Col xs={24} sm={12} style={{ display: 'flex', flexDirection: 'column' }}>
          <SectionLabel num="01" label="车间名称" />
          <ProFormSelect
            name="workshop_id"
            formItemProps={inlineFormItemProps}
            rules={readOnly ? undefined : [{ required: true, message: '请选择车间' }]}
            placeholder="请选择"
            options={workshops.map((w) => ({ label: w.name, value: w.id }))}
            fieldProps={{ showSearch: true, optionFilterProp: 'label', disabled: readOnly }}
          />
        </Col>
        <Col xs={24} sm={12} style={{ display: 'flex', flexDirection: 'column' }}>
          <FieldLabel label="关联设备（可选）" />
          <ProFormSelect
            name="equipment_id"
            formItemProps={inlineFormItemProps}
            placeholder="请选择设备（可选）"
            fieldProps={{
              showSearch: true,
              filterOption: false,
              allowClear: true,
              disabled: readOnly,
            }}
            request={async ({ keyWords }) => {
              const res = await listEquipments({ keyword: keyWords || undefined, limit: 50 });
              return (res.items || []).map((e) => ({
                label: `${e.asset_code} ${e.name}`,
                value: e.id,
              }));
            }}
          />
        </Col>
      </Row>

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
          <ProForm.Item
            name="issue_type_codes"
            rules={
              readOnly
                ? undefined
                : [
                    {
                      required: true,
                      type: 'array',
                      min: 1,
                      message: '请至少选择一种问题类型',
                    },
                  ]
            }
          >
            <Checkbox.Group
              disabled={readOnly}
              style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
              options={issueTypes.map((it) => ({
                label: <span style={{ padding: '4px 0' }}>{it.label}</span>,
                value: it.value,
              }))}
            />
          </ProForm.Item>
        )}
      </div>

      <div style={{ marginTop: 12, marginBottom: 4 }}>
        <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
          上报
        </Typography.Text>
        <ProForm.Item label="现场图片">
          {readOnly ? (
            <PatrolImagePreview files={beforeFiles} />
          ) : (
            <Upload {...uploadProps}>+</Upload>
          )}
        </ProForm.Item>
        <ProFormSelect
          name="registrant_user_id"
          label="登记人"
          placeholder="请选择"
          options={userOptions}
          fieldProps={{ showSearch: true, optionFilterProp: 'label', disabled: readOnly }}
        />
        <ProFormSwitch
          name="report_enabled"
          label="是否上报"
          fieldProps={{
            disabled: readOnly,
            onChange: readOnly
              ? undefined
              : (checked: boolean) => {
                  if (!checked) {
                    formRef.current?.setFieldsValue({ report_notify_user_ids: [] });
                  }
                },
          }}
        />
        <ProFormDependency name={['report_enabled']}>
          {({ report_enabled: reportOn }) =>
            reportOn ? (
              readOnly ? (
                <ProFormDependency name={['report_notify_user_ids']}>
                  {({ report_notify_user_ids: notifyIds }) =>
                    Array.isArray(notifyIds) && notifyIds.length > 0 ? (
                      <ProForm.Item label="责任人">
                        <Text>
                          {notifyIds
                            .map(
                              (id: number) =>
                                userOptions.find((o) => o.value === id)?.label || `用户#${id}`,
                            )
                            .join('、')}
                        </Text>
                      </ProForm.Item>
                    ) : null
                  }
                </ProFormDependency>
              ) : (
                <ProFormSelect
                  name="report_notify_user_ids"
                  label="责任人"
                  mode="multiple"
                  showSearch
                  debounceTime={300}
                  rules={[{ required: true, message: '开启上报时请至少选择一名责任人' }]}
                  request={async ({ keyWords }) => searchReportNotifyUsers(keyWords)}
                  fieldProps={{
                    style: { width: '100%' },
                    placeholder: '搜索并选择责任人',
                    filterOption: false,
                  }}
                />
              )
            ) : null
          }
        </ProFormDependency>
      </div>
    </>
  );
};

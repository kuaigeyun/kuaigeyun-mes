/**
 * 问题登记表单 01～04（用于新建/编辑问题 Modal）
 */

import React, { useCallback, useState } from 'react';
import { App, Button, Checkbox, Col, Row, Space, Spin, Tag, Typography, Upload } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
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
import { uploadFile, type FileUploadResponse } from '../../../../../services/file';
import type { DictionaryItem } from '../../../../../services/dataDictionary';
import { listEquipments, listHaoligoNotifyUserOptions, type WorkshopRow } from '../../../services/haoligo';
import { withMoldPictureCardUploadClass } from '../../../utils/moldPictureCardUpload';
import { PatrolImagePreview } from './PatrolImagePreview';
import { FormNotifyUsersSelect } from '../../../components/FormNotifyUsersSelect';
import { PatrolOtherIssueModal } from './PatrolOtherIssueModal';
import {
  filterPatrolDictionaryIssueTypes,
  type PatrolCustomIssueItem,
} from './patrolIssueHelpers';

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
  const { message: messageApi } = App.useApp();
  const [otherModalOpen, setOtherModalOpen] = useState(false);
  const dictionaryIssueTypes = filterPatrolDictionaryIssueTypes(issueTypes);

  const searchReportNotifyUsers = useCallback(
    async (keyword?: string) => {
      const selIds = (formRef.current?.getFieldValue('report_notify_user_ids') as number[] | undefined) || [];
      const users = await listHaoligoNotifyUserOptions({
        keyword,
        limit: 80,
        selected_user_ids: selIds,
      });
      return users.map((u) => ({ label: u.label, value: u.id }));
    },
    [formRef],
  );

  const uploadProps: UploadProps = {
    ...withMoldPictureCardUploadClass({
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
    }),
  };

  const appendCustomIssue = (text: string, addToCommon: boolean) => {
    const current =
      (formRef.current?.getFieldValue('custom_issue_items') as PatrolCustomIssueItem[] | undefined) ?? [];
    if (current.some((item) => item.text === text)) {
      messageApi.warning('该问题已添加');
      return;
    }
    formRef.current?.setFieldsValue({
      custom_issue_items: [...current, { text, addToCommon }],
    });
  };

  const removeCustomIssue = (index: number) => {
    const current =
      (formRef.current?.getFieldValue('custom_issue_items') as PatrolCustomIssueItem[] | undefined) ?? [];
    formRef.current?.setFieldsValue({
      custom_issue_items: current.filter((_, i) => i !== index),
    });
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
            fieldProps={{
              showSearch: true,
              optionFilterProp: 'label',
              disabled: readOnly,
              onChange: () => {
                formRef.current?.setFieldsValue({ equipment_id: undefined });
              },
            }}
          />
        </Col>
        <Col xs={24} sm={12} style={{ display: 'flex', flexDirection: 'column' }}>
          <FieldLabel label="关联设备（可选）" />
          <ProFormDependency name={['workshop_id']}>
            {({ workshop_id: workshopId }) => (
              <ProFormSelect
                name="equipment_id"
                formItemProps={inlineFormItemProps}
                placeholder={workshopId ? '请选择设备（可选）' : '请先选择车间'}
                params={{ workshopId }}
                fieldProps={{
                  showSearch: true,
                  filterOption: false,
                  allowClear: true,
                  disabled: readOnly || !workshopId,
                }}
                request={async ({ keyWords }) => {
                  if (!workshopId) return [];
                  const res = await listEquipments({
                    workshop_id: workshopId,
                    keyword: keyWords || undefined,
                    limit: 50,
                  });
                  return (res.items || []).map((e) => ({
                    label: `${e.asset_code} ${e.name}`,
                    value: e.id,
                  }));
                }}
              />
            )}
          </ProFormDependency>
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
                      validator: async (_, value) => {
                        const selected = Array.isArray(value) ? value : [];
                        const custom =
                          (formRef.current?.getFieldValue('custom_issue_items') as PatrolCustomIssueItem[]) ??
                          [];
                        if (!selected.length && !custom.length) {
                          throw new Error('请至少选择一种问题类型，或添加其他问题');
                        }
                      },
                    },
                  ]
            }
          >
            <Checkbox.Group
              disabled={readOnly}
              style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
              options={dictionaryIssueTypes.map((it) => ({
                label: <span style={{ padding: '4px 0' }}>{it.label}</span>,
                value: it.value,
              }))}
            />
          </ProForm.Item>
        )}

        <div style={{ marginTop: 8 }}>
          <FieldLabel label="其他问题" />
          <ProForm.Item name="custom_issue_items" initialValue={[]} hidden>
            <input type="hidden" />
          </ProForm.Item>
          <ProFormDependency name={['custom_issue_items']}>
            {({ custom_issue_items: customItems }) => {
              const items = (customItems as PatrolCustomIssueItem[] | undefined) ?? [];
              return (
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  {items.length ? (
                    <Space wrap size={[8, 8]}>
                      {items.map((item, index) => (
                        <Tag
                          key={`${item.text}-${index}`}
                          closable={!readOnly}
                          onClose={readOnly ? undefined : () => removeCustomIssue(index)}
                        >
                          {item.text}
                          {item.addToCommon ? ' · 常见问题' : ''}
                        </Tag>
                      ))}
                    </Space>
                  ) : readOnly ? (
                    <Text type="secondary">—</Text>
                  ) : null}
                  {!readOnly ? (
                    <Button
                      type="dashed"
                      icon={<PlusOutlined />}
                      onClick={() => setOtherModalOpen(true)}
                      style={{ width: 'fit-content' }}
                    >
                      其他问题
                    </Button>
                  ) : null}
                </Space>
              );
            }}
          </ProFormDependency>
        </div>
      </div>

      <PatrolOtherIssueModal
        open={otherModalOpen}
        onClose={() => setOtherModalOpen(false)}
        onConfirm={appendCustomIssue}
      />

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
              <FormNotifyUsersSelect readonly={readOnly} searchUsers={searchReportNotifyUsers} />
            ) : null
          }
        </ProFormDependency>
      </div>
    </>
  );
};

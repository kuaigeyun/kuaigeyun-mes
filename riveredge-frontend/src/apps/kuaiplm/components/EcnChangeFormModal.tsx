/**
 * 工程变更（ECN）新建/编辑弹窗 — 物料列与头勾选项由 form-profile 驱动
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ProFormInstance,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Col, Form as AntForm, Input, InputNumber, Row, Select } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { FormModalTemplate } from '../../../components/layout-templates';
import { UniTableDetail } from '../../../components/uni-table-detail';
import { getApiErrorMessage } from '../../../utils/errorHandler';
import Phase2ProjectSelect from './Phase2ProjectSelect';
import {
  engineeringChangeApi,
  type EcnChangeKind,
  type EcnFormProfile,
  type EngineeringChange,
} from '../services/engineering-change';
import { isIndustryFormProfileActive } from '../../../utils/industryFormProfile';
import {
  buildHeaderExtensionPayload,
  flattenMaterialLineForForm,
  mergeHeaderExtensionIntoForm,
  prepareMaterialLineForApi,
  resolveEcnFieldLabel,
  sortedHeaderFields,
  sortedMaterialColumns,
  type EcnProfileColumn,
  type EcnProfileHeaderField,
} from '../utils/ecnFormProfile';

function renderEcnHeaderField(field: EcnProfileHeaderField) {
  const span = field.type === 'textarea' ? 24 : 12;
  return (
    <Col span={span} key={field.key}>
      {field.type === 'textarea' ? (
        <ProFormTextArea name={field.key} label={field.label} />
      ) : (
        <ProFormText name={field.key} label={field.label} />
      )}
    </Col>
  );
}

const KIND_KEYS: EcnChangeKind[] = ['material', 'process', 'drawing', 'doc_template', 'other'];
const DISPOSITION_KEYS = ['scrap', 'use_up', 'rework', 'return', 'other'];

export interface EcnChangeFormModalProps {
  open: boolean;
  editing?: EngineeringChange | null;
  projectId?: number;
  onClose: () => void;
  onSuccess: () => void;
}

function buildEmptyMaterialRow(columns: EcnProfileColumn[]): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const col of columns) {
    row[col.key] = col.type === 'decimal' ? undefined : '';
  }
  if (row.material_code === undefined) row.material_code = '';
  if (row.material_name === undefined) row.material_name = '';
  return row;
}

function renderMaterialCell(
  col: EcnProfileColumn,
  index: number,
  t: (key: string, opts?: { defaultValue?: string }) => string,
) {
  const fieldKey = col.key;
  const required = col.required;
  const rules = required ? [{ required: true, message: t('common.required') }] : undefined;

  if (fieldKey === 'disposition') {
    return (
      <AntForm.Item name={[index, fieldKey]} rules={rules} style={{ marginBottom: 0 }}>
        <Select
          allowClear
          size="small"
          style={{ width: '100%' }}
          options={DISPOSITION_KEYS.map((k) => ({
            value: k,
            label: t(`app.kuaiplm.ecn.disposition.${k}`),
          }))}
        />
      </AntForm.Item>
    );
  }

  if (col.type === 'decimal' || fieldKey === 'owner_user_id') {
    return (
      <AntForm.Item name={[index, fieldKey]} rules={rules} style={{ marginBottom: 0 }}>
        <InputNumber size="small" style={{ width: '100%' }} />
      </AntForm.Item>
    );
  }

  return (
    <AntForm.Item name={[index, fieldKey]} rules={rules} style={{ marginBottom: 0 }}>
      <Input size="small" />
    </AntForm.Item>
  );
}

const EcnChangeFormModal: React.FC<EcnChangeFormModalProps> = ({
  open,
  editing,
  projectId,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const formRef = useRef<ProFormInstance | undefined>(undefined);
  const [formProfile, setFormProfile] = useState<EcnFormProfile | null>(null);

  const kindLabel = (s: string) => t(`app.kuaiplm.ecn.changeKind.${s}`, { defaultValue: s });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void engineeringChangeApi
      .formProfile()
      .then((p) => {
        if (!cancelled) setFormProfile(p);
      })
      .catch((e) => {
        if (!cancelled) messageApi.error(getApiErrorMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, [open, messageApi]);

  const industryActive = isIndustryFormProfileActive(formProfile);
  const materialColumns = useMemo(
    () => sortedMaterialColumns(formProfile, industryActive),
    [formProfile, industryActive],
  );

  const lineColumns = useMemo<ColumnsType>(
    () =>
      materialColumns.map((col) => ({
        title: col.label,
        dataIndex: col.key,
        width: col.width || 110,
        render: (_: unknown, __: unknown, index: number) => renderMaterialCell(col, index, t),
      })),
    [materialColumns, t],
  );

  const headerFields = useMemo(
    () => sortedHeaderFields(formProfile, industryActive),
    [formProfile, industryActive],
  );

  const headerFlags = useMemo(
    () =>
      industryActive
        ? [...(formProfile?.header_option_flags || [])].sort(
            (a, b) => (a.sort ?? 0) - (b.sort ?? 0),
          )
        : [],
    [formProfile, industryActive],
  );

  const initialValues = useMemo(() => {
    const emptyRow = buildEmptyMaterialRow(materialColumns);
    if (editing) {
      return {
        project_id: editing.project_id,
        change_kind: editing.change_kind,
        title: editing.title,
        change_reason: editing.change_reason,
        remarks: editing.remarks,
        ...mergeHeaderExtensionIntoForm(editing),
        entry_source:
          (editing.extension_payload?.entry_source as string | undefined) || 'engineering_change',
        materials: editing.materials?.length
          ? editing.materials.map((m) => flattenMaterialLineForForm(m))
          : [emptyRow],
      };
    }
    return {
      project_id: projectId,
      change_kind: 'material',
      entry_source: 'engineering_change',
      materials: [emptyRow],
    };
  }, [editing, materialColumns, projectId]);

  const entrySourceOptions = useMemo(
    () =>
      industryActive && formProfile?.entry_sources?.length
        ? [...formProfile.entry_sources]
            .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
            .map((item) => ({
              value: item.code,
              label: item.label || item.code,
            }))
        : [],
    [formProfile, industryActive],
  );

  useEffect(() => {
    if (!open) return;
    formRef.current?.setFieldsValue(initialValues);
  }, [open, editing?.uuid, formProfile, initialValues]);

  return (
    <FormModalTemplate
      key={editing?.uuid ?? 'create-ecn'}
      title={editing ? t('common.edit') : t('app.kuaiplm.change.createEcnButton')}
      open={open}
      onClose={onClose}
      formRef={formRef}
      grid={false}
      width={formProfile?.material_line_columns?.length ? 1180 : 980}
      initialValues={initialValues}
      onFinish={async (values) => {
        try {
          const cleanMaterials = ((values.materials || []) as Record<string, unknown>[])
            .filter((m) => m?.material_code && m?.material_name)
            .map((m) =>
              industryActive ? prepareMaterialLineForApi(m, materialColumns) : m,
            );
          if (!cleanMaterials.length) {
            messageApi.error(t('app.kuaiplm.ecn.messages.materialRequired'));
            throw new Error('material required');
          }
          const headerPayload = buildHeaderExtensionPayload(values, formProfile, industryActive) || {};
          const entrySource = values.entry_source
            ? String(values.entry_source).trim()
            : '';
          const extension_payload =
            entrySource || Object.keys(headerPayload).length
              ? {
                  ...headerPayload,
                  ...(entrySource ? { entry_source: entrySource } : {}),
                }
              : null;
          const payload = {
            project_id: values.project_id ? Number(values.project_id) : null,
            change_kind: values.change_kind,
            title: String(values.title || '').trim(),
            change_reason: values.change_reason || null,
            remarks: values.remarks || null,
            extension_payload,
            materials: cleanMaterials,
          };
          if (editing?.id) {
            await engineeringChangeApi.update(editing.id, payload);
          } else {
            await engineeringChangeApi.create(payload);
          }
          messageApi.success(t('common.saveSuccess'));
          onSuccess();
          onClose();
        } catch (e) {
          messageApi.error(getApiErrorMessage(e));
          throw e;
        }
      }}
    >
      <Row gutter={16}>
        <Col span={8}>
          <Phase2ProjectSelect
            name="project_id"
            label={t('app.kuaiplm.ecn.fields.project')}
            disabled={!!editing}
          />
        </Col>
        <Col span={entrySourceOptions.length ? 8 : 12}>
          <ProFormSelect
            name="change_kind"
            label={t('app.kuaiplm.ecn.fields.changeKind')}
            rules={[{ required: true }]}
            disabled={!!editing}
            options={KIND_KEYS.map((k) => ({ value: k, label: kindLabel(k) }))}
          />
        </Col>
        {entrySourceOptions.length ? (
          <Col span={8}>
            <ProFormSelect
              name="entry_source"
              label={t('app.kuaiplm.ecn.fields.entrySource')}
              rules={[{ required: true }]}
              disabled={!!editing}
              options={entrySourceOptions}
            />
          </Col>
        ) : null}
        <Col span={entrySourceOptions.length ? 8 : 12}>
          <ProFormText
            name="title"
            label={t('app.kuaiplm.ecn.fields.title')}
            rules={[{ required: true }]}
          />
        </Col>
        <Col span={24}>
          <ProFormTextArea
            name="change_reason"
            label={resolveEcnFieldLabel(
              formProfile,
              'change_reason',
              t('app.kuaiplm.ecn.fields.changeReason'),
            )}
          />
        </Col>
        {headerFields.map((field) => renderEcnHeaderField(field))}
        {headerFlags.map((flag) => {
          const key = String(flag.key);
          const label = String(flag.label || key);
          if (flag.type === 'boolean') {
            return (
              <Col span={12} key={key}>
                <ProFormSwitch name={key} label={label} />
              </Col>
            );
          }
          return (
            <Col span={12} key={key}>
              <ProFormText name={key} label={label} />
            </Col>
          );
        })}
      </Row>
      <UniTableDetail
        name="materials"
        title={t('app.kuaiplm.ecn.fields.materials')}
        required
        requiredMessage={t('app.kuaiplm.ecn.messages.materialRequired')}
        columns={lineColumns}
        initialValue={buildEmptyMaterialRow(materialColumns)}
        minRows={1}
        tableProps={{
          scroll: { x: materialColumns.reduce((sum, c) => sum + (c.width || 110), 0) },
        }}
      />
      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={24}>
          <ProFormTextArea name="remarks" label={t('common.remark')} />
        </Col>
      </Row>
    </FormModalTemplate>
  );
};

export default EcnChangeFormModal;

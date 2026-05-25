/**
 * 好力 GO — 点检项（点检参数主数据）
 *
 * 与制造厂商页同一模板：ListPageTemplate + UniTable + FormModalTemplate。
 * 业务约定：编码全局唯一；取值类型决定现场录入形态（数值 / 文本 / 是否 / 多选）。
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProFormInstance,
  ProFormDependency,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Modal, Space, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import { DeleteOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import {
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  ListPageTemplate,
  FormModalTemplate,
  FORM_LAYOUT,
  MODAL_CONFIG,
} from '../../../../../components/layout-templates';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import {
  createInspectionParam,
  deleteInspectionParam,
  listInspectionParams,
  updateInspectionParam,
  type InspectionParamCreatePayload,
  type InspectionParamRow,
} from '../../../services/haoligo';
import { batchImport } from '../../../../../utils/batchOperations';
import {
  formatMultiselectMeasuredValue,
  normalizeInspectionValueType,
  parseMultiselectMeasuredValue,
  type InspectionValueTypeKey,
} from '../../../utils/inspectionParamValueType';
import { formatNumericRangeLabel } from '../../../utils/inspectionNumericRange';

const InspectionParamsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(undefined);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<InspectionParamRow | null>(null);

  const valueTypes = useMemo(
    () => [
      { label: t('app.haoligo.equipment.inspectionParams.valueTypeNumeric'), value: 'numeric' },
      { label: t('app.haoligo.equipment.inspectionParams.valueTypeText'), value: 'text' },
      { label: t('app.haoligo.equipment.inspectionParams.valueTypeBoolean'), value: 'boolean' },
      { label: t('app.haoligo.equipment.inspectionParams.valueTypeMultiselect'), value: 'multiselect' },
    ],
    [t],
  );

  const valueTypeLabel = useMemo(
    () => ({
      numeric: t('app.haoligo.equipment.inspectionParams.valueTypeNumeric'),
      text: t('app.haoligo.equipment.inspectionParams.valueTypeText'),
      boolean: t('app.haoligo.equipment.inspectionParams.valueTypeBoolean'),
      multiselect: t('app.haoligo.equipment.inspectionParams.valueTypeMultiselect'),
    }),
    [t],
  );

  const valueTypeValueEnum = useMemo(
    () => ({
      numeric: { text: t('app.haoligo.equipment.inspectionParams.valueTypeNumeric') },
      text: { text: t('app.haoligo.equipment.inspectionParams.valueTypeText') },
      boolean: { text: t('app.haoligo.equipment.inspectionParams.valueTypeBoolean') },
      multiselect: { text: t('app.haoligo.equipment.inspectionParams.valueTypeMultiselect') },
    }),
    [t],
  );

  const handleCreate = () => {
    setIsEdit(false);
    setEditId(null);
    setFormInitialValues({ value_type: 'numeric' });
    setModalVisible(true);
  };

  useNewShortcut(handleCreate);

  const handleDetail = (record: InspectionParamRow) => {
    setDetailRecord(record);
    setDetailOpen(true);
  };

  const handleEdit = (record: InspectionParamRow) => {
    setIsEdit(true);
    setEditId(record.id);
    setFormInitialValues({
      code: record.code,
      name: record.name,
      requirement: record.requirement ?? '',
      unit: record.unit ?? '',
      value_type: normalizeInspectionValueType(record.value_type),
      default_value:
        normalizeInspectionValueType(record.value_type) === 'multiselect'
          ? parseMultiselectMeasuredValue(record.default_value)
          : (record.default_value ?? undefined),
      numeric_min: record.numeric_min ?? undefined,
      numeric_max: record.numeric_max ?? undefined,
    });
    setModalVisible(true);
  };

  const handleDeleteOne = (record: InspectionParamRow) => {
    Modal.confirm({
      title: t('app.haoligo.equipment.inspectionParams.deleteTitle'),
      content: t('app.haoligo.equipment.inspectionParams.deleteContent', { name: record.name, code: record.code }),
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteInspectionParam(record.id);
          messageApi.success(t('app.haoligo.equipment.deleteSuccess'));
          actionRef.current?.reload();
        } catch (e) {
          messageApi.error((e as Error).message || t('app.haoligo.equipment.deleteFailed'));
        }
      },
    });
  };

  const normalizeDefaultValue = (values: Record<string, unknown>): string | null => {
    const vt = normalizeInspectionValueType(String(values.value_type ?? 'numeric'));
    const raw = values.default_value;
    if (raw == null || raw === '') return null;
    if (vt === 'multiselect') {
      if (Array.isArray(raw)) {
        return formatMultiselectMeasuredValue(raw.map(String));
      }
      return formatMultiselectMeasuredValue(parseMultiselectMeasuredValue(String(raw)));
    }
    return String(raw).trim() || null;
  };

  const normalizeNumericBound = (raw: unknown): number | null => {
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  const buildPayload = (values: Record<string, unknown>): InspectionParamCreatePayload => {
    const value_type = normalizeInspectionValueType(String(values.value_type ?? 'numeric'));
    const lo = normalizeNumericBound(values.numeric_min);
    const hi = normalizeNumericBound(values.numeric_max);
    if (lo != null && hi != null && lo > hi) {
      throw new Error(t('app.haoligo.equipment.inspectionParams.formNumericRangeInvalid'));
    }
    return {
      code: String(values.code ?? '').trim(),
      name: String(values.name ?? '').trim(),
      requirement: String(values.requirement ?? '').trim() || null,
      unit: String(values.unit ?? '').trim() || null,
      value_type,
      default_value: normalizeDefaultValue(values),
      numeric_min: value_type === 'numeric' ? lo : null,
      numeric_max: value_type === 'numeric' ? hi : null,
    };
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    setFormLoading(true);
    try {
      if (isEdit && editId != null) {
        const payload = buildPayload(values);
        await updateInspectionParam(editId, {
          name: payload.name,
          requirement: payload.requirement,
          unit: payload.unit,
          value_type: payload.value_type,
          default_value: payload.default_value,
          numeric_min: payload.numeric_min,
          numeric_max: payload.numeric_max,
        });
        messageApi.success(t('app.haoligo.equipment.updateSuccess'));
      } else {
        await createInspectionParam(buildPayload(values));
        messageApi.success(t('app.haoligo.equipment.createSuccess'));
      }
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (e) {
      messageApi.error((e as Error).message || t('app.haoligo.equipment.saveFailed'));
      throw e;
    } finally {
      setFormLoading(false);
    }
  };

  const detailColumns: ProDescriptionsItemProps<InspectionParamRow>[] = useMemo(
    () => [
      { title: t('app.haoligo.equipment.inspectionParams.colCode'), dataIndex: 'code' },
      { title: t('app.haoligo.equipment.inspectionParams.colName'), dataIndex: 'name' },
      {
        title: t('app.haoligo.equipment.inspectionParams.colRequirement'),
        dataIndex: 'requirement',
        render: (_, r) => r.requirement || '—',
      },
      { title: t('app.haoligo.equipment.inspectionParams.colUnit'), dataIndex: 'unit', render: (_, r) => r.unit || '—' },
      {
        title: t('app.haoligo.equipment.inspectionParams.colValueType'),
        dataIndex: 'value_type',
        render: (_, r) => valueTypeLabel[normalizeInspectionValueType(r.value_type)] || r.value_type,
      },
      {
        title: t('app.haoligo.equipment.inspectionParams.colNumericRange'),
        dataIndex: 'numeric_min',
        render: (_, r) => {
          if (normalizeInspectionValueType(r.value_type) !== 'numeric') return '—';
          const label = formatNumericRangeLabel(r.numeric_min, r.numeric_max);
          return label || '—';
        },
      },
      {
        title: t('app.haoligo.equipment.inspectionParams.colDefaultValue'),
        dataIndex: 'default_value',
        render: (_, r) => {
          if (r.default_value == null || r.default_value === '') return '—';
          if (normalizeInspectionValueType(r.value_type) === 'boolean') {
            return r.default_value === 'true'
              ? t('app.haoligo.equipment.inspectionParams.defaultBoolYes')
              : t('app.haoligo.equipment.inspectionParams.defaultBoolNo');
          }
          if (normalizeInspectionValueType(r.value_type) === 'multiselect') {
            const parts = parseMultiselectMeasuredValue(r.default_value);
            return parts.length ? parts.join('、') : '—';
          }
          return r.default_value;
        },
      },
    ],
    [t, valueTypeLabel],
  );

  const columns: ProColumns<InspectionParamRow>[] = useMemo(
    () => [
      { title: t('app.haoligo.equipment.inspectionParams.colCode'), dataIndex: 'code', width: 120, ellipsis: true, fixed: 'left' },
      { title: t('app.haoligo.equipment.inspectionParams.colName'), dataIndex: 'name', width: 160, ellipsis: true },
      {
        title: t('app.haoligo.equipment.inspectionParams.colRequirement'),
        dataIndex: 'requirement',
        width: 200,
        ellipsis: true,
        hideInSearch: true,
        render: (_, r) => r.requirement || '—',
      },
      { title: t('app.haoligo.equipment.inspectionParams.colUnit'), dataIndex: 'unit', width: 88, ellipsis: true, hideInSearch: true },
      {
        title: t('app.haoligo.equipment.inspectionParams.colValueType'),
        dataIndex: 'value_type',
        width: 100,
        valueType: 'select',
        valueEnum: valueTypeValueEnum,
        render: (_, r) => <Tag>{valueTypeLabel[normalizeInspectionValueType(r.value_type)] || r.value_type}</Tag>,
      },
      {
        title: t('app.haoligo.equipment.inspectionParams.colDefaultValue'),
        dataIndex: 'default_value',
        width: 120,
        ellipsis: true,
        hideInSearch: true,
        render: (_, r) => {
          if (r.default_value == null || r.default_value === '') return '—';
          if (normalizeInspectionValueType(r.value_type) === 'boolean') {
            return r.default_value === 'true'
              ? t('app.haoligo.equipment.inspectionParams.defaultBoolYes')
              : t('app.haoligo.equipment.inspectionParams.defaultBoolNo');
          }
          if (normalizeInspectionValueType(r.value_type) === 'multiselect') {
            const parts = parseMultiselectMeasuredValue(r.default_value);
            return parts.length ? parts.join('、') : '—';
          }
          return r.default_value;
        },
      },
      {
        title: t('app.haoligo.equipment.ledger.colActions'),
        valueType: 'option',
        width: 200,
        fixed: 'right',
        render: (_, record) => (
          <Space>
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail(record)}>
              {t('common.detail')}
            </Button>
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
              {t('app.haoligo.equipment.inspectionParams.actionEdit')}
            </Button>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteOne(record)}>
              {t('app.haoligo.equipment.inspectionParams.actionDelete')}
            </Button>
          </Space>
        ),
      },
    ],
    [t, valueTypeLabel, valueTypeValueEnum],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<InspectionParamRow>
          headerTitle={t('app.haoligo.equipment.inspectionParams.title')}
          columnPersistenceId="apps.haoligo.pages.equipment.inspection-params"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          showCreateButton
          createButtonText={t('app.haoligo.equipment.ledger.createBtn')}
          onCreate={handleCreate}
          showImportButton
          importHeaders={[
            t('app.haoligo.equipment.inspectionParams.importColCode'),
            t('app.haoligo.equipment.inspectionParams.importColName'),
            t('app.haoligo.equipment.inspectionParams.importColRequirement'),
            t('app.haoligo.equipment.inspectionParams.importColUnit'),
            t('app.haoligo.equipment.inspectionParams.importColValueType'),
            t('app.haoligo.equipment.inspectionParams.importColDefaultValue'),
          ]}
          onImport={async (data) => {
            if (!data || data.length < 2) {
              messageApi.warning(t('app.haoligo.equipment.importEmpty'));
              return;
            }
            const headers = (data[0] || []).map((h: unknown) => String(h ?? '').trim());
            const getIdx = (...keys: string[]) => {
              for (const k of keys) {
                const i = headers.findIndex(
                  (h: string) => h.includes(k) || h.replace(/\*/g, '').toLowerCase().includes(k.toLowerCase()),
                );
                if (i >= 0) return i;
              }
              return -1;
            };
            const codeIdx = getIdx('点检编号', '参数编码', '编码', 'code');
            const nameIdx = getIdx('点检项名称', '参数名称', '名称', 'name');
            const reqIdx = getIdx('点检要求', 'requirement');
            const unitIdx = getIdx('单位', 'unit');
            const vtIdx = getIdx('取值类型', '类型', 'value_type');
            const dvIdx = getIdx('默认值', 'default');
            if (codeIdx < 0 || nameIdx < 0) {
              messageApi.error(t('app.haoligo.equipment.inspectionParams.importErrorHeaders'));
              return;
            }
            const items: InspectionParamCreatePayload[] = [];
            for (let i = 1; i < data.length; i++) {
              const row = data[i] as unknown[];
              if (!row || row.length === 0) continue;
              const code = String(row[codeIdx] ?? '').trim();
              const name = String(row[nameIdx] ?? '').trim();
              if (!code || !name) continue;
              const rawVt = vtIdx >= 0 ? String(row[vtIdx] ?? '').trim().toLowerCase() : '';
              let value_type = 'numeric';
              if (rawVt.includes('文本') || rawVt === 'text') value_type = 'text';
              else if (rawVt.includes('是否') || rawVt === 'bool' || rawVt === 'boolean') value_type = 'boolean';
              else if (rawVt.includes('多选') || rawVt === 'multiselect' || rawVt === 'multi') value_type = 'multiselect';
              else if (rawVt.includes('数值') || rawVt === 'numeric' || rawVt === 'number') value_type = 'numeric';
              const defaultRaw = dvIdx >= 0 ? String(row[dvIdx] ?? '').trim() : '';
              let default_value: string | null = defaultRaw || null;
              if (default_value && value_type === 'boolean') {
                const dl = default_value.toLowerCase();
                if (dl.includes('是') || dl === 'true' || dl === '1' || dl === 'yes') default_value = 'true';
                else if (dl.includes('否') || dl === 'false' || dl === '0' || dl === 'no') default_value = 'false';
              }
              items.push({
                code,
                name,
                requirement: reqIdx >= 0 ? String(row[reqIdx] ?? '').trim() || null : null,
                unit: unitIdx >= 0 ? String(row[unitIdx] ?? '').trim() || null : null,
                value_type,
                default_value,
              });
            }
            if (items.length === 0) {
              messageApi.warning(t('app.haoligo.equipment.importNoRows'));
              return;
            }
            const result = await batchImport({
              items,
              importFn: async (item) => createInspectionParam(item),
              title: t('app.haoligo.equipment.inspectionParams.importTitle'),
              concurrency: 5,
            });
            if (result.successCount > 0) {
              messageApi.success(t('app.haoligo.equipment.importSuccess', { count: result.successCount }));
              actionRef.current?.reload();
            }
            if (result.failureCount > 0) {
              messageApi.warning(t('app.haoligo.equipment.importPartialFail', { count: result.failureCount }));
            }
          }}
          showSyncButton
          onSync={() => {
            messageApi.info(t('app.haoligo.equipment.inspectionParams.syncInfo'));
            actionRef.current?.reload();
          }}
          request={async (params, _sort, _filter, searchFormValues) => {
            const current = params.current ?? 1;
            const pageSize = params.pageSize ?? 20;
            try {
              const all = await listInspectionParams();
              const codeQ = String(searchFormValues?.code ?? '').trim().toLowerCase();
              const nameQ = String(searchFormValues?.name ?? '').trim().toLowerCase();
              const vtQ = searchFormValues?.value_type as InspectionValueTypeKey | undefined;
              let rows = all;
              if (codeQ) rows = rows.filter((r) => r.code.toLowerCase().includes(codeQ));
              if (nameQ) rows = rows.filter((r) => r.name.toLowerCase().includes(nameQ));
              if (vtQ) rows = rows.filter((r) => normalizeInspectionValueType(r.value_type) === vtQ);
              const start = (current - 1) * pageSize;
              return {
                data: rows.slice(start, start + pageSize),
                success: true,
                total: rows.length,
              };
            } catch (e) {
              messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          scroll={{ x: 1180 }}
        />
      </ListPageTemplate>

      <FormModalTemplate
        key={modalVisible ? (isEdit ? `edit-${editId}` : 'create') : 'closed'}
        title={isEdit ? t('app.haoligo.equipment.inspectionParams.modalEdit') : t('app.haoligo.equipment.inspectionParams.modalCreate')}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setEditId(null);
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        initialValues={formInitialValues}
        loading={formLoading}
        grid
        onValuesChange={(changed) => {
          if ('value_type' in changed) {
            formRef.current?.setFieldsValue({
              default_value: undefined,
              numeric_min: undefined,
              numeric_max: undefined,
            });
          }
        }}
      >
        <ProFormText
          name="code"
          label={t('app.haoligo.equipment.inspectionParams.formCode')}
          placeholder={t('app.haoligo.equipment.inspectionParams.formCodePh')}
          disabled={isEdit}
          colProps={{ span: FORM_LAYOUT.FULL_COL_SPAN }}
          rules={[{ required: true, message: t('app.haoligo.equipment.inspectionParams.formCodeReq') }]}
        />
        <ProFormText
          name="name"
          label={t('app.haoligo.equipment.inspectionParams.formName')}
          placeholder={t('app.haoligo.equipment.inspectionParams.formNamePh')}
          colProps={{ span: FORM_LAYOUT.FULL_COL_SPAN }}
          rules={[{ required: true, message: t('app.haoligo.equipment.inspectionParams.formNameReq') }]}
        />
        <ProFormTextArea
          name="requirement"
          label={t('app.haoligo.equipment.inspectionParams.formRequirement')}
          placeholder={t('app.haoligo.equipment.inspectionParams.formRequirementPh')}
          colProps={{ span: FORM_LAYOUT.FULL_COL_SPAN }}
          fieldProps={{ rows: 2, showCount: true, maxLength: 500 }}
        />
        <ProFormText
          name="unit"
          label={t('app.haoligo.equipment.inspectionParams.formUnit')}
          placeholder={t('app.haoligo.equipment.inspectionParams.formUnitPh')}
          colProps={{ span: FORM_LAYOUT.FULL_COL_SPAN }}
        />
        <ProFormSelect
          name="value_type"
          label={t('app.haoligo.equipment.inspectionParams.formValueType')}
          placeholder={t('app.haoligo.equipment.inspectionParams.formValueTypePh')}
          options={valueTypes}
          colProps={{ span: FORM_LAYOUT.FULL_COL_SPAN }}
          rules={[{ required: true, message: t('app.haoligo.equipment.inspectionParams.formValueTypeReq') }]}
          fieldProps={{
            optionFilterProp: 'label',
            style: { width: '100%' },
            listHeight: 256,
          }}
        />
        <ProFormDependency name={['value_type']}>
          {({ value_type }) => {
            const vt = normalizeInspectionValueType(String(value_type ?? 'numeric'));
            const fullCol = { span: FORM_LAYOUT.FULL_COL_SPAN };
            const thirdCol = { span: 8 };
            const digitFieldProps = { stringMode: true as const, style: { width: '100%' } };
            if (vt === 'boolean') {
              return (
                <ProFormSelect
                  name="default_value"
                  label={t('app.haoligo.equipment.inspectionParams.formDefaultValue')}
                  placeholder={t('app.haoligo.equipment.inspectionParams.formDefaultValuePh')}
                  colProps={fullCol}
                  allowClear
                  options={[
                    { label: t('app.haoligo.equipment.inspectionParams.defaultBoolYes'), value: 'true' },
                    { label: t('app.haoligo.equipment.inspectionParams.defaultBoolNo'), value: 'false' },
                  ]}
                />
              );
            }
            if (vt === 'numeric') {
              return (
                <>
                  <ProFormDigit
                    name="numeric_min"
                    label={t('app.haoligo.equipment.inspectionParams.formNumericMin')}
                    placeholder={t('app.haoligo.equipment.inspectionParams.formNumericMinPh')}
                    colProps={thirdCol}
                    fieldProps={digitFieldProps}
                  />
                  <ProFormDigit
                    name="numeric_max"
                    label={t('app.haoligo.equipment.inspectionParams.formNumericMax')}
                    placeholder={t('app.haoligo.equipment.inspectionParams.formNumericMaxPh')}
                    colProps={thirdCol}
                    fieldProps={digitFieldProps}
                    rules={[
                      ({ getFieldValue }) => ({
                        validator: async (_, value) => {
                          const lo = getFieldValue('numeric_min');
                          if (value == null || value === '' || lo == null || lo === '') return;
                          if (Number(lo) > Number(value)) {
                            throw new Error(t('app.haoligo.equipment.inspectionParams.formNumericRangeInvalid'));
                          }
                        },
                      }),
                    ]}
                  />
                  <ProFormDigit
                    name="default_value"
                    label={t('app.haoligo.equipment.inspectionParams.formDefaultValue')}
                    placeholder={t('app.haoligo.equipment.inspectionParams.formDefaultValueNumericPh')}
                    colProps={thirdCol}
                    fieldProps={digitFieldProps}
                  />
                </>
              );
            }
            if (vt === 'multiselect') {
              return (
                <ProFormSelect
                  name="default_value"
                  label={t('app.haoligo.equipment.inspectionParams.formDefaultValue')}
                  placeholder={t('app.haoligo.equipment.inspectionParams.formDefaultValueMultiselectPh')}
                  colProps={fullCol}
                  allowClear
                  fieldProps={{
                    mode: 'tags',
                    tokenSeparators: [',', '，'],
                    style: { width: '100%' },
                  }}
                />
              );
            }
            if (vt === 'text') {
              return (
                <ProFormText
                  name="default_value"
                  label={t('app.haoligo.equipment.inspectionParams.formDefaultValue')}
                  placeholder={t('app.haoligo.equipment.inspectionParams.formDefaultValueTextPh')}
                  colProps={fullCol}
                  allowClear
                />
              );
            }
            return null;
          }}
        </ProFormDependency>
      </FormModalTemplate>

      <DetailDrawerTemplate
        title={
          detailRecord
            ? `${t('common.detail')} · ${detailRecord.code}`
            : t('app.haoligo.equipment.inspectionParams.title')
        }
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailRecord(null);
        }}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        dataSource={detailRecord}
        columns={detailColumns}
      />
    </>
  );
};

export default InspectionParamsPage;

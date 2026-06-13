/**
 * 好力 GO — 点检项（点检参数主数据）
 *
 * 与制造厂商页同一模板：ListPageTemplate + UniTable + FormModalTemplate。
 * 业务约定：编码全局唯一；取值类型决定现场录入形态（数值 / 文本 / 是否 / 多选）。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
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
import { App, Button, Form, Modal, Select, Space, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import { DeleteOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ThemedSegmented } from '../../../../../components/themed-segmented';
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
  batchUpdateInspectionParamLevel1,
  createInspectionParam,
  deleteInspectionParam,
  listCategories,
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

/** 批量修改分类：选择此项表示清除一级分类 */
const LEVEL1_BATCH_CLEAR = '__clear_level1_category__';

const InspectionParamsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);
  const existingCodesRef = useRef<Set<string>>(new Set());

  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(undefined);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<InspectionParamRow | null>(null);
  const [equipmentCategories, setEquipmentCategories] = useState<Awaited<ReturnType<typeof listCategories>>>([]);
  const [level1Filter, setLevel1Filter] = useState<string>('__all__');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchCategoryOpen, setBatchCategoryOpen] = useState(false);
  const [batchCategoryLoading, setBatchCategoryLoading] = useState(false);
  const [batchCategoryForm] = Form.useForm<{ level1_category?: string }>();

  const loadEquipmentCategories = useCallback(async () => {
    try {
      setEquipmentCategories(await listCategories());
    } catch {
      setEquipmentCategories([]);
    }
  }, []);

  useEffect(() => {
    void loadEquipmentCategories();
  }, [loadEquipmentCategories]);

  useEffect(() => {
    actionRef.current?.reload();
  }, [level1Filter]);

  const level1SegmentOptions = useMemo(() => {
    const opts: { label: string; value: string }[] = [
      { label: t('app.haoligo.equipment.ledger.categoryFilterAll'), value: '__all__' },
    ];
    const seen = new Set<string>();
    let hasUncategorized = false;
    for (const c of equipmentCategories) {
      const l1 = (c.level1_category ?? '').trim();
      if (!l1) {
        hasUncategorized = true;
        continue;
      }
      if (seen.has(l1)) continue;
      seen.add(l1);
      opts.push({ label: l1, value: l1 });
    }
    if (hasUncategorized) {
      opts.push({
        label: t('app.haoligo.equipment.ledger.categoryFilterUncategorized'),
        value: '__none__',
      });
    }
    return opts;
  }, [equipmentCategories, t]);

  const level1Options = useMemo(() => {
    const set = new Set(equipmentCategories.map((c) => c.level1_category).filter(Boolean));
    return [...set].sort().map((v) => ({ label: v, value: v }));
  }, [equipmentCategories]);

  const batchLevel1Options = useMemo(
    () => [
      {
        label: t('app.haoligo.equipment.inspectionParams.batchCategoryClear'),
        value: LEVEL1_BATCH_CLEAR,
      },
      ...level1Options,
    ],
    [level1Options, t],
  );

  const handleOpenBatchCategory = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('app.haoligo.equipment.inspectionParams.batchCategorySelectRows'));
      return;
    }
    batchCategoryForm.resetFields();
    setBatchCategoryOpen(true);
  };

  const handleBatchCategorySubmit = async () => {
    const values = await batchCategoryForm.validateFields();
    const raw = values.level1_category;
    const level1_category =
      raw === LEVEL1_BATCH_CLEAR || raw == null || raw === '' ? null : String(raw).trim();
    setBatchCategoryLoading(true);
    try {
      const ids = selectedRowKeys.map((k) => Number(k)).filter((id) => Number.isFinite(id));
      const result = await batchUpdateInspectionParamLevel1({ ids, level1_category });
      messageApi.success(
        t('app.haoligo.equipment.inspectionParams.batchCategorySuccess', { count: result.updated }),
      );
      setBatchCategoryOpen(false);
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (e) {
      messageApi.error((e as Error).message || t('app.haoligo.equipment.saveFailed'));
    } finally {
      setBatchCategoryLoading(false);
    }
  };

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

  const syncExistingCodes = useCallback((rows: InspectionParamRow[]) => {
    existingCodesRef.current = new Set(rows.map((r) => r.code.trim()).filter(Boolean));
  }, []);

  const handleCreate = () => {
    setIsEdit(false);
    setEditId(null);
    setFormInitialValues({ value_type: 'numeric' });
    setModalVisible(true);
    void listInspectionParams()
      .then(syncExistingCodes)
      .catch(() => {
        existingCodesRef.current = new Set();
      });
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
      level1_category: record.level1_category ?? undefined,
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
    const level1 = String(values.level1_category ?? '').trim();
    return {
      code: String(values.code ?? '').trim(),
      name: String(values.name ?? '').trim(),
      level1_category: level1 || null,
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
          level1_category: payload.level1_category,
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
        title: t('app.haoligo.equipment.inspectionParams.colCategory'),
        dataIndex: 'level1_category',
        render: (_, r) => r.level1_category || t('app.haoligo.equipment.inspectionParams.categoryUncategorized'),
      },
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
        title: t('app.haoligo.equipment.inspectionParams.colCategory'),
        dataIndex: 'level1_category',
        width: 120,
        ellipsis: true,
        hideInSearch: true,
        render: (_, r) => r.level1_category || t('app.haoligo.equipment.inspectionParams.categoryUncategorized'),
      },
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
            <Button key="view" {...rowActionKind('read')} onClick={() => handleDetail(record)}>
              {t('common.detail')}
            </Button>
            <Button key="edit" {...rowActionKind('update')} onClick={() => handleEdit(record)}>
              {t('app.haoligo.equipment.inspectionParams.actionEdit')}
            </Button>
            <Button key="delete" {...rowActionKind('delete')} onClick={() => handleDeleteOne(record)}>
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
          enableRowSelection
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          toolBarActionsAfterCreate={[
            <Button {...rowActionKind('update')}
              key="batch-level1-category"
              disabled={selectedRowKeys.length === 0}
              onClick={handleOpenBatchCategory}
            >
              {t('app.haoligo.equipment.inspectionParams.batchCategoryBtn')}
            </Button>,
          ]}
          showAdvancedSearch
          beforeSearchButtons={
            level1SegmentOptions.length > 1 ? (
              <ThemedSegmented
                key="inspection-params-level1-filter"
                surfaceBackground
                size="middle"
                value={level1Filter}
                onChange={(v) => setLevel1Filter(String(v))}
                options={level1SegmentOptions}
              />
            ) : null
          }
          showCreateButton
          createButtonText={t('app.haoligo.equipment.ledger.createBtn')}
          onCreate={handleCreate}
          showImportButton
          importHeaders={[
            t('app.haoligo.equipment.inspectionParams.importColCode'),
            t('app.haoligo.equipment.inspectionParams.importColName'),
            t('app.haoligo.equipment.inspectionParams.importColCategory'),
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
            const importCats = await listCategories();
            const level1Names = new Set(importCats.map((c) => c.level1_category).filter(Boolean));
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
            const catIdx = getIdx('一级分类', '设备类别一级', 'level1', 'category');
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
              const level1Raw = catIdx >= 0 ? String(row[catIdx] ?? '').trim() : '';
              const level1_category = level1Raw || null;
              if (level1_category && !level1Names.has(level1_category)) continue;
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
                level1_category,
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
              syncExistingCodes(all);
              const codeQ = String(searchFormValues?.code ?? '').trim().toLowerCase();
              const nameQ = String(searchFormValues?.name ?? '').trim().toLowerCase();
              const vtQ = searchFormValues?.value_type as InspectionValueTypeKey | undefined;
              let rows = all;
              if (codeQ) rows = rows.filter((r) => r.code.toLowerCase().includes(codeQ));
              if (nameQ) rows = rows.filter((r) => r.name.toLowerCase().includes(nameQ));
              if (vtQ) rows = rows.filter((r) => normalizeInspectionValueType(r.value_type) === vtQ);
              if (level1Filter === '__none__') rows = rows.filter((r) => !r.level1_category);
              else if (level1Filter !== '__all__') {
                rows = rows.filter((r) => r.level1_category === level1Filter);
              }
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
          scroll={{ x: 1300 }}
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
          if ('code' in changed && !isEdit) {
            void formRef.current?.validateFields(['code']).catch(() => undefined);
          }
        }}
      >
        <ProFormText
          name="code"
          label={t('app.haoligo.equipment.inspectionParams.formCode')}
          placeholder={t('app.haoligo.equipment.inspectionParams.formCodePh')}
          disabled={isEdit}
          colProps={{ span: FORM_LAYOUT.FULL_COL_SPAN }}
          rules={[
            { required: true, message: t('app.haoligo.equipment.inspectionParams.formCodeReq') },
            {
              validateTrigger: ['onChange', 'onBlur'],
              validator: async (_, value) => {
                if (isEdit) return;
                const code = String(value ?? '').trim();
                if (!code) return;
                if (existingCodesRef.current.has(code)) {
                  throw new Error(t('app.haoligo.equipment.inspectionParams.formCodeDuplicate', { code }));
                }
              },
            },
          ]}
        />
        <ProFormText
          name="name"
          label={t('app.haoligo.equipment.inspectionParams.formName')}
          placeholder={t('app.haoligo.equipment.inspectionParams.formNamePh')}
          colProps={{ span: FORM_LAYOUT.FULL_COL_SPAN }}
          rules={[{ required: true, message: t('app.haoligo.equipment.inspectionParams.formNameReq') }]}
        />
        <ProFormSelect
          name="level1_category"
          label={t('app.haoligo.equipment.inspectionParams.formCategory')}
          placeholder={t('app.haoligo.equipment.inspectionParams.formCategoryPh')}
          options={level1Options}
          allowClear
          colProps={{ span: FORM_LAYOUT.FULL_COL_SPAN }}
          fieldProps={{
            optionFilterProp: 'label',
            style: { width: '100%' },
            listHeight: 256,
          }}
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

      <Modal
        title={t('app.haoligo.equipment.inspectionParams.batchCategoryTitle')}
        open={batchCategoryOpen}
        onCancel={() => setBatchCategoryOpen(false)}
        onOk={() => void handleBatchCategorySubmit()}
        confirmLoading={batchCategoryLoading}
        destroyOnHidden
        width={MODAL_CONFIG.SMALL_WIDTH}
      >
        <p style={{ marginBottom: 16 }}>
          {t('app.haoligo.equipment.inspectionParams.batchCategoryHint', { count: selectedRowKeys.length })}
        </p>
        <Form form={batchCategoryForm} layout="vertical">
          <Form.Item
            name="level1_category"
            label={t('app.haoligo.equipment.inspectionParams.formCategory')}
            rules={[{ required: true, message: t('app.haoligo.equipment.inspectionParams.batchCategoryPick') }]}
          >
            <Select
              placeholder={t('app.haoligo.equipment.inspectionParams.formCategoryPh')}
              options={batchLevel1Options}
              allowClear={false}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default InspectionParamsPage;

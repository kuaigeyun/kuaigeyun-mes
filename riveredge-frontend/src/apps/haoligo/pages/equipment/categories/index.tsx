import { rowActionKind } from '../../../../../components/uni-action';
/**
 * 好力 GO — 设备类别（可绑定默认点检方案）
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProFormInstance,
  ProFormSelect,
  ProFormText,
} from '@ant-design/pro-components';
import { App, Button, Modal, Space } from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../../components/uni-table';
import { ThemedSegmented } from '../../../../../components/themed-segmented';
import {
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  ListPageTemplate,
  FormModalTemplate,
  MODAL_CONFIG,
} from '../../../../../components/layout-templates';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import {
  createCategory,
  deleteCategory,
  formatCategoryLabel,
  listCategories,
  listInspectionParamSets,
  updateCategory,
  type CategoryCreatePayload,
  type CategoryRow,
  type InspectionParamSetRow,
} from '../../../services/haoligo';

type CategoryTableRow = CategoryRow & { default_set_label?: string };

const CategoriesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const { t } = useTranslation();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);

  const [allCategories, setAllCategories] = useState<CategoryRow[]>([]);
  const [level1Filter, setLevel1Filter] = useState<string>('__all__');
  const [paramSets, setParamSets] = useState<InspectionParamSetRow[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(undefined);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<CategoryTableRow | null>(null);

  const loadParamSets = useCallback(async () => {
    try {
      const [sets, cats] = await Promise.all([listInspectionParamSets(), listCategories()]);
      setParamSets(sets);
      setAllCategories(cats);
    } catch (e) {
      messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
    }
  }, [messageApi, t]);

  const level1SegmentOptions = React.useMemo(() => {
    const opts: { label: string; value: string }[] = [
      { label: t('app.haoligo.equipment.ledger.categoryFilterAll'), value: '__all__' },
    ];
    const seen = new Set<string>();
    let hasUncategorized = false;
    for (const c of allCategories) {
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
  }, [allCategories, t]);

  const level1Options = React.useMemo(() => {
    const set = new Set(allCategories.map((c) => c.level1_category).filter(Boolean));
    return [...set].sort().map((v) => ({ label: v, value: v }));
  }, [allCategories]);

  useEffect(() => {
    void Promise.resolve().then(() => loadParamSets());
  }, [loadParamSets]);

  useEffect(() => {
    actionRef.current?.reload();
  }, [level1Filter]);

  const paramSetOptions = React.useMemo(
    () => paramSets.map((s) => ({ label: `${s.code} · ${s.name}`, value: s.id })),
    [paramSets],
  );

  const handleCreate = () => {
    setIsEdit(false);
    setEditId(null);
    setFormInitialValues({});
    setModalVisible(true);
  };

  useNewShortcut(handleCreate);

  const handleDetail = (record: CategoryTableRow) => {
    setDetailRecord(record);
    setDetailOpen(true);
  };

  const handleEdit = (record: CategoryTableRow) => {
    setIsEdit(true);
    setEditId(record.id);
    setFormInitialValues({
      code: record.code,
      level1_category: record.level1_category,
      level2_category: record.level2_category,
      default_inspection_param_set_id: record.default_inspection_param_set_id ?? undefined,
    });
    setModalVisible(true);
  };

  const handleDeleteOne = (record: CategoryTableRow) => {
    Modal.confirm({
      title: t('common.confirmDelete'),
      content: t('app.haoligo.equipment.categories.deleteConfirm', {
        name: record.level1_category
          ? `${record.level1_category} / ${record.level2_category}`
          : record.level2_category,
        code: record.code,
      }),
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteCategory(record.id);
          messageApi.success(t('common.deleteSuccess'));
          actionRef.current?.reload();
        } catch (e) {
          messageApi.error((e as Error).message || t('common.deleteFailed'));
        }
      },
    });
  };

  const toSetId = (v: unknown): number | null | undefined => {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    setFormLoading(true);
    try {
      const setId = toSetId(values.default_inspection_param_set_id);
      const level1Raw = values.level1_category;
      const level1 =
        (Array.isArray(level1Raw) ? String(level1Raw[0] ?? '') : String(level1Raw ?? '')).trim();
      const level2 = String(values.level2_category ?? '').trim();
      if (isEdit && editId != null) {
        await updateCategory(editId, {
          level1_category: level1,
          level2_category: level2,
          default_inspection_param_set_id: setId ?? null,
        });
        messageApi.success(t('app.haoligo.equipment.updateSuccess'));
      } else {
        const body: CategoryCreatePayload = {
          code: String(values.code ?? '').trim(),
          level1_category: level1,
          level2_category: level2,
          default_inspection_param_set_id: setId ?? null,
        };
        await createCategory(body);
        messageApi.success(t('common.createSuccess'));
      }
      setModalVisible(false);
      actionRef.current?.reload();
      void loadParamSets();
    } catch (e) {
      messageApi.error((e as Error).message || t('common.saveFailed'));
      throw e;
    } finally {
      setFormLoading(false);
    }
  };

  const detailColumns: ProDescriptionsItemProps<CategoryTableRow>[] = [
    { title: t('app.haoligo.equipment.categories.colCode'), dataIndex: 'code' },
    { title: t('app.haoligo.equipment.categories.colLevel1'), dataIndex: 'level1_category', render: (_, r) => r.level1_category?.trim() || '—' },
    { title: t('app.haoligo.equipment.categories.colLevel2'), dataIndex: 'level2_category' },
    {
      title: t('app.haoligo.equipment.categories.colDefaultSet'),
      dataIndex: 'default_set_label',
      render: (_, r) => r.default_set_label || '—',
    },
  ];

  const columns: ProColumns<CategoryTableRow>[] = [
    {
      title: t('app.haoligo.equipment.categories.colCode'),
      dataIndex: 'code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: t('app.haoligo.equipment.categories.colLevel1'),
      dataIndex: 'level1_category',
      width: 140,
      ellipsis: true,
      hideInSearch: true,
      render: (_, r) => r.level1_category?.trim() || '—',
    },
    {
      title: t('app.haoligo.equipment.categories.colLevel2'),
      dataIndex: 'level2_category',
      width: 160,
      ellipsis: true,
    },
    {
      title: t('app.haoligo.equipment.categories.colDefaultSet'),
      dataIndex: 'default_set_label',
      width: 260,
      ellipsis: true,
    },
    {
      title: t('common.actions'),
      valueType: 'option',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button key="view" {...rowActionKind('read')} onClick={() => handleDetail(record)}>
            {t('common.detail')}
          </Button>
          <Button key="edit" {...rowActionKind('update')} onClick={() => handleEdit(record)}>
            {t('common.edit')}
          </Button>
          <Button key="delete" {...rowActionKind('delete')} onClick={() => handleDeleteOne(record)}>
            {t('common.delete')}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<CategoryTableRow>
          headerTitle={t('app.haoligo.menu.equipment.categories')}
          columnPersistenceId="apps.haoligo.pages.equipment.categories"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          beforeSearchButtons={
            level1SegmentOptions.length > 1 ? (
              <ThemedSegmented
                key="equipment-categories-level1-filter"
                surfaceBackground
                size="middle"
                value={level1Filter}
                onChange={(v) => setLevel1Filter(String(v))}
                options={level1SegmentOptions}
              />
            ) : null
          }
          showCreateButton
          createButtonText={t('common.create')}
          onCreate={handleCreate}
          request={async (params, _sort, _filter, searchFormValues) => {
            const current = params.current ?? 1;
            const pageSize = params.pageSize ?? 20;
            try {
              const [all, sets] = await Promise.all([listCategories(), listInspectionParamSets()]);
              setAllCategories(all);
              const map = new Map<number, string>();
              sets.forEach((s) => map.set(s.id, `${s.code} · ${s.name}`));
              const codeQ = String(searchFormValues?.code ?? '').trim().toLowerCase();
              const level2Q = String(searchFormValues?.level2_category ?? '').trim().toLowerCase();
              let rows: CategoryTableRow[] = all.map((c) => ({
                ...c,
                default_set_label:
                  c.default_inspection_param_set_id != null
                    ? map.get(c.default_inspection_param_set_id) ?? '—'
                    : '—',
              }));
              if (codeQ) rows = rows.filter((r) => r.code.toLowerCase().includes(codeQ));
              if (level2Q) rows = rows.filter((r) => r.level2_category.toLowerCase().includes(level2Q));
              if (level1Filter === '__none__') {
                rows = rows.filter((r) => !(r.level1_category ?? '').trim());
              } else if (level1Filter !== '__all__') {
                rows = rows.filter((r) => (r.level1_category ?? '').trim() === level1Filter);
              }
              const start = (current - 1) * pageSize;
              const slice = rows.slice(start, start + pageSize);
              return {
                data: slice,
                success: true,
                total: rows.length,
              };
            } catch (e) {
              messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          scroll={{ x: 980 }}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={isEdit ? t('app.haoligo.equipment.categories.modalEdit') : t('app.haoligo.equipment.categories.modalCreate')}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setEditId(null);
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.SMALL_WIDTH}
        formRef={formRef}
        initialValues={formInitialValues}
        loading={formLoading}
        grid={false}
      >
        <ProFormText
          name="code"
          label={t('app.haoligo.equipment.categories.formCode')}
          placeholder={t('app.haoligo.equipment.categories.formCodePh')}
          disabled={isEdit}
          rules={[{ required: true, message: t('app.haoligo.equipment.categories.formCodeRequired') }]}
        />
        <ProFormSelect
          name="level1_category"
          label={t('app.haoligo.equipment.categories.formLevel1')}
          placeholder={t('app.haoligo.equipment.categories.formLevel1Ph')}
          options={level1Options}
          fieldProps={{
            showSearch: true,
            optionFilterProp: 'label',
            mode: 'tags',
            maxTagCount: 1,
            tokenSeparators: [],
            allowClear: true,
          }}
        />
        <ProFormText
          name="level2_category"
          label={t('app.haoligo.equipment.categories.formLevel2')}
          placeholder={t('app.haoligo.equipment.categories.formLevel2Ph')}
          rules={[{ required: true, message: t('app.haoligo.equipment.categories.formLevel2Required') }]}
        />
        <ProFormSelect
          name="default_inspection_param_set_id"
          label={t('app.haoligo.equipment.categories.formDefaultSet')}
          placeholder={t('app.haoligo.equipment.categories.formDefaultSetPh')}
          options={paramSetOptions}
          allowClear
          fieldProps={{ showSearch: true, optionFilterProp: 'label' }}
        />
      </FormModalTemplate>

      <DetailDrawerTemplate
        title={
          detailRecord
            ? `${t('common.detail')} · ${detailRecord.code}`
            : t('app.haoligo.menu.equipment.categories')
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

export default CategoriesPage;

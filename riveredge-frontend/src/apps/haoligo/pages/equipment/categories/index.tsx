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
      const sets = await listInspectionParamSets();
      setParamSets(sets);
    } catch (e) {
      messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
    }
  }, [messageApi, t]);

  useEffect(() => {
    void Promise.resolve().then(() => loadParamSets());
  }, [loadParamSets]);

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
      name: record.name,
      default_inspection_param_set_id: record.default_inspection_param_set_id ?? undefined,
    });
    setModalVisible(true);
  };

  const handleDeleteOne = (record: CategoryTableRow) => {
    Modal.confirm({
      title: t('common.confirmDelete'),
      content: t('app.haoligo.equipment.categories.deleteConfirm', { name: record.name, code: record.code }),
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
      if (isEdit && editId != null) {
        await updateCategory(editId, {
          name: String(values.name ?? '').trim(),
          default_inspection_param_set_id: setId ?? null,
        });
        messageApi.success(t('app.haoligo.equipment.updateSuccess'));
      } else {
        const body: CategoryCreatePayload = {
          code: String(values.code ?? '').trim(),
          name: String(values.name ?? '').trim(),
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
    { title: t('app.haoligo.equipment.categories.colName'), dataIndex: 'name' },
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
      title: t('app.haoligo.equipment.categories.colName'),
      dataIndex: 'name',
      width: 200,
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
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail(record)}>
            {t('common.detail')}
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            {t('common.edit')}
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteOne(record)}>
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
          showCreateButton
          createButtonText={t('common.create')}
          onCreate={handleCreate}
          request={async (params, _sort, _filter, searchFormValues) => {
            const current = params.current ?? 1;
            const pageSize = params.pageSize ?? 20;
            try {
              const [all, sets] = await Promise.all([listCategories(), listInspectionParamSets()]);
              const map = new Map<number, string>();
              sets.forEach((s) => map.set(s.id, `${s.code} · ${s.name}`));
              const codeQ = String(searchFormValues?.code ?? '').trim().toLowerCase();
              const nameQ = String(searchFormValues?.name ?? '').trim().toLowerCase();
              let rows: CategoryTableRow[] = all.map((c) => ({
                ...c,
                default_set_label:
                  c.default_inspection_param_set_id != null
                    ? map.get(c.default_inspection_param_set_id) ?? '—'
                    : '—',
              }));
              if (codeQ) rows = rows.filter((r) => r.code.toLowerCase().includes(codeQ));
              if (nameQ) rows = rows.filter((r) => r.name.toLowerCase().includes(nameQ));
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
          scroll={{ x: 900 }}
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
        <ProFormText
          name="name"
          label={t('app.haoligo.equipment.categories.formName')}
          placeholder={t('app.haoligo.equipment.categories.formNamePh')}
          rules={[{ required: true, message: t('app.haoligo.equipment.categories.formNameRequired') }]}
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

/**
 * 好力 GO — 模具仓库
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProFormDependency,
  ProFormInstance,
  ProFormSelect,
  ProFormText,
} from '@ant-design/pro-components';
import { App, Button, Modal, Space, Tag } from 'antd';
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
import { supplierApi, unwrapSupplyPagedList } from '../../../../../apps/master-data/services/supply-chain';
import type { Supplier } from '../../../../../apps/master-data/types/supply-chain';
import {
  createMoldWarehouse,
  deleteMoldWarehouse,
  listMoldWarehouses,
  listWorkshops,
  updateMoldWarehouse,
  type MoldWarehouseCreatePayload,
  type MoldWarehouseRow,
  type WorkshopRow,
} from '../../../services/haoligo';

const WAREHOUSE_TYPE_INTERNAL = '内部';
const WAREHOUSE_TYPE_EXTERNAL = '外部';

type SupplierOpt = { label: string; value: string };

function parseOptionalWorkshopId(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

const MoldWarehousePage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const { t } = useTranslation();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);

  const [supplierOptions, setSupplierOptions] = useState<SupplierOpt[]>([]);
  const [workshopOptions, setWorkshopOptions] = useState<{ label: string; value: number }[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(undefined);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<MoldWarehouseRow | null>(null);

  const typeOptions = useMemo(
    () => [
      { label: t('app.haoligo.molds.warehouse.typeInternal'), value: WAREHOUSE_TYPE_INTERNAL },
      { label: t('app.haoligo.molds.warehouse.typeExternal'), value: WAREHOUSE_TYPE_EXTERNAL },
    ],
    [t],
  );

  const loadSuppliers = useCallback(async () => {
    try {
      const res = await supplierApi.list({ limit: 1000, isActive: true });
      const list = unwrapSupplyPagedList<Supplier>(res);
      setSupplierOptions(
        list.map((s) => ({
          value: s.uuid,
          label: s.code ? `${s.code} · ${s.name}` : s.name,
        })),
      );
    } catch {
      setSupplierOptions([]);
    }
  }, []);

  const loadWorkshops = useCallback(async () => {
    try {
      const rows = await listWorkshops();
      setWorkshopOptions(
        rows.map((w: WorkshopRow) => ({
          value: w.id,
          label: w.code ? `${w.code} · ${w.name}` : w.name,
        })),
      );
    } catch {
      setWorkshopOptions([]);
    }
  }, []);

  useEffect(() => {
    void loadSuppliers();
    void loadWorkshops();
  }, [loadSuppliers, loadWorkshops]);

  const handleCreate = () => {
    setIsEdit(false);
    setEditId(null);
    setFormInitialValues({ warehouse_type: WAREHOUSE_TYPE_INTERNAL });
    setModalVisible(true);
  };

  useNewShortcut(handleCreate);

  const handleDetail = (record: MoldWarehouseRow) => {
    setDetailRecord(record);
    setDetailOpen(true);
  };

  const handleEdit = (record: MoldWarehouseRow) => {
    setIsEdit(true);
    setEditId(record.id);
    setFormInitialValues({
      warehouse_code: record.warehouse_code,
      warehouse_name: record.warehouse_name,
      warehouse_type: record.warehouse_type,
      workshop_id: record.workshop_id ?? undefined,
      supplier_uuid: record.supplier_uuid ?? undefined,
    });
    setModalVisible(true);
  };

  const handleDeleteOne = (record: MoldWarehouseRow) => {
    Modal.confirm({
      title: t('common.confirmDelete'),
      content: t('app.haoligo.molds.warehouse.deleteContent', {
        name: record.warehouse_name,
        code: record.warehouse_code,
      }),
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteMoldWarehouse(record.id);
          messageApi.success(t('app.haoligo.molds.warehouse.deleteSuccess'));
          actionRef.current?.reload();
        } catch (e) {
          messageApi.error((e as Error).message || t('app.haoligo.molds.warehouse.deleteFailed'));
        }
      },
    });
  };

  const buildPayload = (values: Record<string, unknown>): MoldWarehouseCreatePayload => {
    const warehouse_type = String(values.warehouse_type ?? '').trim() as '内部' | '外部';
    const workshopId = parseOptionalWorkshopId(values.workshop_id);
    const base: MoldWarehouseCreatePayload = {
      warehouse_code: String(values.warehouse_code ?? '').trim(),
      warehouse_name: String(values.warehouse_name ?? '').trim(),
      warehouse_type,
      ...(workshopId != null ? { workshop_id: workshopId } : { workshop_id: null }),
    };
    if (warehouse_type === WAREHOUSE_TYPE_EXTERNAL) {
      const uid = String(values.supplier_uuid ?? '').trim();
      return { ...base, supplier_uuid: uid || null };
    }
    return { ...base, supplier_uuid: null };
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    setFormLoading(true);
    try {
      if (isEdit && editId != null) {
        const wt = String(values.warehouse_type ?? '').trim() as '内部' | '外部';
        await updateMoldWarehouse(editId, {
          warehouse_code: String(values.warehouse_code ?? '').trim(),
          warehouse_name: String(values.warehouse_name ?? '').trim(),
          warehouse_type: wt,
          workshop_id: parseOptionalWorkshopId(values.workshop_id),
          supplier_uuid:
            wt === WAREHOUSE_TYPE_EXTERNAL ? String(values.supplier_uuid ?? '').trim() || null : null,
        });
        messageApi.success(t('app.haoligo.molds.warehouse.updateSuccess'));
      } else {
        await createMoldWarehouse(buildPayload(values));
        messageApi.success(t('app.haoligo.molds.warehouse.createSuccess'));
      }
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (e) {
      messageApi.error((e as Error).message || t('app.haoligo.molds.warehouse.saveFailed'));
      throw e;
    } finally {
      setFormLoading(false);
    }
  };

  const renderType = (type: string) => {
    if (type === WAREHOUSE_TYPE_EXTERNAL) {
      return <Tag color="orange">{t('app.haoligo.molds.warehouse.typeExternal')}</Tag>;
    }
    return <Tag color="blue">{t('app.haoligo.molds.warehouse.typeInternal')}</Tag>;
  };

  const detailColumns: ProDescriptionsItemProps<MoldWarehouseRow>[] = [
    { title: t('app.haoligo.molds.warehouse.colCode'), dataIndex: 'warehouse_code' },
    { title: t('app.haoligo.molds.warehouse.colName'), dataIndex: 'warehouse_name' },
    {
      title: t('app.haoligo.molds.warehouse.colType'),
      dataIndex: 'warehouse_type',
      render: (_, r) => renderType(r.warehouse_type),
    },
    {
      title: t('app.haoligo.molds.warehouse.colWorkshop'),
      dataIndex: 'workshop_name',
      render: (_, r) =>
        r.workshop_code ? `${r.workshop_code} · ${r.workshop_name ?? ''}` : r.workshop_name || '—',
    },
    {
      title: t('app.haoligo.molds.warehouse.colSupplier'),
      dataIndex: 'supplier_name',
      render: (_, r) =>
        r.warehouse_type === WAREHOUSE_TYPE_EXTERNAL
          ? r.supplier_code
            ? `${r.supplier_code} · ${r.supplier_name ?? ''}`
            : r.supplier_name || '—'
          : '—',
    },
  ];

  const columns: ProColumns<MoldWarehouseRow>[] = [
    {
      title: t('app.haoligo.molds.warehouse.colCode'),
      dataIndex: 'warehouse_code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: t('app.haoligo.molds.warehouse.colName'),
      dataIndex: 'warehouse_name',
      width: 200,
      ellipsis: true,
    },
    {
      title: t('app.haoligo.molds.warehouse.colType'),
      dataIndex: 'warehouse_type',
      width: 100,
      valueType: 'select',
      fieldProps: { options: typeOptions },
      render: (_, r) => renderType(r.warehouse_type),
    },
    {
      title: t('app.haoligo.molds.warehouse.colWorkshop'),
      dataIndex: 'workshop_name',
      width: 180,
      ellipsis: true,
      hideInSearch: true,
      render: (_, r) =>
        r.workshop_code ? `${r.workshop_code} · ${r.workshop_name ?? ''}` : r.workshop_name || '—',
    },
    {
      title: t('app.haoligo.molds.warehouse.colSupplier'),
      dataIndex: 'supplier_name',
      width: 220,
      ellipsis: true,
      hideInSearch: true,
      render: (_, r) =>
        r.warehouse_type === WAREHOUSE_TYPE_EXTERNAL
          ? r.supplier_code
            ? `${r.supplier_code} · ${r.supplier_name ?? ''}`
            : r.supplier_name || '—'
          : '—',
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
        <UniTable<MoldWarehouseRow>
          headerTitle={t('app.haoligo.molds.warehouse.title')}
          columnPersistenceId="apps.haoligo.pages.molds.warehouse"
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
              const all = await listMoldWarehouses({
                keyword:
                  typeof searchFormValues?.keyword === 'string' && searchFormValues.keyword.trim()
                    ? searchFormValues.keyword.trim()
                    : undefined,
                warehouse_type:
                  typeof searchFormValues?.warehouse_type === 'string' &&
                  searchFormValues.warehouse_type.trim()
                    ? searchFormValues.warehouse_type.trim()
                    : undefined,
              });
              const codeQ = String(searchFormValues?.warehouse_code ?? '').trim().toLowerCase();
              const nameQ = String(searchFormValues?.warehouse_name ?? '').trim().toLowerCase();
              let rows = all;
              if (codeQ) rows = rows.filter((r) => r.warehouse_code.toLowerCase().includes(codeQ));
              if (nameQ) rows = rows.filter((r) => r.warehouse_name.toLowerCase().includes(nameQ));
              const start = (current - 1) * pageSize;
              const slice = rows.slice(start, start + pageSize);
              return { data: slice, success: true, total: rows.length };
            } catch (e) {
              messageApi.error((e as Error).message || t('app.haoligo.molds.warehouse.loadFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          scroll={{ x: 1080 }}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={
          isEdit
            ? t('app.haoligo.molds.warehouse.modalEdit')
            : t('app.haoligo.molds.warehouse.modalCreate')
        }
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
          name="warehouse_code"
          label={t('app.haoligo.molds.warehouse.formCode')}
          placeholder={t('app.haoligo.molds.warehouse.formCodePh')}
          rules={[{ required: true, message: t('app.haoligo.molds.warehouse.formCodeReq') }]}
        />
        <ProFormText
          name="warehouse_name"
          label={t('app.haoligo.molds.warehouse.formName')}
          placeholder={t('app.haoligo.molds.warehouse.formNamePh')}
          rules={[{ required: true, message: t('app.haoligo.molds.warehouse.formNameReq') }]}
        />
        <ProFormSelect
          name="warehouse_type"
          label={t('app.haoligo.molds.warehouse.formType')}
          options={typeOptions}
          rules={[{ required: true, message: t('app.haoligo.molds.warehouse.formTypeReq') }]}
          fieldProps={{
            onChange: (v: string) => {
              if (v === WAREHOUSE_TYPE_INTERNAL) {
                formRef.current?.setFieldValue('supplier_uuid', undefined);
              }
            },
          }}
        />
        <ProFormSelect
          name="workshop_id"
          label={t('app.haoligo.molds.warehouse.formWorkshop')}
          placeholder={t('app.haoligo.molds.warehouse.formWorkshopPh')}
          options={workshopOptions}
          showSearch
          allowClear
        />
        <ProFormDependency name={['warehouse_type']}>
          {({ warehouse_type }) =>
            warehouse_type === WAREHOUSE_TYPE_EXTERNAL ? (
              <ProFormSelect
                name="supplier_uuid"
                label={t('app.haoligo.molds.warehouse.formSupplier')}
                placeholder={t('app.haoligo.molds.warehouse.formSupplierPh')}
                options={supplierOptions}
                showSearch
                rules={[{ required: true, message: t('app.haoligo.molds.warehouse.formSupplierReq') }]}
              />
            ) : null
          }
        </ProFormDependency>
      </FormModalTemplate>

      <DetailDrawerTemplate
        title={
          detailRecord
            ? `${t('common.detail')} · ${detailRecord.warehouse_code}`
            : t('app.haoligo.molds.warehouse.title')
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

export default MoldWarehousePage;

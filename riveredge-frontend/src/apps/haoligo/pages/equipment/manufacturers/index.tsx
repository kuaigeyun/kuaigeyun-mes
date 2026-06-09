import { rowActionKind } from '../../../../../components/uni-action';
/**
 * 好力 GO — 设备制造厂商
 *
 * 列表页模板与模具台账一致：ListPageTemplate + UniTable + FormModalTemplate。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProFormInstance, ProFormText } from '@ant-design/pro-components';
import { App, Button, Modal, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import { DeleteOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
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
  createManufacturer,
  deleteManufacturer,
  listManufacturers,
  updateManufacturer,
  type ManufacturerCreatePayload,
  type ManufacturerRow,
} from '../../../services/haoligo';
import { batchImport } from '../../../../../utils/batchOperations';

const ManufacturersPage: React.FC = () => {
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
  const [detailRecord, setDetailRecord] = useState<ManufacturerRow | null>(null);

  const handleCreate = () => {
    setIsEdit(false);
    setEditId(null);
    setFormInitialValues({});
    setModalVisible(true);
  };

  useNewShortcut(handleCreate);

  const handleDetail = (record: ManufacturerRow) => {
    setDetailRecord(record);
    setDetailOpen(true);
  };

  const handleEdit = (record: ManufacturerRow) => {
    setIsEdit(true);
    setEditId(record.id);
    setFormInitialValues({
      code: record.code,
      name: record.name,
    });
    setModalVisible(true);
  };

  const handleDeleteOne = (record: ManufacturerRow) => {
    Modal.confirm({
      title: t('app.haoligo.equipment.manufacturers.deleteTitle'),
      content: t('app.haoligo.equipment.manufacturers.deleteContent', { name: record.name, code: record.code }),
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteManufacturer(record.id);
          messageApi.success(t('app.haoligo.equipment.deleteSuccess'));
          actionRef.current?.reload();
        } catch (e) {
          messageApi.error((e as Error).message || t('app.haoligo.equipment.deleteFailed'));
        }
      },
    });
  };

  const buildPayload = (values: Record<string, unknown>): ManufacturerCreatePayload => ({
    code: String(values.code ?? '').trim(),
    name: String(values.name ?? '').trim(),
  });

  const handleSubmit = async (values: Record<string, unknown>) => {
    setFormLoading(true);
    try {
      if (isEdit && editId != null) {
        await updateManufacturer(editId, { name: String(values.name ?? '').trim() });
        messageApi.success(t('app.haoligo.equipment.updateSuccess'));
      } else {
        await createManufacturer(buildPayload(values));
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

  const detailColumns: ProDescriptionsItemProps<ManufacturerRow>[] = [
    { title: t('app.haoligo.equipment.manufacturers.colCode'), dataIndex: 'code' },
    { title: t('app.haoligo.equipment.manufacturers.colName'), dataIndex: 'name' },
  ];

  const columns: ProColumns<ManufacturerRow>[] = [
    { title: t('app.haoligo.equipment.manufacturers.colCode'), dataIndex: 'code', width: 140, ellipsis: true, fixed: 'left' },
    { title: t('app.haoligo.equipment.manufacturers.colName'), dataIndex: 'name', width: 220, ellipsis: true },
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
            {t('app.haoligo.equipment.manufacturers.actionEdit')}
          </Button>
          <Button key="delete" {...rowActionKind('delete')} onClick={() => handleDeleteOne(record)}>
            {t('app.haoligo.equipment.manufacturers.actionDelete')}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<ManufacturerRow>
          headerTitle={t('app.haoligo.equipment.manufacturers.title')}
          columnPersistenceId="apps.haoligo.pages.equipment.manufacturers"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          showCreateButton
          createButtonText={t('app.haoligo.equipment.ledger.createBtn')}
          onCreate={handleCreate}
          showImportButton
          importHeaders={[t('app.haoligo.equipment.manufacturers.importColCode'), t('app.haoligo.equipment.manufacturers.importColName')]}
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
            const codeIdx = getIdx('厂商代号', '代号', 'code');
            const nameIdx = getIdx('厂商名称', '名称', 'name');
            if (codeIdx < 0 || nameIdx < 0) {
              messageApi.error(t('app.haoligo.equipment.manufacturers.importErrorHeaders'));
              return;
            }
            const items: ManufacturerCreatePayload[] = [];
            for (let i = 1; i < data.length; i++) {
              const row = data[i] as unknown[];
              if (!row || row.length === 0) continue;
              const code = String(row[codeIdx] ?? '').trim();
              const name = String(row[nameIdx] ?? '').trim();
              if (!code || !name) continue;
              items.push({ code, name });
            }
            if (items.length === 0) {
              messageApi.warning(t('app.haoligo.equipment.importNoRows'));
              return;
            }
            const result = await batchImport({
              items,
              importFn: async (item) => createManufacturer(item),
              title: t('app.haoligo.equipment.manufacturers.importTitle'),
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
            messageApi.info(t('app.haoligo.equipment.syncPlaceholder'));
            actionRef.current?.reload();
          }}
          request={async (params, _sort, _filter, searchFormValues) => {
            const current = params.current ?? 1;
            const pageSize = params.pageSize ?? 20;
            try {
              const all = await listManufacturers();
              const codeQ = String(searchFormValues?.code ?? '').trim().toLowerCase();
              const nameQ = String(searchFormValues?.name ?? '').trim().toLowerCase();
              let rows = all;
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
          scroll={{ x: 720 }}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={isEdit ? t('app.haoligo.equipment.manufacturers.modalEdit') : t('app.haoligo.equipment.manufacturers.modalCreate')}
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
          label={t('app.haoligo.equipment.manufacturers.formCode')}
          placeholder={t('app.haoligo.equipment.manufacturers.formCodePh')}
          disabled={isEdit}
          rules={[{ required: true, message: t('app.haoligo.equipment.manufacturers.formCodeReq') }]}
        />
        <ProFormText
          name="name"
          label={t('app.haoligo.equipment.manufacturers.formName')}
          placeholder={t('app.haoligo.equipment.manufacturers.formNamePh')}
          rules={[{ required: true, message: t('app.haoligo.equipment.manufacturers.formNameReq') }]}
        />
      </FormModalTemplate>

      <DetailDrawerTemplate
        title={
          detailRecord
            ? `${t('common.detail')} · ${detailRecord.code}`
            : t('app.haoligo.equipment.manufacturers.title')
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

export default ManufacturersPage;

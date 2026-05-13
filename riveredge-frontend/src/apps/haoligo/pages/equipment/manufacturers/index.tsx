/**
 * 好力 GO — 设备制造厂商
 *
 * 列表页模板与模具台账一致：ListPageTemplate + UniTable + FormModalTemplate。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormInstance, ProFormText } from '@ant-design/pro-components';
import { App, Button, Modal, Space } from 'antd';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
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
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(undefined);

  const handleCreate = () => {
    setIsEdit(false);
    setEditId(null);
    setFormInitialValues({});
    setModalVisible(true);
  };

  useNewShortcut(handleCreate);

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
      title: '确认删除',
      content: `确定删除制造厂商「${record.name}」（${record.code}）吗？`,
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteManufacturer(record.id);
          messageApi.success('已删除');
          actionRef.current?.reload();
        } catch (e) {
          messageApi.error((e as Error).message || '删除失败');
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
        messageApi.success('已保存');
      } else {
        await createManufacturer(buildPayload(values));
        messageApi.success('已创建');
      }
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (e) {
      messageApi.error((e as Error).message || '保存失败');
      throw e;
    } finally {
      setFormLoading(false);
    }
  };

  const columns: ProColumns<ManufacturerRow>[] = [
    { title: '厂商代号', dataIndex: 'code', width: 140, ellipsis: true, fixed: 'left' },
    { title: '厂商名称', dataIndex: 'name', width: 220, ellipsis: true },
    {
      title: '操作',
      valueType: 'option',
      width: 140,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteOne(record)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<ManufacturerRow>
          headerTitle="制造厂商"
          columnPersistenceId="apps.haoligo.pages.equipment.manufacturers"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          showCreateButton
          createButtonText="新增"
          onCreate={handleCreate}
          showImportButton
          importHeaders={['*厂商代号', '*厂商名称']}
          onImport={async (data) => {
            if (!data || data.length < 2) {
              messageApi.warning('导入数据为空或格式不正确');
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
              messageApi.error('导入表头需包含：厂商代号、厂商名称');
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
              messageApi.warning('没有可导入的有效数据（请检查必填列是否完整）');
              return;
            }
            const result = await batchImport({
              items,
              importFn: async (item) => createManufacturer(item),
              title: '导入制造厂商',
              concurrency: 5,
            });
            if (result.successCount > 0) {
              messageApi.success(`成功导入 ${result.successCount} 条`);
              actionRef.current?.reload();
            }
            if (result.failureCount > 0) {
              messageApi.warning(`部分失败 ${result.failureCount} 条`);
            }
          }}
          showSyncButton
          onSync={() => {
            messageApi.info('与 ERP / 主数据同步能力接入后将在此执行；已刷新当前列表。');
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
              messageApi.error((e as Error).message || '加载失败');
              return { data: [], success: false, total: 0 };
            }
          }}
          scroll={{ x: 720 }}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={isEdit ? '编辑制造厂商' : '新增制造厂商'}
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
          label="厂商代号"
          placeholder="请输入厂商代号"
          disabled={isEdit}
          rules={[{ required: true, message: '请输入厂商代号' }]}
        />
        <ProFormText name="name" label="厂商名称" placeholder="请输入厂商名称" rules={[{ required: true, message: '请输入厂商名称' }]} />
      </FormModalTemplate>
    </>
  );
};

export default ManufacturersPage;

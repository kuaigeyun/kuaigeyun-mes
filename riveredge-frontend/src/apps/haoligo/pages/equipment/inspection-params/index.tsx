/**
 * 好力 GO — 点检项（点检参数主数据）
 *
 * 与制造厂商页同一模板：ListPageTemplate + UniTable + FormModalTemplate。
 * 业务约定：编码全局唯一；取值类型决定现场录入形态（数值 / 文本 / 是否）。
 */

import React, { useRef, useState } from 'react';
import {
  ActionType,
  ProColumns,
  ProFormInstance,
  ProFormSelect,
  ProFormText,
} from '@ant-design/pro-components';
import { App, Button, Modal, Space, Tag } from 'antd';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
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

const VALUE_TYPES = [
  { label: '数值', value: 'numeric' },
  { label: '文本', value: 'text' },
  { label: '是否', value: 'boolean' },
] as const;

const VALUE_TYPE_LABEL: Record<string, string> = {
  numeric: '数值',
  text: '文本',
  boolean: '是否',
};

const InspectionParamsPage: React.FC = () => {
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
    setFormInitialValues({ value_type: 'numeric' });
    setModalVisible(true);
  };

  useNewShortcut(handleCreate);

  const handleEdit = (record: InspectionParamRow) => {
    setIsEdit(true);
    setEditId(record.id);
    setFormInitialValues({
      code: record.code,
      name: record.name,
      unit: record.unit ?? '',
      value_type: record.value_type || 'numeric',
    });
    setModalVisible(true);
  };

  const handleDeleteOne = (record: InspectionParamRow) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定删除点检项「${record.name}」（${record.code}）吗？若已被点检方案引用将无法删除。`,
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteInspectionParam(record.id);
          messageApi.success('已删除');
          actionRef.current?.reload();
        } catch (e) {
          messageApi.error((e as Error).message || '删除失败');
        }
      },
    });
  };

  const buildPayload = (values: Record<string, unknown>): InspectionParamCreatePayload => ({
    code: String(values.code ?? '').trim(),
    name: String(values.name ?? '').trim(),
    unit: String(values.unit ?? '').trim() || null,
    value_type: String(values.value_type ?? 'numeric'),
  });

  const handleSubmit = async (values: Record<string, unknown>) => {
    setFormLoading(true);
    try {
      if (isEdit && editId != null) {
        await updateInspectionParam(editId, {
          name: String(values.name ?? '').trim(),
          unit: String(values.unit ?? '').trim() || null,
          value_type: String(values.value_type ?? 'numeric'),
        });
        messageApi.success('已保存');
      } else {
        await createInspectionParam(buildPayload(values));
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

  const columns: ProColumns<InspectionParamRow>[] = [
    { title: '参数编码', dataIndex: 'code', width: 140, ellipsis: true, fixed: 'left' },
    { title: '参数名称', dataIndex: 'name', width: 200, ellipsis: true },
    { title: '单位', dataIndex: 'unit', width: 88, ellipsis: true, hideInSearch: true },
    {
      title: '取值类型',
      dataIndex: 'value_type',
      width: 100,
      hideInSearch: true,
      render: (_, r) => <Tag>{VALUE_TYPE_LABEL[r.value_type] || r.value_type}</Tag>,
    },
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
        <UniTable<InspectionParamRow>
          headerTitle="点检项"
          columnPersistenceId="apps.haoligo.pages.equipment.inspection-params"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          showCreateButton
          createButtonText="新增"
          onCreate={handleCreate}
          showImportButton
          importHeaders={['*参数编码', '*参数名称', '单位', '取值类型']}
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
            const codeIdx = getIdx('参数编码', '编码', 'code');
            const nameIdx = getIdx('参数名称', '名称', 'name');
            const unitIdx = getIdx('单位', 'unit');
            const vtIdx = getIdx('取值类型', '类型', 'value_type');
            if (codeIdx < 0 || nameIdx < 0) {
              messageApi.error('导入表头需包含：参数编码、参数名称');
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
              else if (rawVt.includes('数值') || rawVt === 'numeric' || rawVt === 'number') value_type = 'numeric';
              items.push({
                code,
                name,
                unit: unitIdx >= 0 ? String(row[unitIdx] ?? '').trim() || null : null,
                value_type,
              });
            }
            if (items.length === 0) {
              messageApi.warning('没有可导入的有效数据（请检查必填列是否完整）');
              return;
            }
            const result = await batchImport({
              items,
              importFn: async (item) => createInspectionParam(item),
              title: '导入点检项',
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
            messageApi.info('与标准点检库 / ERP 同步能力接入后将在此执行；已刷新当前列表。');
            actionRef.current?.reload();
          }}
          request={async (params, _sort, _filter, searchFormValues) => {
            const current = params.current ?? 1;
            const pageSize = params.pageSize ?? 20;
            try {
              const all = await listInspectionParams();
              const codeQ = String(searchFormValues?.code ?? '').trim().toLowerCase();
              const nameQ = String(searchFormValues?.name ?? '').trim().toLowerCase();
              let rows = all;
              if (codeQ) rows = rows.filter((r) => r.code.toLowerCase().includes(codeQ));
              if (nameQ) rows = rows.filter((r) => r.name.toLowerCase().includes(nameQ));
              const start = (current - 1) * pageSize;
              return {
                data: rows.slice(start, start + pageSize),
                success: true,
                total: rows.length,
              };
            } catch (e) {
              messageApi.error((e as Error).message || '加载失败');
              return { data: [], success: false, total: 0 };
            }
          }}
          scroll={{ x: 900 }}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={isEdit ? '编辑点检项' : '新增点检项'}
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
          label="参数编码"
          placeholder="如 VIB、TEMP"
          disabled={isEdit}
          rules={[{ required: true, message: '请输入参数编码' }]}
        />
        <ProFormText name="name" label="参数名称" placeholder="如 主轴振动" rules={[{ required: true, message: '请输入参数名称' }]} />
        <ProFormText name="unit" label="单位" placeholder="可选，如 mm/s、℃" />
        <ProFormSelect
          name="value_type"
          label="取值类型"
          options={[...VALUE_TYPES]}
          rules={[{ required: true, message: '请选择取值类型' }]}
        />
      </FormModalTemplate>
    </>
  );
};

export default InspectionParamsPage;

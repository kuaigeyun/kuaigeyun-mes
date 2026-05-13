/**
 * 好力 GO — 试模单（列表 + 表单，对齐需求稿字段）
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ActionType,
  ProColumns,
  ProForm,
  ProFormDigit,
  ProFormInstance,
  ProFormRadio,
  ProFormSelect,
  ProFormText,
  ProFormUploadButton,
} from '@ant-design/pro-components';
import type { UploadFile } from 'antd/es/upload/interface';
import { App, AutoComplete, Button, Col, Modal, Row, Space, Tag, Upload } from 'antd';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../../components/uni-table';
import { FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../../../components/layout-templates';
import { useNewShortcut } from '../../../../../../hooks/useNewShortcut';
import { getFileDownloadUrl, uploadFile } from '../../../../../../services/file';
import { supplierApi, unwrapSupplyPagedList } from '../../../../../../apps/master-data/services/supply-chain';
import type { Supplier } from '../../../../../../apps/master-data/types/supply-chain';
import {
  createMoldTrialSheet,
  deleteMoldTrialSheet,
  getMoldTrialSheet,
  listMoldTrialSheets,
  updateMoldTrialSheet,
  type MoldTrialSheetCreatePayload,
  type MoldTrialSheetRow,
} from '../../../../services/haoligo';

const TRIAL_SHEET_STATUSES = ['草稿', '已提交', '待审核', '已通过', '已驳回', '已作废'] as const;

const sheetStatusEnum = TRIAL_SHEET_STATUSES.reduce<Record<string, { text: string }>>((acc, s) => {
  acc[s] = { text: s };
  return acc;
}, {});

const sheetStatusColors: Record<string, string> = {
  草稿: 'default',
  已提交: 'blue',
  待审核: 'processing',
  已通过: 'success',
  已驳回: 'error',
  已作废: 'default',
};

function normUploadUuids(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  const out: string[] = [];
  for (const item of val) {
    const anyItem = item as { response?: { uuid?: string }; uid?: string };
    const u = anyItem?.response?.uuid ?? (typeof anyItem?.uid === 'string' && /^[0-9a-f-]{36}$/i.test(anyItem.uid) ? anyItem.uid : null);
    if (u) out.push(u);
  }
  return out;
}

function uuidsToUploadFileList(uuids: string[] | undefined): UploadFile[] {
  if (!uuids?.length) return [];
  return uuids.map((uuid) => ({
    uid: uuid,
    name: '附件',
    status: 'done',
    url: getFileDownloadUrl(uuid),
    response: { uuid },
  }));
}

const MoldTrialSheetsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(undefined);
  const [supplierOptions, setSupplierOptions] = useState<{ value: string; label: string; key: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await supplierApi.list({ limit: 1000, isActive: true });
        const list = unwrapSupplyPagedList<Supplier>(res);
        if (cancelled) return;
        setSupplierOptions(
          list.map((s) => ({
            key: s.uuid,
            value: s.name,
            label: s.code ? `${s.code} · ${s.name}` : s.name,
          })),
        );
      } catch {
        if (!cancelled) setSupplierOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreate = () => {
    setIsEdit(false);
    setEditId(null);
    setFormInitialValues({
      trial_result: '合格',
      sheet_status: '草稿',
      result_attachments: [],
      inspection_attachments: [],
    });
    setModalVisible(true);
  };

  useNewShortcut(handleCreate);

  const handleEdit = async (record: MoldTrialSheetRow) => {
    try {
      const detail = await getMoldTrialSheet(record.id);
      setIsEdit(true);
      setEditId(detail.id);
      setFormInitialValues({
        purchase_order_no: detail.purchase_order_no,
        supplier_name: detail.supplier_name ?? undefined,
        mold_code: detail.mold_code ?? undefined,
        mold_name: detail.mold_name ?? undefined,
        trial_times: detail.trial_times ?? undefined,
        result_attachments: uuidsToUploadFileList(detail.result_attachment_file_uuids),
        inspection_attachments: uuidsToUploadFileList(detail.inspection_attachment_file_uuids),
        trial_result: detail.trial_result,
        sheet_status: detail.sheet_status,
      });
      setModalVisible(true);
    } catch (e) {
      messageApi.error((e as Error).message || '加载试模单失败');
    }
  };

  const handleDeleteOne = (record: MoldTrialSheetRow) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定删除试模单「${record.purchase_order_no}」吗？`,
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteMoldTrialSheet(record.id);
          messageApi.success('已删除');
          actionRef.current?.reload();
        } catch (e) {
          messageApi.error((e as Error).message || '删除失败');
        }
      },
    });
  };

  const buildPayload = (values: Record<string, unknown>): MoldTrialSheetCreatePayload => ({
    purchase_order_no: String(values.purchase_order_no ?? '').trim(),
    supplier_name: String(values.supplier_name ?? '').trim() || null,
    mold_code: String(values.mold_code ?? '').trim() || null,
    mold_name: String(values.mold_name ?? '').trim() || null,
    trial_times: (() => {
      const v = values.trial_times;
      if (v === undefined || v === null || v === '') return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    })(),
    result_attachment_file_uuids: normUploadUuids(values.result_attachments),
    inspection_attachment_file_uuids: normUploadUuids(values.inspection_attachments),
    trial_result: values.trial_result === '不合格' ? '不合格' : '合格',
    sheet_status: (values.sheet_status as MoldTrialSheetCreatePayload['sheet_status']) ?? '草稿',
  });

  const handleSubmit = async (values: Record<string, unknown>) => {
    setFormLoading(true);
    try {
      const payload = buildPayload(values);
      if (isEdit && editId != null) {
        await updateMoldTrialSheet(editId, payload);
        messageApi.success('已保存');
      } else {
        await createMoldTrialSheet(payload);
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

  const uploadFieldProps = {
    listType: 'picture-card' as const,
    accept: '.jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar',
    beforeUpload: (file) => {
      const f = file as { size?: number };
      const isLt30M = (f.size ?? 0) / 1024 / 1024 < 30;
      if (!isLt30M) {
        messageApi.error('单个文件需小于 30MB');
        return Upload.LIST_IGNORE;
      }
      return true;
    },
    customRequest: async (options: {
      file?: unknown;
      onSuccess?: (body: unknown, file?: unknown) => void;
      onError?: (e: Error) => void;
    }) => {
      try {
        const file = options.file as Parameters<typeof uploadFile>[0];
        const res = await uploadFile(file, { category: 'haoligo_mold_trial' });
        options.onSuccess?.(res, options.file);
      } catch (err) {
        options.onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    },
  };

  const columns: ProColumns<MoldTrialSheetRow>[] = [
    {
      title: '关键词',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: '订单号/模具代号/名称' },
    },
    { title: '采购订单号', dataIndex: 'purchase_order_no', width: 160, ellipsis: true, copyable: true, fixed: 'left' },
    { title: '供应商', dataIndex: 'supplier_name', width: 160, ellipsis: true, hideInSearch: true },
    { title: '模具代号', dataIndex: 'mold_code', width: 120, ellipsis: true },
    { title: '模具名称', dataIndex: 'mold_name', width: 160, ellipsis: true },
    { title: '试模次数', dataIndex: 'trial_times', width: 96, hideInSearch: true },
    {
      title: '试模结果',
      dataIndex: 'trial_result',
      width: 96,
      hideInSearch: true,
      render: (_, r) => (
        <Tag color={r.trial_result === '合格' ? 'success' : 'error'}>{r.trial_result}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'sheet_status',
      width: 100,
      valueType: 'select',
      valueEnum: sheetStatusEnum,
      fieldProps: { allowClear: true },
      render: (_, r) => <Tag color={sheetStatusColors[r.sheet_status] || 'default'}>{r.sheet_status}</Tag>,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 140,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => void handleEdit(record)}>
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
        <UniTable<MoldTrialSheetRow>
          headerTitle="试模单"
          columnPersistenceId="apps.haoligo.pages.molds.documents.trial"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          showCreateButton
          createButtonText="新增"
          onCreate={handleCreate}
          request={async (params, _sort, _filter, searchFormValues) => {
            const current = params.current ?? 1;
            const pageSize = params.pageSize ?? 20;
            const skip = (current - 1) * pageSize;
            try {
              const res = await listMoldTrialSheets({
                skip,
                limit: pageSize,
                sheet_status: typeof searchFormValues?.sheet_status === 'string' ? searchFormValues.sheet_status : undefined,
                keyword:
                  typeof searchFormValues?.keyword === 'string' && searchFormValues.keyword.trim()
                    ? searchFormValues.keyword.trim()
                    : undefined,
              });
              return {
                data: res.items,
                success: true,
                total: res.total,
              };
            } catch (e) {
              messageApi.error((e as Error).message || '加载失败');
              return { data: [], success: false, total: 0 };
            }
          }}
          scroll={{ x: 1100 }}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={isEdit ? '编辑试模单' : '新增试模单'}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setEditId(null);
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
        initialValues={formInitialValues}
        loading={formLoading}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <ProFormText
              name="purchase_order_no"
              label="采购订单号"
              placeholder="请输入采购订单号"
              rules={[{ required: true, message: '请输入采购订单号' }]}
            />
          </Col>
          <Col span={12}>
            <ProForm.Item name="supplier_name" label="供应商">
              <AutoComplete
                options={supplierOptions}
                placeholder="请选择或输入供应商"
                allowClear
                filterOption={(input, option) => {
                  const q = input.trim().toLowerCase();
                  if (!q) return true;
                  const label = String(option?.label ?? '').toLowerCase();
                  const value = String(option?.value ?? '').toLowerCase();
                  return label.includes(q) || value.includes(q);
                }}
              />
            </ProForm.Item>
          </Col>
          <Col span={12}>
            <ProFormText name="mold_code" label="模具代号" placeholder="请输入模具代号" />
          </Col>
          <Col span={12}>
            <ProFormText name="mold_name" label="模具名称" placeholder="请输入模具名称" />
          </Col>
          <Col span={12}>
            <ProFormDigit
              name="trial_times"
              label="试模次数"
              placeholder="请输入试模次数"
              min={0}
              fieldProps={{ precision: 0, style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormRadio.Group
              name="trial_result"
              label="试模结果"
              rules={[{ required: true, message: '请选择试模结果' }]}
              options={[
                { label: '合格', value: '合格' },
                { label: '不合格', value: '不合格' },
              ]}
            />
          </Col>
          <Col span={12}>
            <ProFormUploadButton
              name="result_attachments"
              label="试模结果附件"
              max={10}
              fieldProps={uploadFieldProps}
            />
          </Col>
          <Col span={12}>
            <ProFormUploadButton
              name="inspection_attachments"
              label="试模检验附件"
              max={10}
              fieldProps={uploadFieldProps}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="sheet_status"
              label="状态"
              placeholder="请选择状态"
              rules={[{ required: true, message: '请选择状态' }]}
              options={TRIAL_SHEET_STATUSES.map((s) => ({ label: s, value: s }))}
            />
          </Col>
        </Row>
      </FormModalTemplate>
    </>
  );
};

export default MoldTrialSheetsPage;

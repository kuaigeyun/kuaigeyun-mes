/**
 * 好力 GO — 维保完修单（基础信息 + 模具信息；对齐移动端稿）
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActionType,
  ProColumns,
  ProForm,
  ProFormGroup,
  ProFormInstance,
  ProFormList,
  ProFormRadio,
  ProFormSelect,
  ProFormText,
  ProFormUploadButton,
} from '@ant-design/pro-components';
import type { UploadFile } from 'antd/es/upload/interface';
import type { UploadProps } from 'antd';
import { App, Button, Col, Divider, Modal, Row, Space, Upload } from 'antd';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../../components/uni-table';
import { ListPageTemplate, MODAL_CONFIG } from '../../../../../../components/layout-templates';
import { useNewShortcut } from '../../../../../../hooks/useNewShortcut';
import { useSubmitShortcut } from '../../../../../../hooks/useSubmitShortcut';
import { SUBMIT_SHORTCUT_HINT } from '../../../../../../utils/globalSubmitShortcut';
import { getFileDownloadUrl, uploadFile } from '../../../../../../services/file';
import {
  createMoldMaintenanceCompleteSheet,
  deleteMoldMaintenanceCompleteSheet,
  getMoldMaintenanceCompleteSheet,
  listMoldMaintenanceCompleteSheets,
  listMoldMaintenanceSheets,
  updateMoldMaintenanceCompleteSheet,
  type MoldMaintenanceCompleteSheetCreatePayload,
  type MoldMaintenanceCompleteSheetRow,
  type MoldMaintenanceSheetRow,
} from '../../../../services/haoligo';

function normUploadUuids(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  const out: string[] = [];
  for (const item of val) {
    const anyItem = item as { response?: { uuid?: string }; uid?: string };
    const u =
      anyItem?.response?.uuid ??
      (typeof anyItem?.uid === 'string' && /^[0-9a-f-]{36}$/i.test(anyItem.uid) ? anyItem.uid : null);
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

const defaultMoldLine = () => ({
  mold_code: '',
  mold_name: '',
  repair_reason: '',
});

const MoldMaintenanceCompletePage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(undefined);
  const [maintRows, setMaintRows] = useState<MoldMaintenanceSheetRow[]>([]);

  const maintSelectOptions = useMemo(
    () =>
      maintRows.map((r) => ({
        label:
          (r.source_order_no && String(r.source_order_no).trim()) ||
          `维保单#${r.id}${r.primary_mold_code ? ` · ${r.primary_mold_code}` : ''}`,
        value: r.id,
      })),
    [maintRows],
  );

  const loadMaintenanceSheetsForSource = useCallback(async () => {
    try {
      const res = await listMoldMaintenanceSheets({ skip: 0, limit: 200 });
      setMaintRows(res.items);
    } catch {
      setMaintRows([]);
    }
  }, []);

  const uploadFieldProps = useMemo<UploadProps>(
    () => ({
      listType: 'picture-card',
      accept: '.jpg,.jpeg,.png,.gif,.webp',
      beforeUpload: (file) => {
        const isLt30M = (file.size ?? 0) / 1024 / 1024 < 30;
        if (!isLt30M) {
          messageApi.error('单个文件需小于 30MB');
          return Upload.LIST_IGNORE;
        }
        return true;
      },
      customRequest: async (options) => {
        try {
          const file = options.file as Parameters<typeof uploadFile>[0];
          const res = await uploadFile(file, { category: 'haoligo_mold_maint_complete' });
          options.onSuccess?.(res, options.file);
        } catch (err) {
          options.onError?.(err instanceof Error ? err : new Error(String(err)));
        }
      },
    }),
    [messageApi],
  );

  const handleCreate = async () => {
    setIsEdit(false);
    setEditId(null);
    await loadMaintenanceSheetsForSource();
    setFormInitialValues({
      service_type: '维修',
      clear_total_production: false,
      source_maintenance_sheet_id: undefined,
      source_order_no: '',
      header_attachments: [],
      line_items: [defaultMoldLine()],
    });
    setModalVisible(true);
  };

  useNewShortcut(handleCreate);

  const handleEdit = async (record: MoldMaintenanceCompleteSheetRow) => {
    try {
      const d = await getMoldMaintenanceCompleteSheet(record.id);
      await loadMaintenanceSheetsForSource();
      setIsEdit(true);
      setEditId(d.id);
      setFormInitialValues({
        source_maintenance_sheet_id: d.source_maintenance_sheet_id ?? undefined,
        source_order_no: d.source_order_no,
        service_type: d.service_type,
        clear_total_production: d.clear_total_production,
        header_attachments: uuidsToUploadFileList(d.header_attachment_file_uuids),
        line_items: (d.line_items || []).map((it) => ({
          mold_code: it.mold_code,
          mold_name: it.mold_name ?? '',
          repair_reason: it.repair_reason ?? '',
        })),
      });
      setModalVisible(true);
    } catch (e) {
      messageApi.error((e as Error).message || '加载维保完修单失败');
    }
  };

  const handleDeleteOne = (record: MoldMaintenanceCompleteSheetRow) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定删除维保完修单「${record.source_order_no}」吗？`,
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteMoldMaintenanceCompleteSheet(record.id);
          messageApi.success('已删除');
          actionRef.current?.reload();
        } catch (e) {
          messageApi.error((e as Error).message || '删除失败');
        }
      },
    });
  };

  const triggerSubmit = useCallback(() => {
    globalThis.setTimeout(() => {
      const inst = formRef.current;
      if (!inst || typeof inst.submit !== 'function') {
        messageApi.warning('表单未就绪');
        return;
      }
      inst.submit();
    }, 0);
  }, [messageApi]);

  useSubmitShortcut(triggerSubmit, modalVisible);

  const buildPayload = (values: Record<string, unknown>): MoldMaintenanceCompleteSheetCreatePayload => {
    const rawLines = values.line_items;
    const lines = Array.isArray(rawLines) ? rawLines : [];
    const line_items = lines.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        mold_code: String(r.mold_code ?? '').trim(),
        mold_name: String(r.mold_name ?? '').trim() || null,
        repair_reason: String(r.repair_reason ?? '').trim() || null,
      };
    });
    const sid = values.source_maintenance_sheet_id;
    let source_maintenance_sheet_id: number | null = null;
    if (sid !== undefined && sid !== null && sid !== '') {
      const n = Number(sid);
      if (Number.isFinite(n)) source_maintenance_sheet_id = n;
    }
    return {
      source_maintenance_sheet_id,
      source_order_no: String(values.source_order_no ?? '').trim(),
      service_type: values.service_type === '保养' ? '保养' : '维修',
      clear_total_production: Boolean(values.clear_total_production),
      header_attachment_file_uuids: normUploadUuids(values.header_attachments),
      line_items,
    };
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (maintRows.length > 0) {
      const sid = values.source_maintenance_sheet_id;
      if (sid === undefined || sid === null || sid === '') {
        messageApi.error('请选择来源单号');
        return Promise.reject(new Error('validation'));
      }
    }
    const src = String(values.source_order_no ?? '').trim();
    if (!src) {
      messageApi.error('请输入或选择来源单号');
      return Promise.reject(new Error('validation'));
    }
    const payload = buildPayload(values);
    if (!payload.line_items.length) {
      messageApi.error('至少保留一条模具信息');
      return Promise.reject(new Error('validation'));
    }
    for (let i = 0; i < payload.line_items.length; i++) {
      if (!payload.line_items[i].mold_code) {
        messageApi.error(`模具信息第 ${i + 1} 条：请填写模具代号`);
        return Promise.reject(new Error('validation'));
      }
    }
    setFormLoading(true);
    try {
      if (isEdit && editId != null) {
        await updateMoldMaintenanceCompleteSheet(editId, payload);
        messageApi.success('已保存');
      } else {
        await createMoldMaintenanceCompleteSheet(payload);
        messageApi.success('已提交');
      }
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (e) {
      if ((e as Error).message !== 'validation') {
        messageApi.error((e as Error).message || '保存失败');
      }
      return Promise.reject(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setFormLoading(false);
    }
  };

  const onResetForm = () => {
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      service_type: '维修',
      clear_total_production: false,
      source_maintenance_sheet_id: undefined,
      source_order_no: '',
      header_attachments: [],
      line_items: [defaultMoldLine()],
    });
    messageApi.success('已重置');
  };

  const columns: ProColumns<MoldMaintenanceCompleteSheetRow>[] = [
    {
      title: '关键词',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: '来源单号/维修保养' },
    },
    { title: '来源单号', dataIndex: 'source_order_no', width: 160, ellipsis: true, copyable: true },
    { title: '维修/保养', dataIndex: 'service_type', width: 100 },
    {
      title: '清空总产量',
      dataIndex: 'clear_total_production',
      width: 110,
      hideInSearch: true,
      render: (_, r) => (r.clear_total_production ? '是' : '否'),
    },
    { title: '首件模具', dataIndex: 'primary_mold_code', width: 120, ellipsis: true, hideInSearch: true },
    {
      title: '模具条数',
      key: 'line_count',
      width: 88,
      hideInSearch: true,
      render: (_, r) => r.line_items?.length ?? 0,
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
        <UniTable<MoldMaintenanceCompleteSheetRow>
          headerTitle="维保完修单"
          columnPersistenceId="apps.haoligo.pages.molds.documents.maintenance-complete"
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
              const res = await listMoldMaintenanceCompleteSheets({
                skip,
                limit: pageSize,
                keyword:
                  typeof searchFormValues?.keyword === 'string' && searchFormValues.keyword.trim()
                    ? searchFormValues.keyword.trim()
                    : undefined,
              });
              return { data: res.items, success: true, total: res.total };
            } catch (e) {
              messageApi.error((e as Error).message || '加载失败');
              return { data: [], success: false, total: 0 };
            }
          }}
          scroll={{ x: 960 }}
        />
      </ListPageTemplate>

      <Modal
        title={isEdit ? '编辑维保完修单' : '维保完修单'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditId(null);
        }}
        width={MODAL_CONFIG.LARGE_WIDTH}
        destroyOnHidden
        styles={{ body: { background: '#f0f2f5', paddingTop: 12 } }}
        footer={
          <div style={{ display: 'flex', gap: 12, width: '100%' }}>
            <Button htmlType="button" style={{ flex: 1 }} onClick={onResetForm}>
              重置
            </Button>
            <Button htmlType="button" type="primary" style={{ flex: 1 }} loading={formLoading} onClick={triggerSubmit}>
              提交{SUBMIT_SHORTCUT_HINT}
            </Button>
          </div>
        }
      >
        <div
          className="form-modal-content-inner"
          style={{
            background: '#fff',
            borderRadius: 12,
            padding: '4px 8px 12px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}
        >
          <ProForm
            key={modalVisible ? `${isEdit}-${editId ?? 'n'}` : 'closed'}
            formRef={formRef}
            loading={formLoading}
            onFinish={handleSubmit}
            onFinishFailed={({ errorFields }) => {
              const first = errorFields?.[0];
              const text = first?.errors?.filter(Boolean)[0];
              messageApi.error(text || '请检查表单');
            }}
            initialValues={formInitialValues}
            submitter={false}
            layout="vertical"
            scrollToFirstError
          >
            <Divider titlePlacement="left" plain style={{ margin: '8px 0 16px', fontWeight: 600 }}>
              基础信息
            </Divider>
            <Row gutter={[16, 4]}>
              <Col span={12}>
                {maintSelectOptions.length > 0 ? (
                  <ProFormSelect
                    name="source_maintenance_sheet_id"
                    label="来源单号"
                    placeholder="请选择来源单号"
                    rules={[{ required: true, message: '请选择来源单号' }]}
                    options={maintSelectOptions}
                    showSearch
                    fieldProps={{
                      optionFilterProp: 'label',
                      allowClear: false,
                      onChange: (id: number | string) => {
                        const n = typeof id === 'string' ? Number(id) : id;
                        const r = maintRows.find((x) => x.id === n);
                        formRef.current?.setFieldsValue({
                          source_order_no:
                            (r?.source_order_no && String(r.source_order_no).trim()) || `维保单#${n}`,
                        });
                      },
                    }}
                  />
                ) : (
                  <ProFormText
                    name="source_order_no"
                    label="来源单号"
                    placeholder="请选择来源单号（暂无维保单时下拉为空，请手输）"
                    rules={[{ required: true, message: '请输入来源单号' }]}
                  />
                )}
              </Col>
              {maintSelectOptions.length > 0 ? (
                <ProFormText name="source_order_no" hidden />
              ) : null}
              <Col span={12}>
                <ProFormSelect
                  name="service_type"
                  label="维修/保养"
                  placeholder="请选择维修/保养"
                  rules={[{ required: true, message: '请选择维修/保养' }]}
                  options={[
                    { label: '维修', value: '维修' },
                    { label: '保养', value: '保养' },
                  ]}
                />
              </Col>
              <Col span={12}>
                <ProFormRadio.Group
                  name="clear_total_production"
                  label="是否清空总产量"
                  rules={[{ required: true, message: '请选择是否清空总产量' }]}
                  options={[
                    { label: '否', value: false },
                    { label: '是', value: true },
                  ]}
                />
              </Col>
              <Col span={12}>
                <ProFormUploadButton
                  name="header_attachments"
                  label="附件照片"
                  max={10}
                  fieldProps={uploadFieldProps}
                />
              </Col>
            </Row>

            <Divider titlePlacement="left" plain style={{ margin: '20px 0 12px', fontWeight: 600 }}>
              模具信息
            </Divider>
            <ProFormList
              name="line_items"
              min={1}
              copyIconProps={false}
              creatorButtonProps={{
                position: 'top',
                creatorButtonText: '+ 添加模具',
                type: 'default',
                style: {
                  color: '#1677ff',
                  borderColor: '#91caff',
                  fontWeight: 500,
                  marginBottom: 12,
                },
              }}
            >
              {(meta, index) => (
                <ProFormGroup
                  key={meta.key}
                  title={`模具 ${index + 1}`}
                  style={{
                    marginBottom: 16,
                    paddingBottom: 8,
                    borderBottom: '1px solid #f0f0f0',
                  }}
                >
                  <Row gutter={[16, 4]}>
                    <Col span={12}>
                      <ProFormText
                        name="mold_code"
                        label="模具代号"
                        placeholder="请输入模具代号"
                        rules={[{ required: true, message: '请填写模具代号' }]}
                      />
                    </Col>
                    <Col span={12}>
                      <ProFormText name="mold_name" label="模具名称" placeholder="请输入模具名称" />
                    </Col>
                    <Col span={24}>
                      <ProFormText name="repair_reason" label="维修原因" placeholder="请输入维修原因" />
                    </Col>
                  </Row>
                </ProFormGroup>
              )}
            </ProFormList>
          </ProForm>
        </div>
      </Modal>
    </>
  );
};

export default MoldMaintenanceCompletePage;

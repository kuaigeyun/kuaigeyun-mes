/**
 * 好力 GO — 外协维保单（基础信息 + 多条模具明细；对齐移动端稿）
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionType,
  ProColumns,
  ProForm,
  ProFormDigit,
  ProFormGroup,
  ProFormInstance,
  ProFormList,
  ProFormSelect,
  ProFormText,
  ProFormUploadButton,
} from '@ant-design/pro-components';
import type { UploadFile } from 'antd/es/upload/interface';
import type { UploadProps } from 'antd';
import { App, Button, Col, Divider, Input, Modal, Row, Space, Table, Upload } from 'antd';
import { DeleteOutlined, EditOutlined, ScanOutlined, SwapOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../../components/uni-table';
import { ListPageTemplate, MODAL_CONFIG } from '../../../../../../components/layout-templates';
import { useNewShortcut } from '../../../../../../hooks/useNewShortcut';
import { useSubmitShortcut } from '../../../../../../hooks/useSubmitShortcut';
import { SUBMIT_SHORTCUT_HINT } from '../../../../../../utils/globalSubmitShortcut';
import { getFileDownloadUrl, uploadFile } from '../../../../../../services/file';
import { supplierApi, unwrapSupplyPagedList } from '../../../../../../apps/master-data/services/supply-chain';
import type { Supplier } from '../../../../../../apps/master-data/types/supply-chain';
import {
  createMoldOutsourceMaintenanceSheet,
  deleteMoldOutsourceMaintenanceSheet,
  getMoldOutsourceMaintenanceSheet,
  listMoldOutsourceMaintenanceSheets,
  listMolds,
  updateMoldOutsourceMaintenanceSheet,
  type MoldOutsourceMaintenanceSheetCreatePayload,
  type MoldOutsourceMaintenanceSheetRow,
  type MoldRow,
} from '../../../../services/haoligo';

type SupplierOpt = { key: string; value: string; label: string; code: string };

const REPAIR_REASONS = ['磨损', '裂纹', '变形', '尺寸超差', '配合不良', '锈蚀', '其他'];

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

const defaultLineItem = () => ({
  mold_code: '',
  mold_name: '',
  repair_reason: undefined as string | undefined,
  repair_cost: undefined as number | undefined,
  item_attachments: [] as UploadFile[],
});

const MoldOutsourceMaintenancePage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(undefined);
  const [supplierOptions, setSupplierOptions] = useState<SupplierOpt[]>([]);
  const [moldPickRow, setMoldPickRow] = useState<number | null>(null);
  const [moldPickerOpen, setMoldPickerOpen] = useState(false);
  const [moldRows, setMoldRows] = useState<MoldRow[]>([]);
  const [moldKw, setMoldKw] = useState('');
  const [moldLoading, setMoldLoading] = useState(false);
  const [outsourcedUnitFallback, setOutsourcedUnitFallback] = useState<{ label: string; value: string } | null>(null);

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
            code: s.code ?? '',
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

  const outsourcedSelectOptions = useMemo(() => {
    const base = supplierOptions.map((o) => ({ label: o.label, value: o.value }));
    if (outsourcedUnitFallback && !base.some((b) => b.value === outsourcedUnitFallback.value)) {
      return [outsourcedUnitFallback, ...base];
    }
    return base;
  }, [supplierOptions, outsourcedUnitFallback]);

  const loadMoldsForPicker = useCallback(async () => {
    setMoldLoading(true);
    try {
      const res = await listMolds({ limit: 200, skip: 0 });
      setMoldRows(res.items);
    } catch {
      setMoldRows([]);
    } finally {
      setMoldLoading(false);
    }
  }, []);

  const filteredMolds = useMemo(() => {
    const q = moldKw.trim().toLowerCase();
    if (!q) return moldRows;
    return moldRows.filter(
      (r) =>
        r.mold_code.toLowerCase().includes(q) ||
        (r.name && r.name.toLowerCase().includes(q)),
    );
  }, [moldRows, moldKw]);

  const uploadFieldProps = useMemo(
    (): Partial<UploadProps> => ({
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
      customRequest: async (options, _info) => {
        try {
          const file = options.file as Parameters<typeof uploadFile>[0];
          const res = await uploadFile(file, { category: 'haoligo_mold_outsource_maint' });
          options.onSuccess?.(res, options.file);
        } catch (err) {
          options.onError?.(err instanceof Error ? err : new Error(String(err)));
        }
      },
    }),
    [messageApi],
  );

  const handleCreate = () => {
    setOutsourcedUnitFallback(null);
    setIsEdit(false);
    setEditId(null);
    setFormInitialValues({
      service_type: '维修',
      outsourced_unit_name: undefined,
      outsourced_unit_code: undefined,
      source_order_no: undefined,
      header_attachments: [],
      line_items: [defaultLineItem()],
    });
    setModalVisible(true);
  };

  useNewShortcut(handleCreate);

  const handleEdit = async (record: MoldOutsourceMaintenanceSheetRow) => {
    try {
      const d = await getMoldOutsourceMaintenanceSheet(record.id);
      setIsEdit(true);
      setEditId(d.id);
      setOutsourcedUnitFallback(
        d.outsourced_unit_name && !supplierOptions.some((o) => o.value === d.outsourced_unit_name)
          ? { label: d.outsourced_unit_name, value: d.outsourced_unit_name }
          : null,
      );
      setFormInitialValues({
        service_type: d.service_type,
        outsourced_unit_name: d.outsourced_unit_name,
        outsourced_unit_code: d.outsourced_unit_code ?? undefined,
        source_order_no: d.source_order_no ?? undefined,
        header_attachments: uuidsToUploadFileList(d.header_attachment_file_uuids),
        line_items: (d.line_items || []).map((it) => ({
          mold_code: it.mold_code,
          mold_name: it.mold_name ?? '',
          repair_reason: it.repair_reason,
          repair_cost: it.repair_cost != null && it.repair_cost !== '' ? Number(it.repair_cost) : undefined,
          item_attachments: uuidsToUploadFileList(it.attachment_file_uuids),
        })),
      });
      setModalVisible(true);
    } catch (e) {
      messageApi.error((e as Error).message || '加载外协维保单失败');
    }
  };

  const handleDeleteOne = (record: MoldOutsourceMaintenanceSheetRow) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定删除外协维保单（${record.outsourced_unit_name} / ${record.primary_mold_code ?? '-'}）吗？`,
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteMoldOutsourceMaintenanceSheet(record.id);
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

  const buildPayload = (values: Record<string, unknown>): MoldOutsourceMaintenanceSheetCreatePayload => {
    const rawLines = values.line_items;
    const lines = Array.isArray(rawLines) ? rawLines : [];
    const line_items = lines.map((row) => {
      const r = row as Record<string, unknown>;
      const costRaw = r.repair_cost;
      let repair_cost: string | number | null = null;
      if (costRaw !== undefined && costRaw !== null && costRaw !== '') {
        const n = Number(costRaw);
        repair_cost = Number.isFinite(n) ? n : null;
      }
      return {
        mold_code: String(r.mold_code ?? '').trim(),
        mold_name: String(r.mold_name ?? '').trim() || null,
        repair_reason: String(r.repair_reason ?? '').trim(),
        repair_cost,
        attachment_file_uuids: normUploadUuids(r.item_attachments),
      };
    });
    return {
      outsourced_unit_code: String(values.outsourced_unit_code ?? '').trim() || null,
      outsourced_unit_name: String(values.outsourced_unit_name ?? '').trim(),
      service_type: values.service_type === '保养' ? '保养' : '维修',
      source_order_no: String(values.source_order_no ?? '').trim() || null,
      header_attachment_file_uuids: normUploadUuids(values.header_attachments),
      line_items,
    };
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    const unit = String(values.outsourced_unit_name ?? '').trim();
    if (!unit) {
      messageApi.error('请选择或输入外协单位');
      return Promise.reject(new Error('validation'));
    }
    const payload = buildPayload(values);
    if (!payload.line_items.length) {
      messageApi.error('至少保留一条模具信息');
      return Promise.reject(new Error('validation'));
    }
    for (let i = 0; i < payload.line_items.length; i++) {
      const li = payload.line_items[i];
      if (!li.mold_code) {
        messageApi.error(`模具信息第 ${i + 1} 条：请填写模具代号`);
        return Promise.reject(new Error('validation'));
      }
      if (!li.repair_reason) {
        messageApi.error(`模具信息第 ${i + 1} 条：请选择维修原因`);
        return Promise.reject(new Error('validation'));
      }
    }
    setFormLoading(true);
    try {
      if (isEdit && editId != null) {
        await updateMoldOutsourceMaintenanceSheet(editId, payload);
        messageApi.success('已保存');
      } else {
        await createMoldOutsourceMaintenanceSheet(payload);
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
    setOutsourcedUnitFallback(null);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      service_type: '维修',
      header_attachments: [],
      line_items: [defaultLineItem()],
    });
    messageApi.success('已重置');
  };

  const applyMoldToRow = (rowIndex: number, m: MoldRow) => {
    const inst = formRef.current;
    if (!inst) return;
    const cur = (inst.getFieldValue('line_items') as Record<string, unknown>[]) || [];
    const next = cur.map((row, i) =>
      i === rowIndex
        ? { ...row, mold_code: m.mold_code, mold_name: m.name }
        : row,
    );
    inst.setFieldsValue({ line_items: next });
  };

  const columns: ProColumns<MoldOutsourceMaintenanceSheetRow>[] = [
    {
      title: '关键词',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: '外协单位/来源单号/类型' },
    },
    { title: '外协单位', dataIndex: 'outsourced_unit_name', width: 180, ellipsis: true },
    { title: '维修/保养', dataIndex: 'service_type', width: 100 },
    { title: '来源单号', dataIndex: 'source_order_no', width: 140, ellipsis: true, copyable: true },
    { title: '首件模具', dataIndex: 'primary_mold_code', width: 120, ellipsis: true, hideInSearch: true },
    {
      title: '明细条数',
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
        <UniTable<MoldOutsourceMaintenanceSheetRow>
          headerTitle="外协维保单"
          columnPersistenceId="apps.haoligo.pages.molds.documents.outsource-maintenance"
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
              const res = await listMoldOutsourceMaintenanceSheets({
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
          scroll={{ x: 980 }}
        />
      </ListPageTemplate>

      <Modal
        title={isEdit ? '编辑外协维保单' : '外协维保单'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditId(null);
          setMoldPickRow(null);
          setOutsourcedUnitFallback(null);
        }}
        width={MODAL_CONFIG.LARGE_WIDTH}
        destroyOnHidden
        styles={{ body: { background: '#f0f2f5', paddingTop: 12 } }}
        footer={
          <Space direction="vertical" style={{ width: '100%' }} size={10}>
            <Button htmlType="button" block onClick={onResetForm}>
              重置
            </Button>
            <Button htmlType="button" type="primary" block loading={formLoading} onClick={triggerSubmit}>
              提交{SUBMIT_SHORTCUT_HINT}
            </Button>
          </Space>
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
                <ProFormSelect
                  name="outsourced_unit_name"
                  label="外协单位"
                  placeholder="请选择外协单位"
                  rules={[{ required: true, message: '请选择外协单位' }]}
                  options={outsourcedSelectOptions}
                  showSearch
                  fieldProps={{
                    allowClear: true,
                    optionFilterProp: 'label',
                    onChange: (name: string) => {
                      const o = supplierOptions.find((x) => x.value === name);
                      formRef.current?.setFieldsValue({
                        outsourced_unit_code: o?.code || undefined,
                      });
                    },
                  }}
                />
              </Col>
              <ProFormText name="outsourced_unit_code" hidden />
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
                <ProFormText
                  name="source_order_no"
                  label="来源单号"
                  placeholder="请选择来源单号（可手输）"
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
                  color: '#0d9488',
                  borderColor: '#5eead4',
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
                        label={
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            模具代号
                            <Button
                              type="text"
                              size="small"
                              icon={<SwapOutlined />}
                              onClick={(e) => {
                                e.preventDefault();
                                setMoldPickRow(index);
                                setMoldPickerOpen(true);
                                void loadMoldsForPicker();
                              }}
                              aria-label="从台账选择模具"
                              title="从台账选择模具"
                            />
                          </span>
                        }
                        placeholder="请输入内容"
                        rules={[{ required: true, message: '请填写模具代号' }]}
                        fieldProps={{
                          addonAfter: (
                            <Button
                              type="text"
                              size="small"
                              icon={<ScanOutlined />}
                              onClick={() =>
                                messageApi.info('请使用扫码设备扫描模具条码，代号将填入本行')
                              }
                              aria-label="扫码"
                            />
                          ),
                        }}
                      />
                    </Col>
                    <Col span={12}>
                      <ProFormText
                        name="mold_name"
                        label="模具名称"
                        placeholder="根据模具代号自动带出"
                        fieldProps={{ readOnly: true }}
                      />
                    </Col>
                    <Col span={12}>
                      <ProFormSelect
                        name="repair_reason"
                        label="维修原因"
                        placeholder="请选择维修原因"
                        rules={[{ required: true, message: '请选择维修原因' }]}
                        options={REPAIR_REASONS.map((t) => ({ label: t, value: t }))}
                        showSearch
                        fieldProps={{ optionFilterProp: 'label' }}
                      />
                    </Col>
                    <Col span={12}>
                      <ProFormDigit
                        name="repair_cost"
                        label="维修费用（元）"
                        placeholder="请输入维修费用（元）"
                        min={0}
                        fieldProps={{ precision: 2, style: { width: '100%' } }}
                      />
                    </Col>
                    <Col span={24}>
                      <ProFormUploadButton
                        name="item_attachments"
                        label="维修模具图片附件"
                        max={8}
                        fieldProps={uploadFieldProps}
                      />
                    </Col>
                  </Row>
                </ProFormGroup>
              )}
            </ProFormList>
          </ProForm>
        </div>
      </Modal>

      <Modal
        title="选择模具"
        open={moldPickerOpen}
        onCancel={() => {
          setMoldPickerOpen(false);
          setMoldPickRow(null);
        }}
        width={720}
        footer={null}
        destroyOnHidden
      >
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Input placeholder="筛选模具代号/名称" value={moldKw} onChange={(e) => setMoldKw(e.target.value)} allowClear />
          <Table<MoldRow>
            size="small"
            rowKey="id"
            loading={moldLoading}
            pagination={false}
            scroll={{ y: 360 }}
            dataSource={filteredMolds}
            columns={[
              { title: '模具代号', dataIndex: 'mold_code', width: 120 },
              { title: '模具名称', dataIndex: 'name', ellipsis: true },
              {
                title: '操作',
                key: 'op',
                width: 88,
                render: (_, r) => (
                  <Button
                    type="link"
                    size="small"
                    onClick={() => {
                      if (moldPickRow != null) {
                        applyMoldToRow(moldPickRow, r);
                        messageApi.success(`已选择模具 ${r.mold_code}`);
                      }
                      setMoldPickerOpen(false);
                      setMoldPickRow(null);
                    }}
                  >
                    选用
                  </Button>
                ),
              },
            ]}
          />
        </Space>
      </Modal>
    </>
  );
};

export default MoldOutsourceMaintenancePage;

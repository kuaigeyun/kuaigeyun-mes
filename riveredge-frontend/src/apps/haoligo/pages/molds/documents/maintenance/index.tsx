/**
 * 好力 GO — 厂内维保单（申请部门 + 维修/保养 + 多条模具明细；与外协维保单明细结构一致）
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
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
import { DeleteOutlined, EditOutlined, ScanOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../../components/uni-table';
import { ListPageTemplate, MODAL_CONFIG } from '../../../../../../components/layout-templates';
import { useNewShortcut } from '../../../../../../hooks/useNewShortcut';
import { useSubmitShortcut } from '../../../../../../hooks/useSubmitShortcut';
import { SUBMIT_SHORTCUT_HINT } from '../../../../../../utils/globalSubmitShortcut';
import { getFileDownloadUrl, uploadFile } from '../../../../../../services/file';
import type { DepartmentTreeItem } from '../../../../../../services/department';
import { getDepartmentTree } from '../../../../../../services/department';
import {
  createMoldMaintenanceSheet,
  deleteMoldMaintenanceSheet,
  getMoldMaintenanceSheet,
  listMoldMaintenanceSheets,
  listMolds,
  updateMoldMaintenanceSheet,
  type MoldMaintenanceSheetCreatePayload,
  type MoldMaintenanceSheetRow,
  type MoldRow,
} from '../../../../services/haoligo';

function flattenDepartmentOptions(
  items: DepartmentTreeItem[],
  prefix = '',
): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  for (const n of items) {
    const label = prefix ? `${prefix} / ${n.name}` : n.name;
    out.push({ label, value: n.uuid });
    if (n.children?.length) {
      out.push(...flattenDepartmentOptions(n.children, label));
    }
  }
  return out;
}

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

const MoldMaintenancePage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(undefined);
  const [deptOptions, setDeptOptions] = useState<{ label: string; value: string }[]>([]);
  const [moldPickRow, setMoldPickRow] = useState<number | null>(null);
  const [moldPickerOpen, setMoldPickerOpen] = useState(false);
  const [moldRows, setMoldRows] = useState<MoldRow[]>([]);
  const [moldKw, setMoldKw] = useState('');
  const [moldLoading, setMoldLoading] = useState(false);

  const deptLabelByUuid = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of deptOptions) m.set(o.value, o.label);
    return m;
  }, [deptOptions]);

  const loadDepartments = useCallback(async () => {
    try {
      const tree = await getDepartmentTree({ is_active: true });
      setDeptOptions(flattenDepartmentOptions(tree.items || []));
    } catch {
      setDeptOptions([]);
    }
  }, []);

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
          const res = await uploadFile(file, { category: 'haoligo_mold_maint' });
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
    await loadDepartments();
    setFormInitialValues({
      service_type: '维修',
      department_uuid: undefined,
      source_order_no: undefined,
      header_attachments: [],
      line_items: [defaultLineItem()],
    });
    setModalVisible(true);
  };

  useNewShortcut(handleCreate);

  const handleEdit = async (record: MoldMaintenanceSheetRow) => {
    try {
      const d = await getMoldMaintenanceSheet(record.id);
      setIsEdit(true);
      setEditId(d.id);
      await loadDepartments();
      setFormInitialValues({
        service_type: d.service_type,
        department_uuid: d.department_uuid ?? undefined,
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
      messageApi.error((e as Error).message || '加载维保单失败');
    }
  };

  const handleDeleteOne = (record: MoldMaintenanceSheetRow) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定删除维保单（${record.department_name ?? '-'} / ${record.primary_mold_code ?? '-'}）吗？`,
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteMoldMaintenanceSheet(record.id);
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

  const buildPayload = (values: Record<string, unknown>): MoldMaintenanceSheetCreatePayload => {
    const deptUuid = typeof values.department_uuid === 'string' ? values.department_uuid.trim() : '';
    const deptName = deptLabelByUuid.get(deptUuid) || String(values.department_name ?? '').trim();
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
      department_uuid: deptUuid || null,
      department_name: deptName,
      service_type: values.service_type === '保养' ? '保养' : '维修',
      source_order_no: String(values.source_order_no ?? '').trim() || null,
      header_attachment_file_uuids: normUploadUuids(values.header_attachments),
      line_items,
    };
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    const deptUuid = typeof values.department_uuid === 'string' ? values.department_uuid.trim() : '';
    if (!deptUuid) {
      messageApi.error('请选择申请部门');
      return Promise.reject(new Error('validation'));
    }
    const deptName = deptLabelByUuid.get(deptUuid);
    if (!deptName) {
      messageApi.error('申请部门无效，请重新选择');
      return Promise.reject(new Error('validation'));
    }
    const payload = buildPayload({ ...values, department_name: deptName });
    if (!payload.line_items.length) {
      messageApi.error('至少保留一条模具明细');
      return Promise.reject(new Error('validation'));
    }
    for (let i = 0; i < payload.line_items.length; i++) {
      const li = payload.line_items[i];
      if (!li.mold_code) {
        messageApi.error(`模具明细第 ${i + 1} 行：请填写模具代号`);
        return Promise.reject(new Error('validation'));
      }
      if (!li.repair_reason) {
        messageApi.error(`模具明细第 ${i + 1} 行：请选择维修原因`);
        return Promise.reject(new Error('validation'));
      }
    }
    setFormLoading(true);
    try {
      if (isEdit && editId != null) {
        await updateMoldMaintenanceSheet(editId, payload);
        messageApi.success('已保存');
      } else {
        await createMoldMaintenanceSheet(payload);
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

  const columns: ProColumns<MoldMaintenanceSheetRow>[] = [
    {
      title: '关键词',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: '部门/来源单号/类型' },
    },
    { title: '申请部门', dataIndex: 'department_name', width: 180, ellipsis: true },
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
        <UniTable<MoldMaintenanceSheetRow>
          headerTitle="维保单"
          columnPersistenceId="apps.haoligo.pages.molds.documents.maintenance"
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
              const res = await listMoldMaintenanceSheets({
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
        title={isEdit ? '编辑维保单' : '维保单'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditId(null);
          setMoldPickRow(null);
        }}
        width={MODAL_CONFIG.LARGE_WIDTH}
        destroyOnHidden
        footer={
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Button htmlType="button" onClick={onResetForm}>
              重置
            </Button>
            <Button htmlType="button" type="primary" loading={formLoading} onClick={triggerSubmit}>
              提交{SUBMIT_SHORTCUT_HINT}
            </Button>
          </div>
        }
      >
        <div className="form-modal-content-inner">
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
            <Divider titlePlacement="left">基础信息</Divider>
            <Row gutter={16}>
              <Col span={12}>
                <ProFormSelect
                  name="department_uuid"
                  label="申请部门"
                  placeholder="请选择申请部门"
                  rules={[{ required: true, message: '请选择申请部门' }]}
                  options={deptOptions}
                  showSearch
                  fieldProps={{ optionFilterProp: 'label' }}
                />
              </Col>
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
                <ProFormText name="source_order_no" label="来源单号" placeholder="可手输来源单号" />
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

            <Divider titlePlacement="left">模具明细</Divider>
            <ProFormList
              name="line_items"
              min={1}
              copyIconProps={false}
              creatorButtonProps={{ creatorButtonText: '添加模具' }}
            >
              {(meta, index) => (
                <ProFormGroup key={meta.key} title={`模具 ${index + 1}`}>
                  <Row gutter={16}>
                    <Col span={12}>
                      <ProFormText
                        name="mold_code"
                        label="模具代号"
                        placeholder="请选择模具代号"
                        rules={[{ required: true, message: '请填写模具代号' }]}
                        fieldProps={{
                          addonAfter: (
                            <Space size={0}>
                              <Button
                                type="link"
                                size="small"
                                icon={<ScanOutlined />}
                                onClick={() =>
                                  messageApi.info('请使用扫码设备扫描模具条码，代号将填入本行')
                                }
                                aria-label="扫码"
                              />
                              <Button
                                type="link"
                                size="small"
                                onClick={() => {
                                  setMoldPickRow(index);
                                  setMoldPickerOpen(true);
                                  void loadMoldsForPicker();
                                }}
                              >
                                选择
                              </Button>
                            </Space>
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

export default MoldMaintenancePage;

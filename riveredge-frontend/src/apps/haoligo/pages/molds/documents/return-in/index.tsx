/**
 * 好力 GO — 还入单（列表 + 两栏 Modal，底栏：重置 / 转入 / 提交；对齐移动端稿）
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActionType,
  ProColumns,
  ProForm,
  ProFormDigit,
  ProFormInstance,
  ProFormSelect,
  ProFormText,
} from '@ant-design/pro-components';
import { App, Button, Col, Input, Modal, Row, Space, Table } from 'antd';
import { DeleteOutlined, EditOutlined, ScanOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../../components/uni-table';
import { ListPageTemplate, MODAL_CONFIG } from '../../../../../../components/layout-templates';
import { useNewShortcut } from '../../../../../../hooks/useNewShortcut';
import { useSubmitShortcut } from '../../../../../../hooks/useSubmitShortcut';
import { SUBMIT_SHORTCUT_HINT } from '../../../../../../utils/globalSubmitShortcut';
import type { DepartmentTreeItem } from '../../../../../../services/department';
import { getDepartmentTree } from '../../../../../../services/department';
import {
  createMoldReturnSheet,
  deleteMoldReturnSheet,
  getMoldReturnSheet,
  listMoldBorrowSheets,
  listMoldReturnSheets,
  listMolds,
  updateMoldReturnSheet,
  type MoldBorrowSheetRow,
  type MoldReturnSheetCreatePayload,
  type MoldReturnSheetRow,
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

const MoldReturnInPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(undefined);
  const [deptOptions, setDeptOptions] = useState<{ label: string; value: string }[]>([]);
  const [borrowPickerOpen, setBorrowPickerOpen] = useState(false);
  const [borrowRows, setBorrowRows] = useState<MoldBorrowSheetRow[]>([]);
  const [borrowKw, setBorrowKw] = useState('');
  const [borrowLoading, setBorrowLoading] = useState(false);
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

  const loadBorrowsForPicker = useCallback(async () => {
    setBorrowLoading(true);
    try {
      const res = await listMoldBorrowSheets({ limit: 200, skip: 0 });
      setBorrowRows(res.items);
    } catch {
      setBorrowRows([]);
    } finally {
      setBorrowLoading(false);
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

  const filteredBorrows = useMemo(() => {
    const q = borrowKw.trim().toLowerCase();
    if (!q) return borrowRows;
    return borrowRows.filter(
      (r) =>
        String(r.id).includes(q) ||
        (r.source_order_no && r.source_order_no.toLowerCase().includes(q)) ||
        r.department_name.toLowerCase().includes(q) ||
        r.mold_code.toLowerCase().includes(q) ||
        r.mold_name.toLowerCase().includes(q),
    );
  }, [borrowRows, borrowKw]);

  const filteredMolds = useMemo(() => {
    const q = moldKw.trim().toLowerCase();
    if (!q) return moldRows;
    return moldRows.filter(
      (r) =>
        r.mold_code.toLowerCase().includes(q) ||
        (r.name && r.name.toLowerCase().includes(q)),
    );
  }, [moldRows, moldKw]);

  const handleCreate = async () => {
    setIsEdit(false);
    setEditId(null);
    setFormInitialValues({
      production_order_no: undefined,
      borrow_sheet_no: undefined,
      issue_department_uuid: undefined,
      mold_code: undefined,
      mold_name: undefined,
      finished_product_code: undefined,
      finished_product_name: undefined,
      manufacture_qty: undefined,
    });
    await loadDepartments();
    setModalVisible(true);
  };

  useNewShortcut(handleCreate);

  const handleEdit = async (record: MoldReturnSheetRow) => {
    try {
      const d = await getMoldReturnSheet(record.id);
      setIsEdit(true);
      setEditId(d.id);
      setFormInitialValues({
        production_order_no: d.production_order_no ?? undefined,
        borrow_sheet_no: d.borrow_sheet_no ?? undefined,
        issue_department_uuid: d.issue_department_uuid ?? undefined,
        mold_code: d.mold_code,
        mold_name: d.mold_name,
        finished_product_code: d.finished_product_code ?? undefined,
        finished_product_name: d.finished_product_name ?? undefined,
        manufacture_qty: d.manufacture_qty != null ? Number(d.manufacture_qty) : undefined,
      });
      await loadDepartments();
      setModalVisible(true);
    } catch (e) {
      messageApi.error((e as Error).message || '加载还入单失败');
    }
  };

  const handleDeleteOne = (record: MoldReturnSheetRow) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定删除还入单（${record.mold_code}）吗？`,
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteMoldReturnSheet(record.id);
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

  const buildPayload = (values: Record<string, unknown>): MoldReturnSheetCreatePayload => {
    const deptUuid = typeof values.issue_department_uuid === 'string' ? values.issue_department_uuid.trim() : '';
    const deptName = deptLabelByUuid.get(deptUuid) || String(values.issue_department_name ?? '').trim() || null;
    return {
      production_order_no: String(values.production_order_no ?? '').trim() || null,
      borrow_sheet_no: String(values.borrow_sheet_no ?? '').trim() || null,
      issue_department_uuid: deptUuid || null,
      issue_department_name: deptName,
      mold_code: String(values.mold_code ?? '').trim(),
      mold_name: String(values.mold_name ?? '').trim(),
      finished_product_code: String(values.finished_product_code ?? '').trim() || null,
      finished_product_name: String(values.finished_product_name ?? '').trim() || null,
      manufacture_qty: (() => {
        const v = values.manufacture_qty;
        if (v === undefined || v === null || v === '') return 0;
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
      })(),
    };
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    const deptUuid = typeof values.issue_department_uuid === 'string' ? values.issue_department_uuid.trim() : '';
    if (!deptUuid) {
      messageApi.error('请选择领出部门，或点「转入」从领用单带入');
      return Promise.reject(new Error('validation'));
    }
    const deptName = deptLabelByUuid.get(deptUuid);
    if (!deptName) {
      messageApi.error('领出部门无效，请重新选择');
      return Promise.reject(new Error('validation'));
    }
    const mq = values.manufacture_qty;
    const mqNum = mq === undefined || mq === null || mq === '' ? NaN : Number(mq);
    if (!Number.isFinite(mqNum) || mqNum <= 0) {
      messageApi.error('制造数量须大于 0');
      return Promise.reject(new Error('validation'));
    }
    setFormLoading(true);
    try {
      const payload = buildPayload({ ...values, issue_department_name: deptName });
      if (isEdit && editId != null) {
        await updateMoldReturnSheet(editId, payload);
        messageApi.success('已保存');
      } else {
        await createMoldReturnSheet(payload);
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
    messageApi.success('已重置');
  };

  const onOpenTransferIn = () => {
    setBorrowPickerOpen(true);
    void loadBorrowsForPicker();
  };

  const onScanProductionClick = () => {
    messageApi.info('请使用扫码设备扫描制令单条码（制令单号将填入上方）');
  };

  const columns: ProColumns<MoldReturnSheetRow>[] = [
    {
      title: '关键词',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: '制令单/领用单/模具/部门/成品' },
    },
    { title: '制令单', dataIndex: 'production_order_no', width: 130, ellipsis: true, copyable: true },
    { title: '领用单', dataIndex: 'borrow_sheet_no', width: 120, ellipsis: true, copyable: true },
    { title: '领出部门', dataIndex: 'issue_department_name', width: 150, ellipsis: true },
    { title: '模具代号', dataIndex: 'mold_code', width: 110, ellipsis: true },
    { title: '模具名称', dataIndex: 'mold_name', width: 150, ellipsis: true },
    { title: '成品代号', dataIndex: 'finished_product_code', width: 110, ellipsis: true, hideInSearch: true },
    { title: '成品名称', dataIndex: 'finished_product_name', width: 130, ellipsis: true, hideInSearch: true },
    { title: '制造数量', dataIndex: 'manufacture_qty', width: 100, hideInSearch: true },
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
        <UniTable<MoldReturnSheetRow>
          headerTitle="还入单"
          columnPersistenceId="apps.haoligo.pages.molds.documents.return-in"
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
              const res = await listMoldReturnSheets({
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
          scroll={{ x: 1180 }}
        />
      </ListPageTemplate>

      <Modal
        title={isEdit ? '编辑还入单' : '还入单'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditId(null);
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
            <Space>
              <Button htmlType="button" type="primary" onClick={onOpenTransferIn}>
                转入
              </Button>
              <Button htmlType="button" type="primary" loading={formLoading} onClick={triggerSubmit}>
                提交{SUBMIT_SHORTCUT_HINT}
              </Button>
            </Space>
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
            <Row gutter={16}>
              <Col span={12}>
                <ProForm.Item name="production_order_no" label="制令单" tooltip="可手输或扫码填入制令单号">
                  <Input
                    placeholder="请输入内容"
                    allowClear
                    suffix={
                      <Button type="text" size="small" icon={<ScanOutlined />} onClick={onScanProductionClick} aria-label="扫描" />
                    }
                  />
                </ProForm.Item>
              </Col>
              <Col span={12}>
                <ProFormText
                  name="borrow_sheet_no"
                  label="领用单"
                  placeholder="请输入或点「转入」选择领用单"
                  tooltip="可手输领用单号，或点底栏「转入」从领用单列表带入"
                />
              </Col>
              <Col span={12}>
                <ProFormSelect
                  name="issue_department_uuid"
                  label="领出部门"
                  placeholder="请选择领出部门"
                  rules={[{ required: true, message: '请选择领出部门' }]}
                  options={deptOptions}
                  showSearch
                  fieldProps={{ optionFilterProp: 'label' }}
                />
              </Col>
              <Col span={12}>
                <ProFormText
                  name="mold_code"
                  label="模具代号"
                  placeholder="请输入内容"
                  rules={[{ required: true, message: '请输入模具代号' }]}
                  fieldProps={{
                    addonAfter: (
                      <Button
                        type="link"
                        size="small"
                        style={{ padding: 0 }}
                        onClick={() => {
                          setMoldPickerOpen(true);
                          void loadMoldsForPicker();
                        }}
                      >
                        选择
                      </Button>
                    ),
                  }}
                />
              </Col>
              <Col span={12}>
                <ProFormText name="mold_name" label="模具名称" placeholder="请输入内容" rules={[{ required: true, message: '请输入模具名称' }]} />
              </Col>
              <Col span={12}>
                <ProFormText name="finished_product_code" label="成品代号" placeholder="请输入内容" />
              </Col>
              <Col span={12}>
                <ProFormText name="finished_product_name" label="成品名称" placeholder="请输入内容" />
              </Col>
              <Col span={12}>
                <ProFormDigit
                  name="manufacture_qty"
                  label="制造数量"
                  placeholder="请输入内容"
                  rules={[
                    { required: true, message: '请输入制造数量' },
                    {
                      validator: async (_, v) => {
                        const n = v === undefined || v === null || v === '' ? NaN : Number(v);
                        if (!Number.isFinite(n) || n <= 0) {
                          throw new Error('制造数量须大于 0');
                        }
                      },
                    },
                  ]}
                  fieldProps={{ precision: 4, min: 0, style: { width: '100%' } }}
                />
              </Col>
            </Row>
          </ProForm>
        </div>
      </Modal>

      <Modal
        title="从领用单转入"
        open={borrowPickerOpen}
        onCancel={() => setBorrowPickerOpen(false)}
        width={800}
        footer={null}
        destroyOnHidden
      >
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Input placeholder="筛选单号/部门/模具" value={borrowKw} onChange={(e) => setBorrowKw(e.target.value)} allowClear />
          <Table<MoldBorrowSheetRow>
            size="small"
            rowKey="id"
            loading={borrowLoading}
            pagination={false}
            scroll={{ y: 360 }}
            dataSource={filteredBorrows}
            columns={[
              { title: '领用单ID', dataIndex: 'id', width: 88 },
              { title: '来源单号', dataIndex: 'source_order_no', width: 120, ellipsis: true },
              { title: '领用部门', dataIndex: 'department_name', width: 130, ellipsis: true },
              { title: '模具代号', dataIndex: 'mold_code', width: 110 },
              {
                title: '操作',
                key: 'op',
                width: 88,
                render: (_, b) => (
                  <Button
                    type="link"
                    size="small"
                    onClick={() => {
                      formRef.current?.setFieldsValue({
                        borrow_sheet_no: `领用单#${b.id}`,
                        issue_department_uuid: b.department_uuid ?? undefined,
                        production_order_no: b.source_order_no ?? undefined,
                        mold_code: b.mold_code,
                        mold_name: b.mold_name,
                        finished_product_code: b.finished_product_code ?? undefined,
                        finished_product_name: b.finished_product_name ?? undefined,
                        manufacture_qty: b.planned_qty != null ? Number(b.planned_qty) : undefined,
                      });
                      setBorrowPickerOpen(false);
                      messageApi.success(`已转入领用单 #${b.id}`);
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

      <Modal
        title="选择模具"
        open={moldPickerOpen}
        onCancel={() => setMoldPickerOpen(false)}
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
                      formRef.current?.setFieldsValue({ mold_code: r.mold_code, mold_name: r.name });
                      setMoldPickerOpen(false);
                      messageApi.success(`已选择模具 ${r.mold_code}`);
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

export default MoldReturnInPage;

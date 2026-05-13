/**
 * 好力 GO — 领用单（列表 + 两栏 Modal，底栏：重置 / 切换扫描·选择 / 提交）
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
import { App, Button, Col, Input, Modal, Row, Space, Table, Tag } from 'antd';
import { DeleteOutlined, EditOutlined, ScanOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../../components/uni-table';
import { ListPageTemplate, MODAL_CONFIG } from '../../../../../../components/layout-templates';
import { useNewShortcut } from '../../../../../../hooks/useNewShortcut';
import { useSubmitShortcut } from '../../../../../../hooks/useSubmitShortcut';
import { SUBMIT_SHORTCUT_HINT } from '../../../../../../utils/globalSubmitShortcut';
import type { DepartmentTreeItem } from '../../../../../../services/department';
import { getDepartmentTree } from '../../../../../../services/department';
import {
  createMoldBorrowSheet,
  deleteMoldBorrowSheet,
  getMoldBorrowSheet,
  listMoldBorrowSheets,
  listMolds,
  updateMoldBorrowSheet,
  type MoldBorrowSheetCreatePayload,
  type MoldBorrowSheetRow,
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

const MoldBorrowOutPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(undefined);
  const [scanMode, setScanMode] = useState(true);
  const [deptOptions, setDeptOptions] = useState<{ label: string; value: string }[]>([]);
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

  const handleCreate = async () => {
    setIsEdit(false);
    setEditId(null);
    setScanMode(true);
    setFormInitialValues({
      source_order_no: undefined,
      department_uuid: undefined,
      mold_code: undefined,
      mold_name: undefined,
      finished_product_code: undefined,
      finished_product_name: undefined,
      planned_qty: undefined,
    });
    await loadDepartments();
    setModalVisible(true);
  };

  useNewShortcut(handleCreate);

  const handleEdit = async (record: MoldBorrowSheetRow) => {
    try {
      const d = await getMoldBorrowSheet(record.id);
      setIsEdit(true);
      setEditId(d.id);
      setScanMode(true);
      setFormInitialValues({
        source_order_no: d.source_order_no ?? undefined,
        department_uuid: d.department_uuid ?? undefined,
        mold_code: d.mold_code,
        mold_name: d.mold_name,
        finished_product_code: d.finished_product_code ?? undefined,
        finished_product_name: d.finished_product_name ?? undefined,
        planned_qty: d.planned_qty != null ? Number(d.planned_qty) : undefined,
      });
      await loadDepartments();
      setModalVisible(true);
    } catch (e) {
      messageApi.error((e as Error).message || '加载领用单失败');
    }
  };

  const handleDeleteOne = (record: MoldBorrowSheetRow) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定删除领用单（${record.mold_code}）吗？`,
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteMoldBorrowSheet(record.id);
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

  const buildPayload = (values: Record<string, unknown>): MoldBorrowSheetCreatePayload => {
    const deptUuid = typeof values.department_uuid === 'string' ? values.department_uuid.trim() : '';
    const deptName = deptLabelByUuid.get(deptUuid) || String(values.department_name ?? '').trim();
    return {
      source_order_no: String(values.source_order_no ?? '').trim() || null,
      department_uuid: deptUuid || null,
      department_name: deptName,
      mold_code: String(values.mold_code ?? '').trim(),
      mold_name: String(values.mold_name ?? '').trim(),
      finished_product_code: String(values.finished_product_code ?? '').trim() || null,
      finished_product_name: String(values.finished_product_name ?? '').trim() || null,
      planned_qty: (() => {
        const v = values.planned_qty;
        if (v === undefined || v === null || v === '') return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      })(),
    };
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    const deptUuid = typeof values.department_uuid === 'string' ? values.department_uuid.trim() : '';
    if (!deptUuid) {
      messageApi.error('请选择领用部门');
      return Promise.reject(new Error('validation'));
    }
    const deptName = deptLabelByUuid.get(deptUuid);
    if (!deptName) {
      messageApi.error('领用部门无效，请重新选择');
      return Promise.reject(new Error('validation'));
    }
    setFormLoading(true);
    try {
      const payload = buildPayload({ ...values, department_name: deptName });
      if (isEdit && editId != null) {
        await updateMoldBorrowSheet(editId, payload);
        messageApi.success('已保存');
      } else {
        await createMoldBorrowSheet(payload);
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
    setScanMode(true);
    messageApi.success('已重置');
  };

  const onToggleScanSelect = () => {
    const next = !scanMode;
    setScanMode(next);
    messageApi.info(next ? '已切换为「扫描制令单」优先' : '已切换为「选择模具」优先，可点模具代号旁「选择」');
  };

  const onScanSourceClick = () => {
    messageApi.info(scanMode ? '请使用扫码设备扫描制令单条码（来源单号将填入上方）' : '当前为选择模式，点「切换扫描/选择」后可扫描制令单');
  };

  const columns: ProColumns<MoldBorrowSheetRow>[] = [
    {
      title: '关键词',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: '来源单号/模具/部门/成品' },
    },
    { title: '来源单号', dataIndex: 'source_order_no', width: 140, ellipsis: true, copyable: true },
    { title: '领用部门', dataIndex: 'department_name', width: 160, ellipsis: true },
    { title: '模具代号', dataIndex: 'mold_code', width: 120, ellipsis: true },
    { title: '模具名称', dataIndex: 'mold_name', width: 160, ellipsis: true },
    { title: '成品代号', dataIndex: 'finished_product_code', width: 120, ellipsis: true, hideInSearch: true },
    { title: '成品名称', dataIndex: 'finished_product_name', width: 140, ellipsis: true, hideInSearch: true },
    { title: '计划数量', dataIndex: 'planned_qty', width: 100, hideInSearch: true },
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
        <UniTable<MoldBorrowSheetRow>
          headerTitle="领用单"
          columnPersistenceId="apps.haoligo.pages.molds.documents.borrow-out"
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
              const res = await listMoldBorrowSheets({
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
          scroll={{ x: 1100 }}
        />
      </ListPageTemplate>

      <Modal
        title={isEdit ? '编辑领用单' : '领用单'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditId(null);
        }}
        width={MODAL_CONFIG.LARGE_WIDTH}
        destroyOnHidden
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <Button htmlType="button" onClick={onResetForm}>
              重置
            </Button>
            <Space>
              <Button htmlType="button" type="primary" onClick={onToggleScanSelect}>
                切换扫描/选择
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
                <ProForm.Item
                  name="source_order_no"
                  label="来源单号"
                  tooltip={scanMode ? '请扫描制令单' : '可手输或切换为扫描模式'}
                >
                  <Input
                    placeholder={scanMode ? '请扫描制令单' : '请输入或选择制令单号'}
                    allowClear
                    suffix={
                      <Button type="text" size="small" icon={<ScanOutlined />} onClick={onScanSourceClick} aria-label="扫描" />
                    }
                  />
                </ProForm.Item>
              </Col>
              <Col span={12}>
                <ProFormSelect
                  name="department_uuid"
                  label="领用部门"
                  placeholder="请选择领用部门"
                  rules={[{ required: true, message: '请选择领用部门' }]}
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
                    addonAfter: !scanMode ? (
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
                    ) : undefined,
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
                  name="planned_qty"
                  label="计划数量"
                  placeholder="请输入内容"
                  min={0}
                  fieldProps={{ precision: 4, style: { width: '100%' } }}
                />
              </Col>
              <Col span={12}>
                <Tag color={scanMode ? 'blue' : 'geekblue'} style={{ marginTop: 30 }}>
                  {scanMode ? '当前：扫描优先' : '当前：选择模具'}
                </Tag>
              </Col>
            </Row>
          </ProForm>
        </div>
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

export default MoldBorrowOutPage;

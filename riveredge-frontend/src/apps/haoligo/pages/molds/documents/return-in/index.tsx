/**
 * 好力 GO — 还入单（列表 + 两栏 Modal；制令单号半宽 +「带出」；选模具自动匹配领用单；领出部门选项仅末级名称）
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { rowActionKind } from '../../../../../../components/uni-action';
import { useDebounceFn } from 'ahooks';
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
import { DeleteOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
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
  getMoldReturnBorrowLookup,
  getMoldReturnSheet,
  listMoldReturnSheets,
  updateMoldReturnSheet,
  type MoldReturnBorrowLookupResult,
  type MoldReturnSheetCreatePayload,
  type MoldReturnSheetRow,
  type MoldRow,
} from '../../../../services/haoligo';
import { moldDocumentCreatedAtColumn } from '../../../../utils/documentTableColumns';
import { fetchMoldsForPicker } from '../../../../utils/moldPicker';

function flattenDepartmentOptions(items: DepartmentTreeItem[]): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  for (const n of items) {
    out.push({ label: n.name, value: n.uuid });
    if (n.children?.length) {
      out.push(...flattenDepartmentOptions(n.children));
    }
  }
  return out;
}

function matchIssueDepartmentUuid(
  options: { label: string; value: string }[],
  uuid?: string | null,
  name?: string | null,
): string | undefined {
  const u = (uuid ?? '').trim();
  if (u && options.some((o) => o.value === u)) return u;
  const n = (name ?? '').trim();
  if (!n) return undefined;
  return options.find((o) => o.label === n)?.value;
}

const MoldReturnInPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(undefined);
  const [deptOptions, setDeptOptions] = useState<{ label: string; value: string }[]>([]);
  const [moldPickerOpen, setMoldPickerOpen] = useState(false);
  const [moldRows, setMoldRows] = useState<MoldRow[]>([]);
  const [moldKw, setMoldKw] = useState('');
  const [moldLoading, setMoldLoading] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(false);

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

  const loadMoldsForPicker = useCallback(async (keyword?: string) => {
    setMoldLoading(true);
    try {
      const rows = await fetchMoldsForPicker({ status: '在用', keyword });
      setMoldRows(rows);
    } catch {
      setMoldRows([]);
    } finally {
      setMoldLoading(false);
    }
  }, []);

  const { run: debouncedLoadMoldsForPicker } = useDebounceFn(
    (keyword: string) => {
      void loadMoldsForPicker(keyword);
    },
    { wait: 300 },
  );

  const handleCreate = async () => {
    setIsDetailView(false);
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
      planned_qty: undefined,
      manufacture_qty: undefined,
    });
    await loadDepartments();
    setModalVisible(true);
  };

  useNewShortcut(handleCreate);

  const openSheetForm = async (record: MoldReturnSheetRow, detailOnly: boolean) => {
    try {
      const d = await getMoldReturnSheet(record.id);
      setIsDetailView(detailOnly);
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
        planned_qty: d.planned_qty != null ? Number(d.planned_qty) : undefined,
        manufacture_qty: d.manufacture_qty != null ? Number(d.manufacture_qty) : undefined,
      });
      await loadDepartments();
      setModalVisible(true);
    } catch (e) {
      messageApi.error((e as Error).message || '加载还入单失败');
    }
  };

  const handleEdit = (record: MoldReturnSheetRow) => void openSheetForm(record, false);
  const handleDetail = (record: MoldReturnSheetRow) => void openSheetForm(record, true);

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
      planned_qty: (() => {
        const v = values.planned_qty;
        if (v === undefined || v === null || v === '') return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      })(),
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
      messageApi.error('请选择领出部门，或点制令单号旁「带出」/选模具从领用单带入');
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

  const applyBorrowLookupResult = useCallback(
    (res: MoldReturnBorrowLookupResult) => {
      const deptUuid = matchIssueDepartmentUuid(deptOptions, res.issue_department_uuid, res.issue_department_name);
      if (!deptUuid) {
        messageApi.warning('领用单上的领用部门未匹配到本系统部门，请在「领出部门」中手动选择');
      }
      const currentPo = String(formRef.current?.getFieldValue('production_order_no') ?? '').trim();
      const productionOrder =
        res.production_order_no != null && String(res.production_order_no).trim() !== ''
          ? String(res.production_order_no).trim()
          : currentPo || undefined;
      formRef.current?.setFieldsValue({
        borrow_sheet_no: res.borrow_sheet_no,
        production_order_no: productionOrder,
        issue_department_uuid: deptUuid,
        mold_code: res.mold_code,
        mold_name: res.mold_name,
        finished_product_code: res.finished_product_code ?? undefined,
        finished_product_name: res.finished_product_name ?? undefined,
        planned_qty:
          res.planned_qty !== undefined && res.planned_qty !== null && res.planned_qty !== ''
            ? Number(res.planned_qty)
            : undefined,
        manufacture_qty: undefined,
      });
    },
    [deptOptions, messageApi],
  );

  const autoFetchBorrowLookup = useCallback(
    async (productionOrderNo: string, moldCode: string) => {
      const p = productionOrderNo.trim();
      const m = moldCode.trim();
      if (!p && !m) return;
      setLookupBusy(true);
      try {
        const res = await getMoldReturnBorrowLookup({
          production_order_no: p || undefined,
          mold_code: m || undefined,
        });
        applyBorrowLookupResult(res);
        messageApi.success('已从领用单带出');
      } catch (e) {
        messageApi.error((e as Error).message || '匹配领用单失败');
      } finally {
        setLookupBusy(false);
      }
    },
    [applyBorrowLookupResult, messageApi],
  );

  const columns: ProColumns<MoldReturnSheetRow>[] = [
    {
      title: '关键词',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: '单号/制令单号/模具/部门/成品' },
    },
    {
      title: '还入单单号',
      dataIndex: 'sheet_no',
      width: 150,
      ellipsis: true,
      copyable: true,
      fixed: 'left',
      hideInSearch: true,
    },
    { title: '制令单号', dataIndex: 'production_order_no', width: 130, ellipsis: true, copyable: true },
    {
      title: '领用单',
      dataIndex: 'borrow_sheet_no',
      width: 150,
      ellipsis: true,
      copyable: true,
      hideInSearch: true,
    },
    { title: '领出部门', dataIndex: 'issue_department_name', width: 150, ellipsis: true },
    { title: '模具代号', dataIndex: 'mold_code', width: 110, ellipsis: true },
    { title: '模具名称', dataIndex: 'mold_name', width: 150, ellipsis: true },
    { title: '成品代号', dataIndex: 'finished_product_code', width: 110, ellipsis: true, hideInSearch: true },
    { title: '成品名称', dataIndex: 'finished_product_name', width: 130, ellipsis: true, hideInSearch: true },
    { title: '计划数量', dataIndex: 'planned_qty', width: 100, hideInSearch: true },
    { title: '制造数量', dataIndex: 'manufacture_qty', width: 100, hideInSearch: true },
    moldDocumentCreatedAtColumn<MoldReturnSheetRow>(),
    {
      title: '操作',
      valueType: 'option',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button key="view" {...rowActionKind('read')} onClick={() => handleDetail(record)}>
            详情
          </Button>
          <Button key="edit" {...rowActionKind('update')} onClick={() => void handleEdit(record)}>
            编辑
          </Button>
          <Button key="delete" {...rowActionKind('delete')} onClick={() => handleDeleteOne(record)}>
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
          headerTitle="模具还入单"
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
          scroll={{ x: 1280 }}
        />
      </ListPageTemplate>

      <Modal
        title={isDetailView ? '还入单详情' : isEdit ? '编辑还入单' : '还入单'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditId(null);
          setIsDetailView(false);
        }}
        width={MODAL_CONFIG.LARGE_WIDTH}
        destroyOnHidden
        footer={
          isDetailView ? (
            <Button onClick={() => setModalVisible(false)}>关闭</Button>
          ) : (
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
                <Button htmlType="button" type="primary" loading={formLoading} onClick={triggerSubmit}>
                  提交{SUBMIT_SHORTCUT_HINT}
                </Button>
              </Space>
            </div>
          )
        }
      >
        <div className="form-modal-content-inner">
          <ProForm
            key={modalVisible ? `${isEdit}-${editId ?? 'n'}` : 'closed'}
            formRef={formRef}
            loading={formLoading}
            readonly={isDetailView}
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
              <ProFormText name="borrow_sheet_no" hidden />
              <Col span={12}>
                <ProFormText
                  name="production_order_no"
                  label="制令单号"
                  placeholder="请输入制令单号"
                  tooltip="与领用单一致：填写制令单号或模具代号后点右侧「带出」，从领用单匹配并填入其余字段；选模具也会自动带出"
                  fieldProps={{
                    allowClear: true,
                    addonAfter: isDetailView ? undefined : (
                      <Button
                        type="link"
                        size="small"
                        style={{ padding: '0 8px' }}
                        loading={lookupBusy}
                        onClick={() => {
                          const po = String(formRef.current?.getFieldValue('production_order_no') ?? '').trim();
                          const mc = String(formRef.current?.getFieldValue('mold_code') ?? '').trim();
                          if (!po && !mc) {
                            messageApi.warning('请先输入制令单号或模具代号');
                            return;
                          }
                          void autoFetchBorrowLookup(po, mc);
                        }}
                      >
                        带出
                      </Button>
                    ),
                  }}
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
                  tooltip="点「选择」选模具后将自动按模具匹配领用单并带出；也可手输模具代号后点制令单号旁「带出」。成品代号/名称与计划数量为只读（由「带出」或选模具写入）"
                  rules={[{ required: true, message: '请输入模具代号' }]}
                  fieldProps={{
                    addonAfter: isDetailView ? undefined : (
                      <Button
                        type="link"
                        size="small"
                        style={{ padding: '0 8px' }}
                        onClick={() => {
                          setMoldKw('');
                          setMoldPickerOpen(true);
                          void loadMoldsForPicker('');
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
                <ProFormText
                  name="finished_product_code"
                  label="成品代号"
                  placeholder="由「带出」或选模具写入"
                  tooltip="只读；请点制令单号旁「带出」或选择模具后从领用单写入"
                  fieldProps={{ readOnly: true, style: { backgroundColor: '#fafafa' } }}
                />
              </Col>
              <Col span={12}>
                <ProFormText
                  name="finished_product_name"
                  label="成品名称"
                  placeholder="由「带出」或选模具写入"
                  tooltip="只读；请点制令单号旁「带出」或选择模具后从领用单写入"
                  fieldProps={{ readOnly: true, style: { backgroundColor: '#fafafa' } }}
                />
              </Col>
              <Col span={12}>
                <ProFormDigit
                  name="planned_qty"
                  label="计划数量"
                  placeholder="由「带出」或选模具写入"
                  tooltip="只读；与领用单计划数量一致，由「带出」或选模具写入"
                  fieldProps={{
                    readOnly: true,
                    precision: 4,
                    min: 0,
                    style: { width: '100%', backgroundColor: '#fafafa' },
                  }}
                />
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
        title="选择模具（仅台账状态为「在用」）"
        open={moldPickerOpen}
        onCancel={() => setMoldPickerOpen(false)}
        width={720}
        footer={null}
        destroyOnHidden
      >
        <Space orientation="vertical" style={{ width: '100%' }} size={12}>
          <Input
            placeholder="搜索模具代号/名称（支持台账全库模糊查询）"
            value={moldKw}
            onChange={(e) => {
              const v = e.target.value;
              setMoldKw(v);
              debouncedLoadMoldsForPicker(v);
            }}
            allowClear
          />
          <Table<MoldRow>
            size="small"
            rowKey="id"
            loading={moldLoading}
            pagination={false}
            scroll={{ y: 360 }}
            dataSource={moldRows}
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
                      void autoFetchBorrowLookup('', r.mold_code.trim());
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

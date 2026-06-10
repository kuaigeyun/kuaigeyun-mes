/**
 * 好力 GO — 领用单（列表 + 两栏 Modal，底栏：重置 / 提交）
 * 电脑端：从制令单新建（数据集带出）或从浇铸货品新建（无制令单，手填浇铸货品后关联模具领用）。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { App, Alert, AutoComplete, Button, Col, Form, Input, Modal, Row, Select, Space, Spin, Table } from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
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
  getMoldBorrowDatasetBinding,
  getMoldBorrowSheet,
  getMoldBorrowSourceOrderUsage,
  listMoldBorrowSheets,
  prefillMoldBorrowSheetFromDataset,
  putMoldBorrowDatasetBinding,
  updateMoldBorrowSheet,
  type MoldBorrowDatasetBindingPayload,
  type MoldBorrowSheetCreatePayload,
  type MoldBorrowSheetRow,
  type MoldRow,
} from '../../../../services/haoligo';
import { fetchMoldsForPicker } from '../../../../utils/moldPicker';
import { moldDocumentCreatedAtColumn } from '../../../../utils/documentTableColumns';
import { executeDatasetQuery, getDatasetByUuid, getDatasetList } from '../../../../../../services/dataset';
import { extractSqlNamedParams } from '../../../../../../utils/extractSqlNamedParams';

/** 从 SQL 中粗略提取命名参数（优先以数据集 designer 中的 parameters 为准） */
function normalizeDatasetParameterMap(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    const key = k.trim();
    if (!key) continue;
    if (v === null || v === undefined) continue;
    if (typeof v === 'number' || typeof v === 'boolean') {
      out[key] = v;
    } else {
      const s = String(v).trim();
      if (s !== '') out[key] = s;
    }
  }
  return out;
}

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

/** 新建来源：制令单（数据集带出）或浇铸货品（无制令单） */
type BorrowCreateMode = 'work_order' | 'casting_product';

const MoldBorrowOutPage: React.FC = () => {
  const { message: messageApi, modal } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [createMode, setCreateMode] = useState<BorrowCreateMode>('work_order');
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

  const [datasetBinding, setDatasetBinding] = useState<MoldBorrowDatasetBindingPayload | null>(null);
  const [bindingModalOpen, setBindingModalOpen] = useState(false);
  const [bindingCfgForm] = Form.useForm<MoldBorrowDatasetBindingPayload>();
  const bindingDatasetUuidWatched = Form.useWatch('dataset_uuid', bindingCfgForm);
  const [datasetSelectOptions, setDatasetSelectOptions] = useState<{ label: string; value: string }[]>([]);
  const [bindingColumnOptions, setBindingColumnOptions] = useState<{ value: string; label: string }[]>([]);
  const [bindingColumnsLoading, setBindingColumnsLoading] = useState(false);
  const [bindingModalBusy, setBindingModalBusy] = useState(false);
  const [prefillBusy, setPrefillBusy] = useState(false);
  const [datasetParamKeyOptions, setDatasetParamKeyOptions] = useState<{ value: string; label: string }[]>([]);
  const [datasetParamKeysLoading, setDatasetParamKeysLoading] = useState(false);

  const canPrefillFromDataset = useMemo(() => {
    const b = datasetBinding;
    return Boolean(
      b?.dataset_uuid?.trim() && b.work_order_param_key?.trim() && b.department_name_column?.trim(),
    );
  }, [datasetBinding]);

  const loadBindingDatasetColumns = useCallback(
    async (opts?: { silent?: boolean }) => {
      const uuid = String(bindingDatasetUuidWatched ?? '').trim();
      if (!uuid) {
        setBindingColumnOptions([]);
        return;
      }
      setBindingColumnsLoading(true);
      try {
        const ds = await getDatasetByUuid(uuid);
        const cfg = (ds.query_config || {}) as { parameters?: Record<string, unknown> };
        const defaultsRaw =
          cfg.parameters && typeof cfg.parameters === 'object' && !Array.isArray(cfg.parameters)
            ? (cfg.parameters as Record<string, unknown>)
            : {};
        const merged = normalizeDatasetParameterMap(defaultsRaw);

        const res = await executeDatasetQuery(uuid, {
          parameters: merged,
          fill_missing_sql_parameters: true,
          limit: 5,
          offset: 0,
        });
        const raw = res.columns?.length
          ? res.columns
          : res.data?.[0]
            ? Object.keys(res.data[0] as object)
            : [];
        if (!raw.length) {
          if (!opts?.silent) {
            messageApi.warning(
              res.error ||
                (res.success ? '未能解析出列名' : '无法加载列名（请检查数据集 SQL 与数据源连接）'),
            );
          }
          setBindingColumnOptions([]);
          return;
        }
        const unique = [...new Set(raw.map((c) => String(c).trim()).filter(Boolean))];
        setBindingColumnOptions(unique.map((c) => ({ value: c, label: c })));
        if (!opts?.silent && unique.length) {
          messageApi.success(`已加载 ${unique.length} 个列`);
        }
      } catch (e) {
        if (!opts?.silent) messageApi.error((e as Error).message || '加载列名失败');
        setBindingColumnOptions([]);
      } finally {
        setBindingColumnsLoading(false);
      }
    },
    [bindingDatasetUuidWatched, messageApi],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const b = await getMoldBorrowDatasetBinding();
        if (cancelled) return;
        setDatasetBinding(b.dataset_uuid ? b : null);
      } catch {
        if (!cancelled) setDatasetBinding(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!bindingModalOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const options: { label: string; value: string }[] = [];
        let page = 1;
        const pageSize = 100;
        for (;;) {
          const res = await getDatasetList({ page, page_size: pageSize, is_active: true });
          const items = res.items ?? [];
          for (const d of items) {
            options.push({ label: `${d.name} (${d.code})`, value: d.uuid });
          }
          if (items.length < pageSize) break;
          page += 1;
        }
        if (!cancelled) setDatasetSelectOptions(options);
      } catch (e) {
        if (!cancelled) {
          setDatasetSelectOptions([]);
          messageApi.error((e as Error).message || '加载数据集列表失败');
        }
      }
    })();
    bindingCfgForm.resetFields();
    const d = datasetBinding;
    bindingCfgForm.setFieldsValue({
      dataset_uuid: d?.dataset_uuid ?? undefined,
      work_order_param_key: d?.work_order_param_key ?? undefined,
      department_name_column: d?.department_name_column ?? undefined,
      mold_code_column: d?.mold_code_column ?? undefined,
      mold_name_column: d?.mold_name_column ?? undefined,
      finished_product_code_column: d?.finished_product_code_column ?? undefined,
      finished_product_name_column: d?.finished_product_name_column ?? undefined,
      planned_qty_column: d?.planned_qty_column ?? undefined,
    });
    setBindingColumnOptions([]);
    return () => {
      cancelled = true;
    };
  }, [bindingModalOpen, datasetBinding, bindingCfgForm, messageApi]);

  useEffect(() => {
    if (!bindingModalOpen) return;
    const uuid = String(bindingDatasetUuidWatched ?? '').trim();
    if (!uuid) {
      setDatasetParamKeyOptions([]);
      setDatasetParamKeysLoading(false);
      return;
    }
    let cancelled = false;
    setDatasetParamKeysLoading(true);
    void (async () => {
      try {
        const ds = await getDatasetByUuid(uuid);
        if (cancelled) return;
        const cfg = (ds.query_config || {}) as { sql?: string; parameters?: Record<string, unknown> };
        let keys: string[] = [];
        if (cfg.parameters && typeof cfg.parameters === 'object' && !Array.isArray(cfg.parameters)) {
          keys = Object.keys(cfg.parameters)
            .map((k) => k.trim())
            .filter(Boolean);
        }
        if (keys.length === 0 && typeof cfg.sql === 'string') {
          keys = extractSqlNamedParams(cfg.sql);
        }
        const opts = keys.map((k) => ({ value: k, label: k }));
        const saved = datasetBinding;
        const savedKey =
          saved?.dataset_uuid && String(saved.dataset_uuid).trim() === uuid
            ? String(saved.work_order_param_key ?? '').trim()
            : '';
        if (savedKey && !opts.some((o) => o.value === savedKey)) {
          opts.unshift({ value: savedKey, label: `${savedKey}（已保存）` });
        }
        if (!cancelled) setDatasetParamKeyOptions(opts);
      } catch {
        if (!cancelled) setDatasetParamKeyOptions([]);
      } finally {
        if (!cancelled) setDatasetParamKeysLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bindingModalOpen, bindingDatasetUuidWatched, datasetBinding]);

  const handleDatasetConfig = useCallback(() => {
    setBindingModalOpen(true);
  }, []);

  const handleBindingSave = async () => {
    const ds = String(bindingCfgForm.getFieldValue('dataset_uuid') ?? '').trim();
    if (!ds) {
      setBindingModalBusy(true);
      try {
        const saved = await putMoldBorrowDatasetBinding({ dataset_uuid: '' });
        setDatasetBinding(saved.dataset_uuid ? saved : null);
        messageApi.success('已清除关联');
        setBindingModalOpen(false);
      } catch (e) {
        messageApi.error((e as Error).message || '保存失败');
      } finally {
        setBindingModalBusy(false);
      }
      return;
    }
    let v: MoldBorrowDatasetBindingPayload;
    try {
      v = await bindingCfgForm.validateFields();
    } catch {
      return;
    }
    setBindingModalBusy(true);
    const prev = datasetBinding;
    const deptUuidCol =
      prev?.dataset_uuid?.trim() === ds && prev?.department_uuid_column?.trim()
        ? prev.department_uuid_column.trim()
        : undefined;
    try {
      const saved = await putMoldBorrowDatasetBinding({
        dataset_uuid: ds,
        work_order_param_key: String(v.work_order_param_key ?? '').trim(),
        department_uuid_column: deptUuidCol || undefined,
        department_name_column: String(v.department_name_column ?? '').trim(),
        mold_code_column: String(v.mold_code_column ?? '').trim() || undefined,
        mold_name_column: String(v.mold_name_column ?? '').trim() || undefined,
        finished_product_code_column: String(v.finished_product_code_column ?? '').trim() || undefined,
        finished_product_name_column: String(v.finished_product_name_column ?? '').trim() || undefined,
        planned_qty_column: String(v.planned_qty_column ?? '').trim() || undefined,
      });
      setDatasetBinding(saved);
      messageApi.success('已保存');
      setBindingModalOpen(false);
    } catch (e) {
      messageApi.error((e as Error).message || '保存失败');
    } finally {
      setBindingModalBusy(false);
    }
  };

  const handlePrefillFromDataset = useCallback(async () => {
    if (!canPrefillFromDataset) {
      messageApi.warning('请先在「数据集」中保存数据集、查询参数名及领用部门名称列映射（模具列可不填）');
      return;
    }
    const wo = formRef.current?.getFieldValue('source_order_no');
    const s = String(wo ?? '').trim();
    if (!s) {
      messageApi.warning('请先输入制令单号');
      return;
    }
    try {
      const usage = await getMoldBorrowSourceOrderUsage({
        source_order_no: s,
        exclude_sheet_id: isEdit && editId != null ? editId : undefined,
      });
      if (usage.exists) {
        const go = await new Promise<boolean>((resolve) => {
          modal.confirm({
            title: '提示',
            content: `该制令单号已存在 ${usage.count} 条领用单，是否仍要从数据集带出并覆盖当前表单？`,
            okText: '仍要带出',
            cancelText: '取消',
            onOk: () => resolve(true),
            onCancel: () => resolve(false),
          });
        });
        if (!go) return;
      }
    } catch (e) {
      messageApi.error((e as Error).message || '检查领用单重复失败');
      return;
    }
    setPrefillBusy(true);
    try {
      const res = await prefillMoldBorrowSheetFromDataset({ source_order_no: s });
      const hasMold = Boolean(String(res.mold_code ?? '').trim()) || Boolean(String(res.mold_name ?? '').trim());
      formRef.current?.setFieldsValue({
        source_order_no: res.source_order_no,
        department_uuid: res.department_uuid ?? undefined,
        mold_code: res.mold_code != null && String(res.mold_code).trim() !== '' ? res.mold_code : undefined,
        mold_name: res.mold_name != null && String(res.mold_name).trim() !== '' ? res.mold_name : undefined,
        finished_product_code: res.finished_product_code ?? undefined,
        finished_product_name: res.finished_product_name ?? undefined,
        planned_qty:
          res.planned_qty !== undefined && res.planned_qty !== null && res.planned_qty !== ''
            ? Number(res.planned_qty)
            : undefined,
      });
      const hints: string[] = [];
      if (!res.department_uuid) hints.push('请从「领用部门」下拉选择本系统部门');
      if (!hasMold) hints.push('模具请通过「选择」或手填补充');
      if (hints.length) {
        messageApi.success(`已带出（${hints.join('；')}）`);
      } else {
        messageApi.success('已带出');
      }
    } catch (e) {
      messageApi.error((e as Error).message || '带出失败');
    } finally {
      setPrefillBusy(false);
    }
  }, [canPrefillFromDataset, editId, isEdit, messageApi, modal]);

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
      const rows = await fetchMoldsForPicker({
        status: '待用',
        keyword: keyword ?? '',
      });
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

  const isCastingProductMode = createMode === 'casting_product';

  const resolveCreateModeFromRecord = (sourceOrderNo?: string | null): BorrowCreateMode =>
    String(sourceOrderNo ?? '').trim() ? 'work_order' : 'casting_product';

  const openCreateForm = async (mode: BorrowCreateMode) => {
    setCreateMode(mode);
    setIsDetailView(false);
    setIsEdit(false);
    setEditId(null);
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

  const handleCreateFromWorkOrder = () => void openCreateForm('work_order');
  const handleCreateFromCastingProduct = () => void openCreateForm('casting_product');

  useNewShortcut(handleCreateFromWorkOrder);

  const handleOpenMoldPicker = useCallback(() => {
    const productKw =
      createMode === 'casting_product'
        ? String(formRef.current?.getFieldValue('finished_product_code') ?? '').trim()
        : '';
    setMoldKw(productKw);
    setMoldPickerOpen(true);
    void loadMoldsForPicker(productKw);
  }, [createMode, loadMoldsForPicker]);

  const openSheetForm = async (record: MoldBorrowSheetRow, detailOnly: boolean) => {
    try {
      const d = await getMoldBorrowSheet(record.id);
      setCreateMode(resolveCreateModeFromRecord(d.source_order_no));
      setIsDetailView(detailOnly);
      setIsEdit(true);
      setEditId(d.id);
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

  const handleEdit = (record: MoldBorrowSheetRow) => void openSheetForm(record, false);
  const handleDetail = (record: MoldBorrowSheetRow) => void openSheetForm(record, true);

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
    if (isCastingProductMode) {
      const productCode = String(values.finished_product_code ?? '').trim();
      const productName = String(values.finished_product_name ?? '').trim();
      if (!productCode) {
        messageApi.error('请填写浇铸货品代号');
        return Promise.reject(new Error('validation'));
      }
      if (!productName) {
        messageApi.error('请填写浇铸货品名称');
        return Promise.reject(new Error('validation'));
      }
    }
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
      const payload = buildPayload({
        ...values,
        department_name: deptName,
        ...(isCastingProductMode ? { source_order_no: null } : {}),
      });
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
    messageApi.success('已重置');
  };

  const columns: ProColumns<MoldBorrowSheetRow>[] = [
    {
      title: '关键词',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: '单号/制令单号/模具/部门/成品' },
    },
    {
      title: '领用单单号',
      dataIndex: 'sheet_no',
      width: 150,
      ellipsis: true,
      copyable: true,
      fixed: 'left',
      hideInSearch: true,
    },
    {
      title: '制令单号',
      dataIndex: 'source_order_no',
      width: 140,
      ellipsis: true,
      copyable: true,
      render: (_, r) => r.source_order_no?.trim() || '—',
    },
    { title: '领用部门', dataIndex: 'department_name', width: 160, ellipsis: true },
    { title: '模具代号', dataIndex: 'mold_code', width: 120, ellipsis: true },
    { title: '模具名称', dataIndex: 'mold_name', width: 160, ellipsis: true },
    { title: '成品代号', dataIndex: 'finished_product_code', width: 120, ellipsis: true, hideInSearch: true },
    { title: '成品名称', dataIndex: 'finished_product_name', width: 140, ellipsis: true, hideInSearch: true },
    { title: '计划数量', dataIndex: 'planned_qty', width: 100, hideInSearch: true },
    moldDocumentCreatedAtColumn<MoldBorrowSheetRow>(),
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
        <UniTable<MoldBorrowSheetRow>
          headerTitle="模具领用单"
          columnPersistenceId="apps.haoligo.pages.molds.documents.borrow-out"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          showCreateButton
          createButtonText="从制令单新建"
          onCreate={handleCreateFromWorkOrder}
          toolBarActionsAfterCreate={[
            <Button {...rowActionKind('create')} key="create-from-casting" onClick={handleCreateFromCastingProduct}>
              从浇铸货品新建
            </Button>,
          ]}
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
          showDatasetConfigButton
          onDatasetConfig={handleDatasetConfig}
        />
      </ListPageTemplate>

      <Modal
        title={
          isDetailView
            ? '领用单详情'
            : isEdit
              ? '编辑领用单'
              : isCastingProductMode
                ? '从浇铸货品新建领用单'
                : '从制令单新建领用单'
        }
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditId(null);
          setIsDetailView(false);
          setCreateMode('work_order');
        }}
        width={MODAL_CONFIG.LARGE_WIDTH}
        destroyOnHidden
        footer={
          isDetailView ? (
            <Button onClick={() => setModalVisible(false)}>关闭</Button>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <Button htmlType="button" onClick={onResetForm}>
              重置
            </Button>
            <Button htmlType="button" type="primary" loading={formLoading} onClick={triggerSubmit}>
              提交{SUBMIT_SHORTCUT_HINT}
            </Button>
          </div>
          )
        }
      >
        <div className="form-modal-content-inner">
          <ProForm
            key={modalVisible ? `${isEdit}-${editId ?? 'n'}-${createMode}` : 'closed'}
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
              {!isCastingProductMode ? (
                <Col span={12}>
                  <ProFormText
                    name="source_order_no"
                    label="制令单号"
                    tooltip="作为数据集查询参数传入；填写后点右侧「带出」可拉取其余字段"
                    placeholder="请输入制令单号"
                    fieldProps={{
                      allowClear: true,
                      addonAfter: isDetailView ? undefined : (
                        <Button
                          type="link"
                          size="small"
                          style={{ padding: '0 8px' }}
                          loading={prefillBusy}
                          disabled={!canPrefillFromDataset}
                          onClick={() => void handlePrefillFromDataset()}
                        >
                          带出
                        </Button>
                      ),
                    }}
                  />
                </Col>
              ) : null}
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
              {isCastingProductMode ? (
                <>
                  <Col span={12}>
                    <ProFormText
                      name="finished_product_code"
                      label="浇铸货品代号"
                      placeholder="请输入浇铸货品代号"
                      tooltip="填写后点模具「选择」将按台账 ERP 物料编码筛选关联模具"
                      rules={[{ required: true, message: '请填写浇铸货品代号' }]}
                    />
                  </Col>
                  <Col span={12}>
                    <ProFormText
                      name="finished_product_name"
                      label="浇铸货品名称"
                      placeholder="请输入浇铸货品名称"
                      rules={[{ required: true, message: '请填写浇铸货品名称' }]}
                    />
                  </Col>
                </>
              ) : null}
              <Col span={12}>
                <ProFormText
                  name="mold_code"
                  label="模具代号"
                  placeholder="请输入内容"
                  rules={[{ required: true, message: '请输入模具代号' }]}
                  fieldProps={{
                    addonAfter: isDetailView ? undefined : (
                      <Button
                        type="link"
                        size="small"
                        style={{ padding: '0 8px' }}
                        onClick={handleOpenMoldPicker}
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
              {!isCastingProductMode ? (
                <>
                  <Col span={12}>
                    <ProFormText
                      name="finished_product_code"
                      label="成品代号"
                      placeholder="由「带出」填入"
                      tooltip="只读；请通过制令单号右侧「带出」从数据集写入"
                      fieldProps={{ readOnly: true, style: { backgroundColor: '#fafafa' } }}
                    />
                  </Col>
                  <Col span={12}>
                    <ProFormText
                      name="finished_product_name"
                      label="成品名称"
                      placeholder="由「带出」填入"
                      tooltip="只读；请通过制令单号右侧「带出」从数据集写入"
                      fieldProps={{ readOnly: true, style: { backgroundColor: '#fafafa' } }}
                    />
                  </Col>
                  <Col span={12}>
                    <ProFormDigit
                      name="planned_qty"
                      label="计划数量"
                      placeholder="由「带出」填入"
                      tooltip="只读；请通过制令单号右侧「带出」从数据集写入"
                      min={0}
                      fieldProps={{
                        readOnly: true,
                        precision: 4,
                        style: { width: '100%', backgroundColor: '#fafafa' },
                      }}
                    />
                  </Col>
                </>
              ) : (
                <Col span={12}>
                  <ProFormDigit
                    name="planned_qty"
                    label="计划数量"
                    placeholder="选填"
                    min={0}
                    fieldProps={{ precision: 4, style: { width: '100%' } }}
                  />
                </Col>
              )}
            </Row>
          </ProForm>
        </div>
      </Modal>

      <Modal
        title="领用单 · 数据集关联"
        open={bindingModalOpen}
        onCancel={() => setBindingModalOpen(false)}
        width={720}
        destroyOnHidden
        footer={[
          <Button {...rowActionKind('revoke')} key="cancel" onClick={() => setBindingModalOpen(false)}>
            取消
          </Button>,
          <Button {...rowActionKind('skip')} key="save" type="primary" loading={bindingModalBusy} onClick={() => void handleBindingSave()}>
            保存
          </Button>,
        ]}
      >
        <Form<MoldBorrowDatasetBindingPayload> form={bindingCfgForm} layout="vertical">
          <Form.Item name="dataset_uuid" label="数据集">
            <Select
              allowClear
              showSearch
              placeholder="选择数据集（SQL 需包含制令单号对应查询参数）"
              optionFilterProp="label"
              options={datasetSelectOptions}
              onChange={() => {
                bindingCfgForm.setFieldsValue({
                  work_order_param_key: undefined,
                  department_name_column: undefined,
                  mold_code_column: undefined,
                  mold_name_column: undefined,
                  finished_product_code_column: undefined,
                  finished_product_name_column: undefined,
                  planned_qty_column: undefined,
                });
                setBindingColumnOptions([]);
                setDatasetParamKeyOptions([]);
              }}
            />
          </Form.Item>
          <Spin spinning={datasetParamKeysLoading}>
            <Form.Item
              name="work_order_param_key"
              label="查询参数名"
              rules={[{ required: true, message: '请选择或填写与 SQL 占位符一致的参数名' }]}
            >
              <AutoComplete
                allowClear
                style={{ width: '100%' }}
                options={datasetParamKeyOptions}
                placeholder={
                  datasetParamKeyOptions.length
                    ? '下拉选择参数名，或直接输入'
                    : '选择数据集后将列出参数；也可手输与 SQL 一致的名称'
                }
                filterOption={(input, option) =>
                  String(option?.value ?? '')
                    .toLowerCase()
                    .includes(String(input).trim().toLowerCase())
                }
              />
            </Form.Item>
          </Spin>
          <div style={{ marginBottom: 12 }}>
            <Button
              type="link"
              size="small"
              style={{ padding: 0 }}
              loading={bindingColumnsLoading}
              disabled={!bindingDatasetUuidWatched}
              onClick={() => void loadBindingDatasetColumns({ silent: false })}
            >
              加载列名（自动解析，无需探测单号）
            </Button>
          </div>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="department_name_column"
                label="领用部门名称列"
                rules={[{ required: true, message: '请填写' }]}
              >
                <AutoComplete
                  allowClear
                  options={bindingColumnOptions}
                  filterOption={(input, option) =>
                    String(option?.value ?? '')
                      .toLowerCase()
                      .includes(String(input).trim().toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="mold_code_column" label="模具代号列（可选）">
                <AutoComplete
                  allowClear
                  options={bindingColumnOptions}
                  filterOption={(input, option) =>
                    String(option?.value ?? '')
                      .toLowerCase()
                      .includes(String(input).trim().toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="mold_name_column" label="模具名称列（可选）">
                <AutoComplete
                  allowClear
                  options={bindingColumnOptions}
                  filterOption={(input, option) =>
                    String(option?.value ?? '')
                      .toLowerCase()
                      .includes(String(input).trim().toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="finished_product_code_column" label="成品代号列（可选）">
                <AutoComplete
                  allowClear
                  options={bindingColumnOptions}
                  filterOption={(input, option) =>
                    String(option?.value ?? '')
                      .toLowerCase()
                      .includes(String(input).trim().toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="finished_product_name_column" label="成品名称列（可选）">
                <AutoComplete
                  allowClear
                  options={bindingColumnOptions}
                  filterOption={(input, option) =>
                    String(option?.value ?? '')
                      .toLowerCase()
                      .includes(String(input).trim().toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="planned_qty_column" label="计划数量列（可选）">
                <AutoComplete
                  allowClear
                  options={bindingColumnOptions}
                  filterOption={(input, option) =>
                    String(option?.value ?? '')
                      .toLowerCase()
                      .includes(String(input).trim().toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
          </Row>
          <Alert
            type="info"
            showIcon
            message="说明"
            description="保存后，在领用单弹窗输入制令单号并点「带出」，将把该单号作为查询参数执行数据集，并把部门、模具、成品、计划数量等列映射写入表单（部门按名称匹配本系统部门）。加载列名时选择数据集后点击上方链接即可自动解析列。"
          />
        </Form>
      </Modal>

      <Modal
        title={isCastingProductMode ? '选择模具（按浇铸货品关联）' : '选择模具'}
        open={moldPickerOpen}
        onCancel={() => setMoldPickerOpen(false)}
        width={720}
        footer={null}
        destroyOnHidden
      >
        <Space orientation="vertical" style={{ width: '100%' }} size={12}>
          <Alert
            type="info"
            showIcon
            message="仅列出状态为「待用」的模具"
            description="其他状态（待启用、在用、保养等）不可领用。"
          />
          {isCastingProductMode ? (
            <Alert
              type="info"
              showIcon
              message="按浇铸货品代号匹配台账 ERP 物料编码筛选模具；可继续在下方输入框缩小范围"
            />
          ) : null}
          <Input
            placeholder={isCastingProductMode ? '筛选模具代号/名称/ERP 物料编码' : '筛选模具代号/名称'}
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
              ...(isCastingProductMode
                ? [{ title: 'ERP 物料编码', dataIndex: 'erp_material_code', width: 120, ellipsis: true }]
                : []),
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

/**
 * 好力 GO — 试模单（列表 + 表单，对齐需求稿字段）
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionType,
  ProColumns,
  ProForm,
  ProFormDependency,
  ProFormDigit,
  ProFormInstance,
  ProFormRadio,
  ProFormText,
  ProFormUploadButton,
} from '@ant-design/pro-components';
import type { UploadFile } from 'antd/es/upload/interface';
import type { UploadProps } from 'antd';
import { App, Alert, AutoComplete, Button, Col, Form, Input, Modal, Radio, Row, Select, Space, Table, Tag, Tooltip, Upload } from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined, ShoppingOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../../components/uni-table';
import { FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../../../components/layout-templates';
import { getFileDownloadUrl, uploadFile } from '../../../../../../services/file';
import { supplierApi, unwrapSupplyPagedList } from '../../../../../../apps/master-data/services/supply-chain';
import type { Supplier } from '../../../../../../apps/master-data/types/supply-chain';
import {
  createMoldTrialSheet,
  deleteMoldTrialSheet,
  getMoldTrialDatasetBinding,
  getMoldTrialSheet,
  listMoldTrialSheets,
  listMolds,
  batchMoldsLifecycle,
  putMoldTrialDatasetBinding,
  updateMoldTrialSheet,
  type MoldTrialDatasetBindingPayload,
  type MoldTrialSheetCreatePayload,
  type MoldTrialSheetRow,
} from '../../../../services/haoligo';
import { moldDocumentCreatedAtColumn } from '../../../../utils/documentTableColumns';
import { executeDatasetQuery, getDatasetList } from '../../../../../../services/dataset';

const trialResultEnum: Record<string, { text: string }> = {
  合格: { text: '合格' },
  不合格: { text: '不合格' },
};

type PoPickerTrialFilter = 'all' | 'pending' | 'trialed';

/** 分页拉取当前租户已有试模单的采购订单号（用于采购单选择器标记） */
async function fetchAllTrialPurchaseOrderNosForPoPicker(): Promise<string[]> {
  const limit = 200;
  let skip = 0;
  const set = new Set<string>();
  for (;;) {
    const res = await listMoldTrialSheets({ skip, limit });
    const total = typeof res.total === 'number' ? res.total : 0;
    for (const row of res.items) {
      const n = String(row.purchase_order_no ?? '').trim();
      if (n) set.add(n);
    }
    skip += res.items.length;
    if (res.items.length === 0 || res.items.length < limit || skip >= total) break;
  }
  return [...set];
}

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
  /** 编辑时保留原状态（表单不再展示状态字段） */
  const editSheetStatusRef = useRef<MoldTrialSheetCreatePayload['sheet_status']>('草稿');
  const [bindingCfgForm] = Form.useForm<MoldTrialDatasetBindingPayload & { test_po?: string }>();
  const bindingDatasetUuidWatched = Form.useWatch('dataset_uuid', bindingCfgForm);

  const [modalVisible, setModalVisible] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(undefined);
  const [supplierOptions, setSupplierOptions] = useState<{ value: string; label: string; key: string }[]>([]);
  const [datasetBinding, setDatasetBinding] = useState<MoldTrialDatasetBindingPayload | null>(null);
  const [bindingModalOpen, setBindingModalOpen] = useState(false);
  const [datasetSelectOptions, setDatasetSelectOptions] = useState<{ label: string; value: string }[]>([]);
  const [bindingModalBusy, setBindingModalBusy] = useState(false);
  const [bindingTestResult, setBindingTestResult] = useState<string | null>(null);
  const [bindingColumnOptions, setBindingColumnOptions] = useState<{ value: string; label: string }[]>([]);
  const [bindingColumnsLoading, setBindingColumnsLoading] = useState(false);
  const [poPickerOpen, setPoPickerOpen] = useState(false);
  const [poPickerLoading, setPoPickerLoading] = useState(false);
  /** 已有试模单的采购订单号（与弹窗内 ERP 行比对） */
  const [existingTrialPoNos, setExistingTrialPoNos] = useState<string[]>([]);
  const [poPickerRows, setPoPickerRows] = useState<Record<string, unknown>[]>([]);
  const [poPickerSelectedKeys, setPoPickerSelectedKeys] = useState<React.Key[]>([]);
  const [poPickerSelectedRow, setPoPickerSelectedRow] = useState<Record<string, unknown> | null>(null);
  const [poPickerTrialFilter, setPoPickerTrialFilter] = useState<PoPickerTrialFilter>('all');

  const loadBindingDatasetColumns = useCallback(
    async (datasetUuid: string | undefined, opts?: { silent?: boolean }) => {
      const uuid = (datasetUuid ?? '').trim();
      if (!uuid) {
        setBindingColumnOptions([]);
        return;
      }
      setBindingColumnsLoading(true);
      try {
        const res = await executeDatasetQuery(uuid, {
          parameters: {},
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
                '无法加载列名：请确认该 SQL 支持无参数执行（与「从模具采购单创建」列表一致）',
            );
          }
          setBindingColumnOptions([]);
          return;
        }
        const unique = [...new Set(raw.map((c) => String(c).trim()).filter(Boolean))];
        setBindingColumnOptions(unique.map((c) => ({ value: c, label: c })));
        if (!opts?.silent && unique.length) {
          messageApi.success(`已加载 ${unique.length} 个列，可从下拉选择映射`);
        }
      } catch (e) {
        if (!opts?.silent) messageApi.error((e as Error).message || '加载列名失败');
        setBindingColumnOptions([]);
      } finally {
        setBindingColumnsLoading(false);
      }
    },
    [messageApi],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const b = await getMoldTrialDatasetBinding();
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

  const canCreateFromPo = useMemo(() => {
    const b = datasetBinding;
    if (!b?.dataset_uuid?.trim()) return false;
    if (!b.purchase_order_column?.trim()) return false;
    if (!b.supplier_column?.trim() || !b.mold_code_column?.trim() || !b.mold_name_column?.trim()) return false;
    return true;
  }, [datasetBinding]);

  const handleOpenPoFromErp = useCallback(() => {
    if (!canCreateFromPo) {
      messageApi.warning('请先在「数据集」里选好数据集，并填齐四个结果列名后保存。');
      return;
    }
    setPoPickerSelectedKeys([]);
    setPoPickerSelectedRow(null);
    setPoPickerOpen(true);
  }, [canCreateFromPo, messageApi]);

  useEffect(() => {
    if (!poPickerOpen || !datasetBinding) return;
    let cancelled = false;
    (async () => {
      setPoPickerLoading(true);
      setPoPickerRows([]);
      setExistingTrialPoNos([]);
      setPoPickerTrialFilter('all');
      try {
        const uuid = String(datasetBinding.dataset_uuid || '').trim();
        const [res, trialNos] = await Promise.all([
          executeDatasetQuery(uuid, { parameters: {}, limit: 2000, offset: 0 }),
          fetchAllTrialPurchaseOrderNosForPoPicker(),
        ]);
        if (cancelled) return;
        if (!res.success) {
          messageApi.error(res.error || '加载模具采购单列表失败');
          return;
        }
        setPoPickerRows((res.data ?? []) as Record<string, unknown>[]);
        setExistingTrialPoNos(trialNos);
      } catch (e) {
        if (!cancelled) messageApi.error((e as Error).message || '加载失败');
      } finally {
        if (!cancelled) setPoPickerLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [poPickerOpen, datasetBinding, messageApi]);

  const handlePoPickerConfirm = useCallback(() => {
    const b = datasetBinding;
    const r = poPickerSelectedRow;
    if (!b?.purchase_order_column?.trim() || !r) {
      messageApi.warning('请选择一条模具采购单');
      return;
    }
    const poK = b.purchase_order_column.trim();
    const supK = (b.supplier_column || '').trim();
    const codeK = (b.mold_code_column || '').trim();
    const nameK = (b.mold_name_column || '').trim();
    const purchase_order_no = String(r[poK] ?? '').trim();
    if (!purchase_order_no) {
      messageApi.warning('选中行缺少采购订单号，请检查配置中的「采购订单号」结果列名');
      return;
    }
    const pick = (key: string) => {
      const v = r[key];
      return v == null ? undefined : String(v);
    };
    setPoPickerOpen(false);
    setIsDetailView(false);
    setIsEdit(false);
    setEditId(null);
    setFormInitialValues({
      purchase_order_no,
      supplier_name: pick(supK),
      mold_code: pick(codeK),
      mold_name: pick(nameK),
      trial_result: '合格',
      result_attachments: [],
      inspection_attachments: [],
    });
    setModalVisible(true);
    setPoPickerSelectedKeys([]);
    setPoPickerSelectedRow(null);
  }, [datasetBinding, poPickerSelectedRow, messageApi]);

  const createFromPoToolbar = useMemo(
    () => [
      <Tooltip
        key="from-po-tip"
        title={
          canCreateFromPo
            ? '从当前数据集拉列表，选一行带出订单与模具信息'
            : '请完成「数据集」配置：一个数据集 + 四个列名'
        }
      >
        <span>
          <Button
            key="from-mold-po"
            type="primary"
            icon={<ShoppingOutlined />}
            disabled={!canCreateFromPo}
            onClick={handleOpenPoFromErp}
          >
            从模具采购单创建
          </Button>
        </span>
      </Tooltip>,
    ],
    [canCreateFromPo, handleOpenPoFromErp],
  );

  const poPickerFilteredRows = useMemo(() => {
    const b = datasetBinding;
    const poCol = b?.purchase_order_column?.trim();
    if (!poCol) return poPickerRows;
    const trialPoSet = new Set(existingTrialPoNos.map((s) => s.trim()).filter(Boolean));
    if (poPickerTrialFilter === 'all') return poPickerRows;
    return poPickerRows.filter((row) => {
      const no = String(row[poCol] ?? '').trim();
      const hasTrial = Boolean(no && trialPoSet.has(no));
      if (poPickerTrialFilter === 'pending') return !hasTrial;
      return hasTrial;
    });
  }, [poPickerRows, datasetBinding, existingTrialPoNos, poPickerTrialFilter]);

  const getPoPickerRowKey = useCallback(
    (row: Record<string, unknown>) => {
      const i = poPickerRows.indexOf(row);
      return i >= 0 ? String(i) : '__';
    },
    [poPickerRows],
  );

  useEffect(() => {
    if (!poPickerSelectedRow) return;
    if (!poPickerFilteredRows.includes(poPickerSelectedRow)) {
      setPoPickerSelectedKeys([]);
      setPoPickerSelectedRow(null);
    }
  }, [poPickerFilteredRows, poPickerSelectedRow]);

  const poPickerColumns = useMemo(() => {
    const b = datasetBinding;
    if (!b?.purchase_order_column?.trim()) return [];
    const po = b.purchase_order_column.trim();
    const sc = (b.supplier_column || '').trim();
    const mc = (b.mold_code_column || '').trim();
    const mn = (b.mold_name_column || '').trim();
    const trialPoSet = new Set(existingTrialPoNos.map((s) => s.trim()).filter(Boolean));
    return [
      {
        title: '采购订单号',
        dataIndex: po,
        key: 'po',
        ellipsis: true,
        width: 240,
        render: (_: unknown, row: Record<string, unknown>) => {
          const no = String(row[po] ?? '').trim();
          const hasTrial = no && trialPoSet.has(no);
          return (
            <Space size={6} wrap>
              <span>{no || '—'}</span>
              {hasTrial ? (
                <Tag color="processing" style={{ marginInlineEnd: 0 }}>
                  已建试模单
                </Tag>
              ) : null}
            </Space>
          );
        },
      },
      { title: '供应商', dataIndex: sc, key: 'sup', ellipsis: true, width: 160 },
      { title: '模具代号', dataIndex: mc, key: 'code', ellipsis: true, width: 120 },
      { title: '模具名称', dataIndex: mn, key: 'name', ellipsis: true },
    ];
  }, [datasetBinding, existingTrialPoNos]);

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

  const openSheetForm = async (record: MoldTrialSheetRow, detailOnly: boolean) => {
    try {
      const detail = await getMoldTrialSheet(record.id);
      setIsDetailView(detailOnly);
      setIsEdit(true);
      setEditId(detail.id);
      editSheetStatusRef.current = detail.sheet_status;
      setFormInitialValues({
        purchase_order_no: detail.purchase_order_no,
        supplier_name: detail.supplier_name ?? undefined,
        mold_code: detail.mold_code ?? undefined,
        mold_name: detail.mold_name ?? undefined,
        trial_times: detail.trial_times ?? undefined,
        result_attachments: uuidsToUploadFileList(detail.result_attachment_file_uuids),
        inspection_attachments: uuidsToUploadFileList(detail.inspection_attachment_file_uuids),
        trial_result: detail.trial_result,
        sync_mold_status: true,
      });
      setModalVisible(true);
    } catch (e) {
      messageApi.error((e as Error).message || '加载试模单失败');
    }
  };

  const handleEdit = (record: MoldTrialSheetRow) => void openSheetForm(record, false);
  const handleDetail = (record: MoldTrialSheetRow) => void openSheetForm(record, true);

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
    sheet_status: isEdit && editId != null ? editSheetStatusRef.current : '草稿',
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

      if (payload.trial_result === '合格' && values.sync_mold_status && payload.mold_code) {
        try {
          const res = await listMolds({ keyword: payload.mold_code, limit: 10, skip: 0 });
          const target = res.items.find((m) => m.mold_code === payload.mold_code);
          if (target) {
            await batchMoldsLifecycle({ scope: 'selected', mold_ids: [target.id], status: '待用' });
            messageApi.success('模具状态已更新为「待用」');
          } else {
            messageApi.warning('未找到对应模具代号，无法自动更新状态');
          }
        } catch (e) {
          messageApi.warning('自动更新模具状态失败');
        }
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

  const applyFromDatasetByPurchaseOrder = useCallback(
    async (purchaseOrderNo: string) => {
      const b = datasetBinding;
      if (!b?.dataset_uuid || !(b.order_param_key || '').trim()) return;
      const po = (purchaseOrderNo || '').trim();
      if (!po) return;
      const supK = (b.supplier_column || '').trim();
      const codeK = (b.mold_code_column || '').trim();
      const nameK = (b.mold_name_column || '').trim();
      if (!supK || !codeK || !nameK) return;
      try {
        const res = await executeDatasetQuery(b.dataset_uuid, {
          parameters: { [String(b.order_param_key).trim()]: po },
          limit: 10,
          offset: 0,
        });
        if (!res.success) {
          messageApi.warning(res.error || '按采购订单号查询失败');
          return;
        }
        const rows = res.data ?? [];
        if (rows.length === 0) {
          messageApi.info('未查到与该采购订单号匹配的记录');
          return;
        }
        if (rows.length > 1) {
          messageApi.info(`查询到 ${rows.length} 条，已取第一条填入供应商与模具信息`);
        }
        const row = rows[0] as Record<string, unknown>;
        const pick = (key: string) => {
          const v = row[key];
          return v == null ? undefined : String(v);
        };
        formRef.current?.setFieldsValue({
          supplier_name: pick(supK),
          mold_code: pick(codeK),
          mold_name: pick(nameK),
        });
      } catch (e) {
        messageApi.error((e as Error).message || '查询失败');
      }
    },
    [datasetBinding, messageApi],
  );

  const handleDatasetConfig = useCallback(() => {
    setBindingTestResult(null);
    setBindingModalOpen(true);
  }, []);

  useEffect(() => {
    if (!bindingModalOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const pageSize = 100;
        const options: { label: string; value: string }[] = [];
        let page = 1;
        const maxPages = 50;
        while (page <= maxPages) {
          const res = await getDatasetList({ page, page_size: pageSize, is_active: true });
          if (cancelled) return;
          for (const d of res.items) {
            options.push({ label: `${d.name}（${d.code}）`, value: d.uuid });
          }
          if (res.items.length < pageSize || options.length >= res.total) break;
          page += 1;
        }
        setDatasetSelectOptions(options);
      } catch (e) {
        if (!cancelled) {
          setDatasetSelectOptions([]);
          messageApi.error((e as Error).message || '加载数据集列表失败');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bindingModalOpen, messageApi]);

  useEffect(() => {
    if (!bindingModalOpen) return;
    bindingCfgForm.resetFields();
    const d = datasetBinding;
    bindingCfgForm.setFieldsValue({
      dataset_uuid: d?.dataset_uuid ?? undefined,
      purchase_order_column: d?.purchase_order_column ?? undefined,
      supplier_column: d?.supplier_column ?? undefined,
      mold_code_column: d?.mold_code_column ?? undefined,
      mold_name_column: d?.mold_name_column ?? undefined,
      order_param_key: d?.order_param_key ?? '',
      test_po: '',
    });
    setBindingTestResult(null);
    setBindingColumnOptions([]);
  }, [bindingModalOpen, datasetBinding, bindingCfgForm]);

  const handleBindingSave = async () => {
    const ds = String(bindingCfgForm.getFieldValue('dataset_uuid') ?? '').trim();
    if (!ds) {
      setBindingModalBusy(true);
      try {
        const saved = await putMoldTrialDatasetBinding({ dataset_uuid: '' });
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
    let v: Record<string, unknown>;
    try {
      v = await bindingCfgForm.validateFields([
        'purchase_order_column',
        'supplier_column',
        'mold_code_column',
        'mold_name_column',
      ]);
    } catch {
      return;
    }
    const opk = String(bindingCfgForm.getFieldValue('order_param_key') ?? '').trim();
    const sc = String(v.supplier_column ?? '').trim();
    const mc = String(v.mold_code_column ?? '').trim();
    const mn = String(v.mold_name_column ?? '').trim();
    const poCol = String(v.purchase_order_column ?? '').trim();
    if (!poCol || !sc || !mc || !mn) {
      messageApi.warning('请填写采购订单号、供应商、模具代号、模具名称对应的结果列名');
      return;
    }
    setBindingModalBusy(true);
    try {
      const saved = await putMoldTrialDatasetBinding({
        dataset_uuid: ds,
        order_param_key: opk || null,
        supplier_column: sc,
        mold_code_column: mc,
        mold_name_column: mn,
        purchase_order_column: poCol,
      });
      setDatasetBinding(saved);
      messageApi.success('关联已保存');
      setBindingModalOpen(false);
    } catch (e) {
      messageApi.error((e as Error).message || '保存失败');
    } finally {
      setBindingModalBusy(false);
    }
  };

  const handleBindingTestQuery = async () => {
    let v: Record<string, unknown>;
    try {
      v = await bindingCfgForm.validateFields([
        'dataset_uuid',
        'purchase_order_column',
        'supplier_column',
        'mold_code_column',
        'mold_name_column',
        'test_po',
      ]);
    } catch {
      return;
    }
    const testPo = String(v.test_po ?? '').trim();
    if (!testPo) {
      messageApi.warning('请输入测试用采购订单号');
      return;
    }
    const ds = String(v.dataset_uuid ?? '').trim();
    const opk = String(bindingCfgForm.getFieldValue('order_param_key') ?? '').trim();
    if (!ds || !opk) {
      messageApi.warning('测试时请填写「订单号参数名」');
      return;
    }
    setBindingModalBusy(true);
    setBindingTestResult(null);
    try {
      const res = await executeDatasetQuery(ds, {
        parameters: { [opk]: testPo },
        limit: 10,
        offset: 0,
      });
      if (!res.success) {
        setBindingTestResult(res.error || '查询失败');
        return;
      }
      const rows = res.data ?? [];
      if (rows.length === 0) {
        setBindingTestResult('查询成功，但无数据行');
        return;
      }
      const row = rows[0] as Record<string, unknown>;
      const sc = String(v.supplier_column ?? '').trim();
      const mc = String(v.mold_code_column ?? '').trim();
      const mn = String(v.mold_name_column ?? '').trim();
      const parts = [
        `供应商: ${String(row[sc] ?? '') || '（列名不匹配或为空）'}`,
        `模具代号: ${String(row[mc] ?? '') || '（列名不匹配或为空）'}`,
        `模具名称: ${String(row[mn] ?? '') || '（列名不匹配或为空）'}`,
      ];
      setBindingTestResult(`${parts.join('；')}（共 ${rows.length} 行，预览首行）`);
    } catch (e) {
      setBindingTestResult((e as Error).message || '请求失败');
    } finally {
      setBindingModalBusy(false);
    }
  };

  const uploadFieldProps = useMemo(
    (): Partial<UploadProps> => ({
      listType: 'picture-card',
      accept: '.jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar',
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
          const res = await uploadFile(file, { category: 'haoligo_mold_trial' });
          options.onSuccess?.(res, options.file);
        } catch (err) {
          options.onError?.(err instanceof Error ? err : new Error(String(err)));
        }
      },
    }),
    [messageApi],
  );

  const columns: ProColumns<MoldTrialSheetRow>[] = [
    {
      title: '关键词',
      dataIndex: 'keyword',
      key: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: '单号/订单号/模具代号/名称' },
    },
    {
      title: '试模单单号',
      dataIndex: 'sheet_no',
      key: 'sheet_no',
      width: 150,
      ellipsis: true,
      copyable: true,
      hideInSearch: true,
    },
    {
      title: '采购订单号',
      dataIndex: 'purchase_order_no',
      key: 'purchase_order_no',
      width: 160,
      ellipsis: true,
      copyable: true,
      hideInSearch: true,
    },
    {
      title: '供应商',
      dataIndex: 'supplier_name',
      key: 'supplier_name',
      width: 160,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '模具代号',
      dataIndex: 'mold_code',
      key: 'mold_code',
      width: 120,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '模具名称',
      dataIndex: 'mold_name',
      key: 'mold_name',
      width: 160,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '试模次数',
      dataIndex: 'trial_times',
      key: 'trial_times',
      width: 96,
      hideInSearch: true,
    },
    {
      title: '试模结果',
      dataIndex: 'trial_result',
      key: 'trial_result',
      width: 100,
      valueType: 'select',
      valueEnum: trialResultEnum,
      fieldProps: { allowClear: true },
      render: (_, r) => (
        <Tag color={r.trial_result === '合格' ? 'success' : 'error'}>{r.trial_result}</Tag>
      ),
    },
    moldDocumentCreatedAtColumn<MoldTrialSheetRow>(),
    {
      title: '操作',
      key: 'option',
      valueType: 'option',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail(record)}>
            详情
          </Button>
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
          columnPersistenceId="apps.haoligo.pages.molds.documents.trial.v2"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          toolBarActionsBeforeCreate={createFromPoToolbar}
          showDatasetConfigButton
          onDatasetConfig={handleDatasetConfig}
          request={async (params, _sort, _filter, searchFormValues) => {
            const current = params.current ?? 1;
            const pageSize = params.pageSize ?? 20;
            const skip = (current - 1) * pageSize;
            try {
              const res = await listMoldTrialSheets({
                skip,
                limit: pageSize,
                trial_result:
                  typeof searchFormValues?.trial_result === 'string' ? searchFormValues.trial_result : undefined,
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
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={isDetailView ? '试模单详情' : isEdit ? '编辑试模单' : '新增试模单'}
        open={modalVisible}
        readOnly={isDetailView}
        onClose={() => {
          setModalVisible(false);
          setEditId(null);
          setIsDetailView(false);
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
              extra={
                (datasetBinding?.dataset_uuid && (datasetBinding.order_param_key || '').trim())
                  ? '已填订单号参数：离开输入框时会按订单号查询并带出供应商与模具信息'
                  : undefined
              }
              fieldProps={{
                onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
                  void applyFromDatasetByPurchaseOrder(e.target.value);
                },
              }}
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
          <ProFormDependency name={['trial_result']}>
            {({ trial_result }) => {
              if (trial_result === '合格') {
                return (
                  <Col span={24}>
                    <ProForm.Item name="sync_mold_status" valuePropName="checked" style={{ marginBottom: 0 }}>
                      <Alert
                        message="合格后关联操作"
                        description={
                          <Form.Item name="sync_mold_status" valuePropName="checked" noStyle>
                            <Radio.Group
                              optionType="button"
                              buttonStyle="solid"
                              options={[
                                { label: '将模具状态更新为待用', value: true },
                                { label: '暂不更新模具状态', value: false },
                              ]}
                            />
                          </Form.Item>
                        }
                        type="info"
                        showIcon
                      />
                    </ProForm.Item>
                  </Col>
                );
              }
              return null;
            }}
          </ProFormDependency>
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
        </Row>
      </FormModalTemplate>

      <Modal
        title="试模单 · ERP 数据集"
        open={bindingModalOpen}
        onCancel={() => setBindingModalOpen(false)}
        width={640}
        destroyOnClose
        footer={[
          <Button key="cancel" onClick={() => setBindingModalOpen(false)}>
            取消
          </Button>,
          <Button key="save" type="primary" loading={bindingModalBusy} onClick={() => void handleBindingSave()}>
            保存
          </Button>,
        ]}
      >
        <Form<MoldTrialDatasetBindingPayload & { test_po?: string }> form={bindingCfgForm} layout="vertical">
          <Form.Item name="dataset_uuid" label="数据集">
            <Select
              allowClear
              showSearch
              placeholder="选模具采购单相关 SQL 数据集"
              optionFilterProp="label"
              options={datasetSelectOptions}
              onChange={() => {
                bindingCfgForm.setFieldsValue({
                  purchase_order_column: undefined,
                  supplier_column: undefined,
                  mold_code_column: undefined,
                  mold_name_column: undefined,
                });
                setBindingColumnOptions([]);
              }}
            />
          </Form.Item>
          <div style={{ marginBottom: 16 }}>
            <Button
              type="link"
              size="small"
              style={{ padding: 0 }}
              loading={bindingColumnsLoading}
              disabled={!bindingDatasetUuidWatched}
              onClick={() => {
                const u = bindingDatasetUuidWatched as string | undefined;
                void loadBindingDatasetColumns(typeof u === 'string' ? u : undefined, { silent: false });
              }}
            >
              加载列名（执行一次无参查询）
            </Button>
          </div>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="purchase_order_column"
                label="订单号列"
                rules={[{ required: true, message: '请填写' }]}
                extra="从下拉选列名，或与 SQL 结果别名一致"
              >
                <AutoComplete
                  allowClear
                  options={bindingColumnOptions}
                  placeholder="下拉选择或输入"
                  filterOption={(input, option) =>
                    String(option?.value ?? '')
                      .toLowerCase()
                      .includes(String(input).trim().toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="supplier_column" label="供应商列" rules={[{ required: true, message: '请填写' }]}>
                <AutoComplete
                  allowClear
                  options={bindingColumnOptions}
                  placeholder="下拉选择或输入"
                  filterOption={(input, option) =>
                    String(option?.value ?? '')
                      .toLowerCase()
                      .includes(String(input).trim().toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="mold_code_column" label="模具代号列" rules={[{ required: true, message: '请填写' }]}>
                <AutoComplete
                  allowClear
                  options={bindingColumnOptions}
                  placeholder="下拉选择或输入"
                  filterOption={(input, option) =>
                    String(option?.value ?? '')
                      .toLowerCase()
                      .includes(String(input).trim().toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="mold_name_column" label="模具名称列" rules={[{ required: true, message: '请填写' }]}>
                <AutoComplete
                  allowClear
                  options={bindingColumnOptions}
                  placeholder="下拉选择或输入"
                  filterOption={(input, option) =>
                    String(option?.value ?? '')
                      .toLowerCase()
                      .includes(String(input).trim().toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="order_param_key"
            label="订单号参数（选填）"
            extra="与 SQL 里 :os_no 的 os_no 一致；不填则不在输入框失焦时查库"
          >
            <Input placeholder="如 os_no" allowClear />
          </Form.Item>
          <Space align="start" wrap>
            <Form.Item name="test_po" label="试一条订单号" style={{ marginBottom: 0, minWidth: 200 }}>
              <Input placeholder="输入订单号" />
            </Form.Item>
            <Button style={{ marginTop: 30 }} onClick={() => void handleBindingTestQuery()} loading={bindingModalBusy}>
              测试
            </Button>
          </Space>
          {bindingTestResult ? (
            <Alert type="info" message={bindingTestResult} style={{ marginTop: 12 }} />
          ) : null}
        </Form>
      </Modal>

      <Modal
        title="从模具采购单创建试模单"
        open={poPickerOpen}
        onCancel={() => {
          setPoPickerOpen(false);
          setPoPickerSelectedKeys([]);
          setPoPickerSelectedRow(null);
        }}
        width={960}
        destroyOnClose
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setPoPickerOpen(false);
              setPoPickerSelectedKeys([]);
              setPoPickerSelectedRow(null);
            }}
          >
            取消
          </Button>,
          <Button key="ok" type="primary" onClick={() => void handlePoPickerConfirm()}>
            使用该采购单
          </Button>,
        ]}
      >
        <p style={{ marginBottom: 12, color: 'rgba(0,0,0,0.45)' }}>
          点选一行后点「使用该采购单」，会打开新建试模单并预填订单号与模具信息。已在本系统建过试模单的采购单号旁会显示「已建试模单」。
        </p>
        <div style={{ marginBottom: 12 }}>
          <Radio.Group
            optionType="button"
            buttonStyle="solid"
            value={poPickerTrialFilter}
            onChange={(e) => setPoPickerTrialFilter(e.target.value as PoPickerTrialFilter)}
            options={[
              { label: '全部', value: 'all' },
              { label: '待试模', value: 'pending' },
              { label: '已试模', value: 'trialed' },
            ]}
          />
        </div>
        <Table
          size="small"
          loading={poPickerLoading}
          rowKey={getPoPickerRowKey}
          dataSource={poPickerFilteredRows}
          columns={poPickerColumns}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          scroll={{ x: 720 }}
          rowSelection={{
            type: 'radio',
            selectedRowKeys: poPickerSelectedKeys,
            onChange: (keys, rows) => {
              setPoPickerSelectedKeys(keys);
              setPoPickerSelectedRow((rows[0] as Record<string, unknown>) ?? null);
            },
          }}
        />
      </Modal>
    </>
  );
};

export default MoldTrialSheetsPage;

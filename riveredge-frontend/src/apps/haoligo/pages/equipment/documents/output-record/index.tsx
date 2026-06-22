/**
 * 好力 GO — 设备产出单（制令单号 + 数据集带出；数据集关联在列表工具栏配置，对齐模具领用单）
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { rowActionKind } from '../../../../../../components/uni-action';
import {
  ActionType,
  ProColumns,
  ProForm,
  ProFormDateTimePicker,
  ProFormDigit,
  ProFormInstance,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Alert, AutoComplete, Button, Col, Form, Modal, Row, Select, Space, Spin } from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useGlobalStore } from '../../../../../../stores';
import { searchUserNameOptions } from '../../../../../../utils/userDisplay';
import { UniTable } from '../../../../../../components/uni-table';
import { ListPageTemplate, MODAL_CONFIG } from '../../../../../../components/layout-templates';
import {
  createEquipmentOutputRecord,
  deleteEquipmentOutputRecord,
  getEquipmentOutputDatasetBinding,
  getEquipmentOutputRecord,
  listEquipmentOutputRecords,
  listEquipments,
  listHaoligoNotifyUserOptions,
  previewEquipmentOutputByWorkOrder,
  putEquipmentOutputDatasetBinding,
  updateEquipmentOutputRecord,
  type EquipmentOutputDatasetBindingPayload,
  type EquipmentOutputRecordRow,
} from '../../../../services/haoligo';
import { FormNotifyUsersSelect } from '../../../../components/FormNotifyUsersSelect';
import {
  findEnabledBusinessNotificationRule,
  getFormNotifyUserDefaultsFromRule,
} from '../../../../../../components/business-notification-rules/notificationRuleFormUsers';
import { getBusinessConfig } from '../../../../../../services/businessConfig';
import {
  formatEquipmentOutputQty,
  roundEquipmentOutputQty,
} from '../../../../utils/equipmentOutputQty';
import { moldDocumentCreatedAtColumn } from '../../../../utils/documentTableColumns';
import { executeDatasetQuery, getDatasetByUuid, getDatasetList } from '../../../../../../services/dataset';
import { extractSqlNamedParams } from '../../../../../../utils/extractSqlNamedParams';
import { formatDateTime } from '../../../../../../utils/format';

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

const OUTPUT_RECORD_DOC_NOTIFICATION = 'haoligo_equipment_output_record';
const OUTPUT_RECORD_ACTION_CREATED = 'created';

function parseNotifyUserIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => Number(v)).filter((id) => Number.isFinite(id) && id > 0);
}

const OutputRecordDocumentsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [detailMode, setDetailMode] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [prefillBusy, setPrefillBusy] = useState(false);
  const [datasetSnapshot, setDatasetSnapshot] = useState<Record<string, unknown> | null>(null);
  const [outputDatasetBinding, setOutputDatasetBinding] = useState<EquipmentOutputDatasetBindingPayload | null>(null);

  const [bindingModalOpen, setBindingModalOpen] = useState(false);
  const [bindingCfgForm] = Form.useForm<EquipmentOutputDatasetBindingPayload>();
  const bindingDatasetUuidWatched = Form.useWatch('dataset_uuid', bindingCfgForm);
  const [datasetSelectOptions, setDatasetSelectOptions] = useState<{ label: string; value: string }[]>([]);
  const [bindingColumnOptions, setBindingColumnOptions] = useState<{ value: string; label: string }[]>([]);
  const [bindingColumnsLoading, setBindingColumnsLoading] = useState(false);
  const [bindingModalBusy, setBindingModalBusy] = useState(false);
  const [datasetParamKeyOptions, setDatasetParamKeyOptions] = useState<{ value: string; label: string }[]>([]);
  const [datasetParamKeysLoading, setDatasetParamKeysLoading] = useState(false);

  const { data: businessConfigRes } = useQuery({
    queryKey: ['businessConfig'],
    queryFn: getBusinessConfig,
    staleTime: 0,
  });
  const outputNotifyRule = useMemo(
    () =>
      findEnabledBusinessNotificationRule(
        businessConfigRes?.parameters?.notifications,
        OUTPUT_RECORD_DOC_NOTIFICATION,
        OUTPUT_RECORD_ACTION_CREATED,
      ),
    [businessConfigRes?.parameters?.notifications],
  );
  const outputNotifyDefaults = useMemo(
    () => getFormNotifyUserDefaultsFromRule(outputNotifyRule),
    [outputNotifyRule],
  );

  const searchOutputNotifyUsers = useCallback(
    async (keyword?: string, selectedIds?: number[]) => {
      const users = await listHaoligoNotifyUserOptions({
        keyword: keyword?.trim() || undefined,
        selected_user_ids: selectedIds?.length ? selectedIds : undefined,
        limit: 50,
      });
      return users.map((u) => ({ label: u.label, value: u.id }));
    },
    [],
  );

  const canPrefillFromDataset = useMemo(() => {
    const b = outputDatasetBinding;
    return Boolean(b?.dataset_uuid?.trim() && b?.work_order_param_key?.trim());
  }, [outputDatasetBinding]);

  const title = t('app.haoligo.menu.equipment.documents.output-record');
  const reload = useCallback(() => actionRef.current?.reload(), []);

  const currentUser = useGlobalStore((s) => s.currentUser);

  const loadUserNameOptions = useCallback(
    async (keyword: string | undefined, selectedName?: string) =>
      searchUserNameOptions({
        keyword,
        pageSize: 50,
        selectedName,
        currentUser,
      }),
    [currentUser],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const b = await getEquipmentOutputDatasetBinding();
        if (cancelled) return;
        setOutputDatasetBinding(b?.dataset_uuid?.trim() ? b : null);
      } catch {
        if (!cancelled) setOutputDatasetBinding(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
                (res.success ? t('app.haoligo.equipment.documents.outputDatasetLoadColumnsEmpty') : t('app.haoligo.equipment.loadFailed')),
            );
          }
          setBindingColumnOptions([]);
          return;
        }
        const unique = [...new Set(raw.map((c) => String(c).trim()).filter(Boolean))];
        setBindingColumnOptions(unique.map((c) => ({ value: c, label: c })));
        if (!opts?.silent && unique.length) {
          messageApi.success(t('app.haoligo.equipment.documents.outputDatasetLoadColumnsOk', { count: unique.length }));
        }
      } catch (e) {
        if (!opts?.silent) messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
        setBindingColumnOptions([]);
      } finally {
        setBindingColumnsLoading(false);
      }
    },
    [bindingDatasetUuidWatched, messageApi, t],
  );

  useEffect(() => {
    if (!bindingModalOpen) return;
    let cancelled = false;
    void (async () => {
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
          messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
        }
      }
    })();
    bindingCfgForm.resetFields();
    const d = outputDatasetBinding;
    bindingCfgForm.setFieldsValue({
      dataset_uuid: d?.dataset_uuid ?? undefined,
      work_order_param_key: d?.work_order_param_key ?? undefined,
      finished_product_code_column:
        d?.finished_product_code_column ?? d?.customer_column ?? undefined,
      finished_product_name_column:
        d?.finished_product_name_column ?? d?.product_name_column ?? undefined,
      planned_qty_column: d?.planned_qty_column ?? undefined,
    });
    setBindingColumnOptions([]);
    return () => {
      cancelled = true;
    };
  }, [bindingModalOpen, outputDatasetBinding, bindingCfgForm, messageApi, t]);

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
        const saved = outputDatasetBinding;
        const savedKey =
          saved?.dataset_uuid && String(saved.dataset_uuid).trim() === uuid
            ? String(saved.work_order_param_key ?? '').trim()
            : '';
        if (savedKey && !opts.some((o) => o.value === savedKey)) {
          opts.unshift({ value: savedKey, label: `${savedKey}（${t('app.haoligo.equipment.documents.outputDatasetParamSaved')}）` });
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
  }, [bindingModalOpen, bindingDatasetUuidWatched, outputDatasetBinding, t]);

  const handleDatasetConfig = useCallback(() => {
    setBindingModalOpen(true);
  }, []);

  const handleBindingSave = async () => {
    const ds = String(bindingCfgForm.getFieldValue('dataset_uuid') ?? '').trim();
    if (!ds) {
      setBindingModalBusy(true);
      try {
        const saved = await putEquipmentOutputDatasetBinding({});
        setOutputDatasetBinding(saved?.dataset_uuid?.trim() ? saved : null);
        messageApi.success(t('app.haoligo.equipment.settings.clearBinding'));
        setBindingModalOpen(false);
      } catch (e) {
        messageApi.error((e as Error).message || t('app.haoligo.equipment.saveFailed'));
      } finally {
        setBindingModalBusy(false);
      }
      return;
    }
    let v: EquipmentOutputDatasetBindingPayload;
    try {
      v = await bindingCfgForm.validateFields();
    } catch {
      return;
    }
    setBindingModalBusy(true);
    try {
      const saved = await putEquipmentOutputDatasetBinding({
        dataset_uuid: ds,
        work_order_param_key: String(v.work_order_param_key ?? '').trim(),
        finished_product_code_column: String(v.finished_product_code_column ?? '').trim() || undefined,
        finished_product_name_column: String(v.finished_product_name_column ?? '').trim() || undefined,
        planned_qty_column: String(v.planned_qty_column ?? '').trim() || undefined,
      });
      setOutputDatasetBinding(saved);
      messageApi.success(t('app.haoligo.equipment.updateSuccess'));
      setBindingModalOpen(false);
    } catch (e) {
      messageApi.error((e as Error).message || t('app.haoligo.equipment.saveFailed'));
    } finally {
      setBindingModalBusy(false);
    }
  };

  const getNewFormDefaults = useCallback(
    () => ({
      recorded_at: dayjs(),
      completed_qty: 0,
      notify_user_ids: [...outputNotifyDefaults],
    }),
    [outputNotifyDefaults],
  );

  const openNew = () => {
    setDetailMode(false);
    setEditId(null);
    setDatasetSnapshot(null);
    setModalOpen(true);
  };

  const openEdit = async (id: number, view: boolean) => {
    setFormLoading(true);
    setDetailMode(view);
    setEditId(id);
    setModalOpen(true);
    try {
      const row = await getEquipmentOutputRecord(id);
      setDatasetSnapshot((row.dataset_snapshot as Record<string, unknown>) || null);
      setTimeout(() => {
        formRef.current?.setFieldsValue({
          equipment_id: row.equipment_id,
          recorded_at: row.recorded_at ? dayjs(row.recorded_at) : undefined,
          work_order_no: row.work_order_no,
          finished_product_code: row.finished_product_code ?? undefined,
          finished_product_name: row.finished_product_name ?? undefined,
          planned_qty: roundEquipmentOutputQty(row.planned_qty),
          completed_qty: roundEquipmentOutputQty(row.completed_qty) ?? 0,
          startup_at: row.startup_at ? dayjs(row.startup_at) : undefined,
          completed_at: row.completed_at ? dayjs(row.completed_at) : undefined,
          operator_name: row.operator_name,
          team_leader_name: row.team_leader_name,
          remark: row.remark,
          notify_user_ids: row.notify_user_ids?.length ? row.notify_user_ids : [...outputNotifyDefaults],
        });
      }, 0);
    } catch (e) {
      messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
    } finally {
      setFormLoading(false);
    }
  };

  const runPrefill = async () => {
    if (!canPrefillFromDataset) {
      messageApi.warning(t('app.haoligo.equipment.documents.outputDatasetBindingNeedConfig'));
      return;
    }
    const wo = String(formRef.current?.getFieldValue('work_order_no') || '').trim();
    if (!wo) {
      messageApi.warning(t('app.haoligo.equipment.documents.outputWorkOrderRequired'));
      return;
    }
    setPrefillBusy(true);
    try {
      const res = await previewEquipmentOutputByWorkOrder({ work_order_no: wo });
      formRef.current?.setFieldsValue({
        finished_product_code: res.finished_product_code ?? undefined,
        finished_product_name: res.finished_product_name ?? undefined,
        planned_qty: roundEquipmentOutputQty(res.planned_qty),
      });
      setDatasetSnapshot(res.dataset_row || null);
      messageApi.success(t('app.haoligo.equipment.documents.outputPrefillOk'));
    } catch (e) {
      messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
    } finally {
      setPrefillBusy(false);
    }
  };

  const columns = useMemo<ProColumns<EquipmentOutputRecordRow>[]>(
    () => [
      { title: t('app.haoligo.equipment.documents.colSheetNo'), dataIndex: 'sheet_no', width: 130, ellipsis: true },
      {
        title: t('app.haoligo.equipment.documents.colRecordedAt'),
        dataIndex: 'recorded_at',
        width: 150,
        hideInSearch: true,
        render: (_, r) => (r.recorded_at ? formatDateTime(r.recorded_at, 'YYYY-MM-DD HH:mm') : '—'),
      },
      {
        title: t('app.haoligo.equipment.documents.colEquipment'),
        ellipsis: true,
        hideInSearch: true,
        render: (_, r) =>
          r.equipment_asset_code || r.equipment_name
            ? `${r.equipment_asset_code || ''} ${r.equipment_name || ''}`.trim()
            : `ID ${r.equipment_id}`,
      },
      {
        title: t('app.haoligo.equipment.documents.colWorkOrderNo'),
        dataIndex: 'work_order_no',
        width: 140,
        ellipsis: true,
        render: (_, r) => (r.work_order_no?.trim() ? r.work_order_no : '—'),
      },
      {
        title: t('app.haoligo.equipment.documents.colFinishedProductCode'),
        dataIndex: 'finished_product_code',
        width: 120,
        ellipsis: true,
        hideInSearch: true,
      },
      {
        title: t('app.haoligo.equipment.documents.colFinishedProductName'),
        dataIndex: 'finished_product_name',
        width: 140,
        ellipsis: true,
        hideInSearch: true,
      },
      {
        title: t('app.haoligo.equipment.documents.colPlannedQty'),
        dataIndex: 'planned_qty',
        width: 100,
        hideInSearch: true,
        render: (_, r) => formatEquipmentOutputQty(r.planned_qty),
      },
      {
        title: t('app.haoligo.equipment.documents.colCompletedQty'),
        dataIndex: 'completed_qty',
        width: 100,
        hideInSearch: true,
        render: (_, r) => formatEquipmentOutputQty(r.completed_qty),
      },
      {
        title: t('app.haoligo.equipment.documents.formStartupAt'),
        dataIndex: 'startup_at',
        width: 150,
        hideInSearch: true,
        render: (_, r) => (r.startup_at ? formatDateTime(r.startup_at, 'YYYY-MM-DD HH:mm') : '—'),
      },
      {
        title: t('app.haoligo.equipment.documents.formCompletedAt'),
        dataIndex: 'completed_at',
        width: 150,
        hideInSearch: true,
        render: (_, r) => (r.completed_at ? formatDateTime(r.completed_at, 'YYYY-MM-DD HH:mm') : '—'),
      },
      {
        title: t('app.haoligo.equipment.documents.formOperator'),
        dataIndex: 'operator_name',
        width: 100,
        ellipsis: true,
        hideInSearch: true,
        render: (_, r) => (r.operator_name?.trim() ? r.operator_name : '—'),
      },
      {
        title: t('app.haoligo.equipment.documents.formTeamLeader'),
        dataIndex: 'team_leader_name',
        width: 100,
        ellipsis: true,
        hideInSearch: true,
        render: (_, r) => (r.team_leader_name?.trim() ? r.team_leader_name : '—'),
      },
      {
        title: t('app.haoligo.equipment.documents.colRemark'),
        dataIndex: 'remark',
        width: 160,
        ellipsis: true,
        hideInSearch: true,
        render: (_, r) => (r.remark?.trim() ? r.remark : '—'),
      },
      moldDocumentCreatedAtColumn<EquipmentOutputRecordRow>(),
      {
        title: t('app.haoligo.equipment.documents.colActions'),
        valueType: 'option',
        width: 168,
        fixed: 'right',
        render: (_, row) => [
          <Button {...rowActionKind('read')} key="v" onClick={() => openEdit(row.id, true)}>
            {t('app.haoligo.equipment.documents.actionView')}
          </Button>,
          <Button {...rowActionKind('update')} key="e" onClick={() => openEdit(row.id, false)}>
            {t('app.haoligo.equipment.documents.actionEdit')}
          </Button>,
          <Button {...rowActionKind('delete')} key="delete" onClick={() => {
              Modal.confirm({
                title: t('app.haoligo.equipment.documents.deleteConfirm'),
                onOk: async () => {
                  await deleteEquipmentOutputRecord(row.id);
                  messageApi.success(t('app.haoligo.equipment.updateSuccess'));
                  reload();
                },
              });
            }}
          />,
        ],
      },
    ],
    [messageApi, reload, t],
  );

  const submit = async () => {
    try {
      await formRef.current?.validateFields();
    } catch {
      return;
    }
    const v = formRef.current?.getFieldsValue() as Record<string, unknown>;
    setFormLoading(true);
    try {
      const wo = String(v.work_order_no ?? '').trim();
      const body = {
        equipment_id: Number(v.equipment_id),
        work_order_no: wo || undefined,
        recorded_at: v.recorded_at
          ? dayjs.isDayjs(v.recorded_at)
            ? (v.recorded_at as dayjs.Dayjs).toISOString()
            : dayjs(v.recorded_at as string).toISOString()
          : dayjs().toISOString(),
        finished_product_code: String(v.finished_product_code ?? '').trim() || undefined,
        finished_product_name: String(v.finished_product_name ?? '').trim() || undefined,
        planned_qty: roundEquipmentOutputQty(v.planned_qty),
        completed_qty: roundEquipmentOutputQty(v.completed_qty) ?? 0,
        startup_at: v.startup_at ? dayjs(v.startup_at as string).toISOString() : undefined,
        completed_at: v.completed_at ? dayjs(v.completed_at as string).toISOString() : undefined,
        operator_name: (v.operator_name as string) || undefined,
        team_leader_name: (v.team_leader_name as string) || undefined,
        remark: String(v.remark ?? '').trim() || undefined,
        notify_user_ids: parseNotifyUserIds(v.notify_user_ids),
        dataset_snapshot: datasetSnapshot || undefined,
      };
      if (editId == null) {
        await createEquipmentOutputRecord(body);
      } else {
        await updateEquipmentOutputRecord(editId, body);
      }
      messageApi.success(t('app.haoligo.equipment.updateSuccess'));
      reload();
      setModalOpen(false);
    } catch (e) {
      messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <ListPageTemplate>
      <UniTable<EquipmentOutputRecordRow>
        columnPersistenceId="apps.haoligo.pages.equipment.documents.output-record"
        headerTitle={title}
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        search={{ labelWidth: 'auto' }}
        showCreateButton
        createButtonText={t('app.haoligo.equipment.documents.btnNew')}
        onCreate={openNew}
        showDatasetConfigButton
        onDatasetConfig={handleDatasetConfig}
        request={async (params) => {
          const res = await listEquipmentOutputRecords({
            skip: ((params.current || 1) - 1) * (params.pageSize || 50),
            limit: params.pageSize || 50,
            keyword: (params.keyword as string) || undefined,
            sheet_no: (params.sheet_no as string) || undefined,
            work_order_no: (params.work_order_no as string) || undefined,
          });
          return { data: res.items, total: res.total, success: true };
        }}
      />

      <Modal
        title={t('app.haoligo.equipment.documents.outputDatasetBindingTitle')}
        open={bindingModalOpen}
        onCancel={() => setBindingModalOpen(false)}
        width={720}
        destroyOnHidden
        footer={[
          <Button {...rowActionKind('revoke')} key="cancel" onClick={() => setBindingModalOpen(false)}>
            {t('app.haoligo.equipment.documents.btnCancel')}
          </Button>,
          <Button {...rowActionKind('skip')} key="save" type="primary" loading={bindingModalBusy} onClick={() => void handleBindingSave()}>
            {t('app.haoligo.equipment.documents.btnSave')}
          </Button>,
        ]}
      >
        <Form<EquipmentOutputDatasetBindingPayload> form={bindingCfgForm} layout="vertical">
          <Form.Item name="dataset_uuid" label={t('app.haoligo.equipment.settings.outputDatasetSelect')}>
            <Select
              allowClear
              showSearch
              placeholder={t('app.haoligo.equipment.settings.outputDatasetSelectPh')}
              optionFilterProp="label"
              options={datasetSelectOptions}
              onChange={() => {
                bindingCfgForm.setFieldsValue({
                  work_order_param_key: undefined,
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
              label={t('app.haoligo.equipment.settings.workOrderParamKey')}
              rules={[{ required: true, message: t('app.haoligo.equipment.documents.outputDatasetParamRequired') }]}
            >
              <AutoComplete
                allowClear
                style={{ width: '100%' }}
                options={datasetParamKeyOptions}
                placeholder={t('app.haoligo.equipment.documents.outputDatasetParamPh')}
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
              {t('app.haoligo.equipment.documents.outputDatasetLoadColumns')}
            </Button>
          </div>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="finished_product_code_column"
                label={t('app.haoligo.equipment.settings.finishedProductCodeColumn')}
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
              <Form.Item
                name="finished_product_name_column"
                label={t('app.haoligo.equipment.settings.finishedProductNameColumn')}
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
              <Form.Item name="planned_qty_column" label={t('app.haoligo.equipment.settings.plannedQtyColumn')}>
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
          <Alert type="info" showIcon title={t('app.haoligo.equipment.documents.outputDatasetBindingHintTitle')} description={t('app.haoligo.equipment.settings.outputDatasetIntro')} />
        </Form>
      </Modal>

      <Modal
        {...MODAL_CONFIG}
        title={
          detailMode
            ? `${title} — ${t('app.haoligo.equipment.documents.actionView')}`
            : editId
              ? `${title} — ${t('app.haoligo.equipment.documents.actionEdit')}`
              : `${title} — ${t('app.haoligo.equipment.documents.phaseNew')}`
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        afterOpenChange={(open) => {
          if (open && editId == null && !detailMode) {
            formRef.current?.setFieldsValue(getNewFormDefaults());
          }
        }}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        destroyOnHidden
        footer={
          detailMode ? (
            <Button onClick={() => setModalOpen(false)}>{t('app.haoligo.equipment.documents.btnClose')}</Button>
          ) : (
            <Space>
              <Button onClick={() => setModalOpen(false)}>{t('app.haoligo.equipment.documents.btnCancel')}</Button>
              <Button type="primary" loading={formLoading} onClick={() => void submit()}>
                {t('app.haoligo.equipment.documents.btnSave')}
              </Button>
            </Space>
          )
        }
      >
        <ProForm
          formRef={formRef}
          submitter={false}
          layout="vertical"
          disabled={detailMode}
          initialValues={editId == null && !detailMode ? getNewFormDefaults() : undefined}
        >
          <Row gutter={16}>
            <Col span={24}>
              <ProFormText
                name="work_order_no"
                label={t('app.haoligo.equipment.documents.colWorkOrderNo')}
                tooltip={t('app.haoligo.equipment.documents.outputWorkOrderTooltip')}
                placeholder={t('app.haoligo.equipment.documents.outputWorkOrderPh')}
                fieldProps={{
                  allowClear: true,
                  style: { width: '100%' },
                  addonAfter: !detailMode ? (
                    <Button
                      type="link"
                      size="small"
                      style={{ padding: '0 8px' }}
                      loading={prefillBusy}
                      disabled={!canPrefillFromDataset}
                      onClick={() => void runPrefill()}
                    >
                      {t('app.haoligo.equipment.documents.outputPrefillInlineBtn')}
                    </Button>
                  ) : undefined,
                }}
              />
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <ProFormSelect
                name="equipment_id"
                label={t('app.haoligo.equipment.documents.formEquipment')}
                rules={[{ required: true }]}
                disabled={detailMode || editId != null}
                fieldProps={{ showSearch: true, filterOption: false, style: { width: '100%' } }}
                request={async ({ keyWords }) => {
                  const res = await listEquipments({ keyword: keyWords || undefined, limit: 50 });
                  return (res.items || []).map((e) => ({ label: `${e.asset_code} ${e.name}`, value: e.id }));
                }}
              />
            </Col>
            <Col xs={24} md={12}>
              <ProFormDateTimePicker
                name="recorded_at"
                label={t('app.haoligo.equipment.documents.formRecordedAt')}
                fieldProps={{ style: { width: '100%' } }}
              />
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <ProFormText
                name="finished_product_code"
                label={t('app.haoligo.equipment.documents.colFinishedProductCode')}
                placeholder={t('app.haoligo.equipment.documents.outputPrefilledPlaceholder')}
                tooltip={t('app.haoligo.equipment.documents.outputPrefilledFieldTooltip')}
                fieldProps={{
                  readOnly: true,
                  style: { width: '100%', backgroundColor: detailMode ? undefined : '#fafafa' },
                }}
              />
            </Col>
            <Col xs={24} md={12}>
              <ProFormText
                name="finished_product_name"
                label={t('app.haoligo.equipment.documents.colFinishedProductName')}
                placeholder={t('app.haoligo.equipment.documents.outputPrefilledPlaceholder')}
                tooltip={t('app.haoligo.equipment.documents.outputPrefilledFieldTooltip')}
                fieldProps={{
                  readOnly: true,
                  style: { width: '100%', backgroundColor: detailMode ? undefined : '#fafafa' },
                }}
              />
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <ProFormDigit
                name="planned_qty"
                label={t('app.haoligo.equipment.documents.colPlannedQty')}
                placeholder={t('app.haoligo.equipment.documents.outputPrefilledPlaceholder')}
                tooltip={t('app.haoligo.equipment.documents.outputPrefilledFieldTooltip')}
                fieldProps={{
                  readOnly: true,
                  min: 0,
                  precision: 0,
                  style: { width: '100%', backgroundColor: detailMode ? undefined : '#fafafa' },
                }}
              />
            </Col>
            <Col xs={24} md={12}>
              <ProFormDigit
                name="completed_qty"
                label={t('app.haoligo.equipment.documents.colCompletedQty')}
                rules={[{ required: true }]}
                fieldProps={{ min: 0, precision: 0, style: { width: '100%' } }}
              />
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <ProFormDateTimePicker
                name="startup_at"
                label={t('app.haoligo.equipment.documents.formStartupAt')}
                fieldProps={{ style: { width: '100%' } }}
              />
            </Col>
            <Col xs={24} md={12}>
              <ProFormDateTimePicker
                name="completed_at"
                label={t('app.haoligo.equipment.documents.formCompletedAt')}
                fieldProps={{ style: { width: '100%' } }}
              />
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <ProFormSelect
                name="operator_name"
                label={t('app.haoligo.equipment.documents.formOperator')}
                showSearch
                allowClear
                debounceTime={300}
                request={async ({ keyWords }) =>
                  loadUserNameOptions(keyWords, formRef.current?.getFieldValue('operator_name') as string | undefined)
                }
                fieldProps={{
                  style: { width: '100%' },
                  placeholder: t('app.haoligo.equipment.documents.formOperatorPh'),
                  filterOption: false,
                }}
              />
            </Col>
            <Col xs={24} md={12}>
              <ProFormSelect
                name="team_leader_name"
                label={t('app.haoligo.equipment.documents.formTeamLeader')}
                showSearch
                allowClear
                debounceTime={300}
                request={async ({ keyWords }) =>
                  loadUserNameOptions(keyWords, formRef.current?.getFieldValue('team_leader_name') as string | undefined)
                }
                fieldProps={{
                  style: { width: '100%' },
                  placeholder: t('app.haoligo.equipment.documents.formTeamLeaderPh'),
                  filterOption: false,
                }}
              />
            </Col>
          </Row>
          <Row gutter={16}>
            <FormNotifyUsersSelect
              inline
              colSpan={24}
              name="notify_user_ids"
              label={t('app.haoligo.equipment.documents.formNotifyUsers')}
              placeholder={t('app.haoligo.equipment.documents.formNotifyUsersPh')}
              readonly={detailMode}
              seedUserIds={outputNotifyDefaults}
              searchUsers={searchOutputNotifyUsers}
            />
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <ProFormTextArea
                name="remark"
                label={t('app.haoligo.equipment.documents.colRemark')}
                fieldProps={{ rows: 3, style: { width: '100%' } }}
              />
            </Col>
          </Row>
          </ProForm>
      </Modal>
    </ListPageTemplate>
  );
};

export default OutputRecordDocumentsPage;

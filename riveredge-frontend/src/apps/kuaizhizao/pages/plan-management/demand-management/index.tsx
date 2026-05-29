/**
 * 统一需求管理页面
 *
 * 提供销售预测和销售订单的统一管理功能，支持MTS/MTO两种模式。
 *
 * 根据《☆ 用户使用全场景推演.md》的设计理念，将销售预测和销售订单统一为需求管理。
 *
 * @author Luigi Lu
 * @date 2025-01-14
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProForm, ProFormSelect, ProFormText, ProFormDatePicker, ProFormTextArea, ProDescriptions, ProFormInstance } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Row, Col, Table, Input, InputNumber, Alert, Spin, Form as AntForm, DatePicker, Typography, Tooltip, Dropdown, Empty, Tabs, theme as AntdTheme } from 'antd';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, DetailDrawerSection, DetailDrawerInlineFullChain, MODAL_CONFIG, DRAWER_CONFIG, type StatCard } from '../../../../../components/layout-templates';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import {
  listDemands,
  getDemand,
  createDemand,
  updateDemand,
  deleteDemand,
  submitDemand,
  approveDemand,
  rejectDemand,
  pushDemandToComputation,
  withdrawDemandFromComputation,
  listDemandRecalcHistory,
  listDemandSnapshots,
  getDemandStatistics,
  Demand,
  DemandItem,
  DemandStatus,
  ReviewStatus,
  DemandRecalcHistoryItem,
  DemandSnapshotItem,
} from '../../../services/demand';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { createDemandComputation } from '../../../services/demand-computation';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { UniTableDetailHeader } from '../../../../../components/uni-table-detail/UniTableDetail';
import { UniMaterialBatchPicker } from '../../../../../components/uni-material-batch-picker';
import type { Material } from '../../../../master-data/types/material';
import {
  EyeOutlined,
  EditOutlined,
  ArrowDownOutlined,
  RollbackOutlined,
  MergeCellsOutlined,
  DeleteOutlined,
  PlusOutlined,
  AppstoreAddOutlined,
  CopyOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { getDemandLifecycle } from '../../../utils/demandLifecycle';
import { getDemandBusinessModeLabel, getDemandBusinessModeTagColor } from '../../../utils/businessMode';
import { getDemandTypeLabel, getDemandTypeTagProps } from '../../../utils/demandType';
import { getDocumentLifecycleStageTagProps } from '../../../../../utils/documentLifecycleStatusTag';
import { renderRowActionsOverflow } from '../../../../../utils/renderRowActionsOverflow';
import dayjs from 'dayjs';
import { getDataDictionaryByCode, getDictionaryItemList } from '../../../../../services/dataDictionary';
import { WarehouseTraceBriefPrimaryActions } from '../../warehouse-management/WarehouseTraceBriefFooter';

const DEMAND_ORIGIN_SUB_KEYS = new Set(['from_forecast', 'from_order', 'manual_plan']);

/** 根据字典 code 和 value 获取标签，无匹配时返回原值（支持大小写不敏感匹配） */
function getDictLabel(map: Record<string, Record<string, string>>, code: string, value: string | undefined): string {
  if (!value) return '-';
  const dict = map[code];
  if (!dict) return value;
  const label = dict[value] ?? Object.entries(dict).find(([k]) => k.toUpperCase() === value.toUpperCase())?.[1];
  return label ?? value;
}

/** 格式化时间为 YYYY-MM-DD HH:mm:ss */
function formatDateTime(t: string | undefined): string {
  if (!t) return '-';
  const d = dayjs(t);
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm:ss') : t;
}

/** 详情「生命周期」区块标题：主标题 + 来源文案（无圆环、无单独来源子轨） */
function buildDemandLifecycleSectionTitle(record: Demand) {
  const lifecycle = getDemandLifecycle(record);
  const originLabel = (lifecycle.subStages ?? []).find((s: any) => DEMAND_ORIGIN_SUB_KEYS.has(s.key))?.label;
  if (!originLabel) {
    return '生命周期';
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 8, rowGap: 0 }}>
      <span>生命周期</span>
      <Typography.Text type="secondary" style={{ fontWeight: 400 }}>
        {originLabel}
      </Typography.Text>
    </span>
  );
}

/** 统一状态判断（兼容枚举与中文） */
function isDemandDraft(d: Demand): boolean {
  const s = (d?.status ?? '').trim();
  return s === DemandStatus.DRAFT || s === '草稿';
}
function isDemandPendingReview(d: Demand): boolean {
  const s = (d?.status ?? '').trim();
  return s === DemandStatus.PENDING_REVIEW || s === '待审核' || s === '已提交';
}
function isDemandAuditedAndApproved(d: Demand): boolean {
  const s = (d?.status ?? '').trim();
  const r = (d?.review_status ?? '').trim();
  return (s === DemandStatus.AUDITED || s === '已审核') && (r === ReviewStatus.APPROVED || r === '审核通过' || r === '通过' || r === '已通过');
}

function isDemandRejected(d: Demand): boolean {
  const s = (d?.status ?? '').trim();
  const r = (d?.review_status ?? '').trim();
  return (
    s === DemandStatus.REJECTED ||
    s === '已驳回' ||
    r === ReviewStatus.REJECTED ||
    r === '审核驳回' ||
    r === '驳回'
  );
}

const DemandManagementPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { token } = AntdTheme.useToken();
  const demandDetailDrawerZIndex = token.zIndexPopupBase;
  const actionRef = useRef<ActionType>(null);
  const demandRowsByIdRef = useRef<Map<number, Demand>>(new Map());
  const formRef = useRef<any>(null);
  const tableSearchFormRef = useRef<any>(null);

  const invalidateStatistics = () => {
    queryClient.invalidateQueries({ queryKey: ['demandStatistics'] });
  };

  const { data: statistics } = useQuery({
    queryKey: ['demandStatistics'],
    queryFn: getDemandStatistics,
  });

  const [modalVisible, setModalVisible] = useState(false);
  const [createPlanModalVisible, setCreatePlanModalVisible] = useState(false);
  const [createPlanLoading, setCreatePlanLoading] = useState(false);
  const createPlanFormRef = useRef<ProFormInstance>(null);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [isEditingDraft, setIsEditingDraft] = useState(false); // 当前编辑的需求是否为草稿（草稿可改更多字段）

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentDemand, setCurrentDemand] = useState<Demand | null>(null);
  const [recalcHistory, setRecalcHistory] = useState<DemandRecalcHistoryItem[]>([]);
  const [snapshots, setSnapshots] = useState<DemandSnapshotItem[]>([]);
  const [recalcHistoryLoading, setRecalcHistoryLoading] = useState(false);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [demandTrackingRefreshKey, setDemandTrackingRefreshKey] = useState(0);
  const [dictLabelMap, setDictLabelMap] = useState<Record<string, Record<string, string>>>({});

  const demandTracking = useDocumentTracking(
    drawerVisible && currentDemand?.id != null ? 'demand' : undefined,
    drawerVisible ? currentDemand?.id ?? undefined : undefined,
    demandTrackingRefreshKey
  );

  // 需求计划页仅管理手工需求计划（demand_plan）
  const demandType = 'demand_plan' as const;
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  useEffect(() => {
    const loadDicts = async () => {
      const result: Record<string, Record<string, string>> = {};
      const codes = ['SHIPPING_METHOD', 'PAYMENT_TERMS', 'MATERIAL_UNIT'];
      for (const code of codes) {
        try {
          const dict = await getDataDictionaryByCode(code);
          const items = await getDictionaryItemList(dict.uuid, true);
          const map: Record<string, string> = {};
          items.forEach((it) => {
            map[it.value] = it.label;
          });
          result[code] = map;
        } catch {
          result[code] = {};
        }
      }
      setDictLabelMap(result);
    };
    loadDicts();
  }, []);

  const handleCopy = useCallback(
    (text: string) => {
      if (!text?.trim()) return;
      void navigator.clipboard.writeText(text).then(
        () => messageApi.success(t('field.invitationCode.copySuccess', { defaultValue: '已复制' })),
        () => messageApi.error(t('field.invitationCode.copyFailed', { defaultValue: '复制失败' }))
      );
    },
    [messageApi, t]
  );

  const handleCreatePlanSubmit = async (values: any) => {
    setCreatePlanLoading(true);
    try {
      const items = (values.items || []).map((it: any) => ({
        material_id: it.material_id,
        material_code: it.material_code || '',
        material_name: it.material_name || '',
        material_unit: it.material_unit || 'PCS',
        required_quantity: Number(it.required_quantity) || 0,
        delivery_date: it.delivery_date ? dayjs(it.delivery_date).format('YYYY-MM-DD') : undefined,
      })).filter((it: any) => it.material_id && it.required_quantity > 0);
      if (items.length === 0) {
        messageApi.warning('请至少添加一行明细并填写需求数量');
        return;
      }
      await createDemand({
        demand_type: 'demand_plan',
        demand_name: values.demand_name,
        business_mode: values.business_mode || 'MTS',
        start_date: values.start_date ? dayjs(values.start_date).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        end_date: values.end_date ? dayjs(values.end_date).format('YYYY-MM-DD') : undefined,
        total_quantity: 0,
        total_amount: 0,
        status: DemandStatus.DRAFT,
        review_status: ReviewStatus.PENDING,
        priority: values.priority ?? 5,
        notes: values.notes,
        items,
      });
      messageApi.success('计划创建成功');
      setCreatePlanModalVisible(false);
      createPlanFormRef.current?.resetFields();
      invalidateStatistics();
      actionRef.current?.reload();
    } catch (err: any) {
      messageApi.error(getApiErrorMessage(err) || '提交失败');
    } finally {
      setCreatePlanLoading(false);
    }
  };

  const handleEdit = async (keys: React.Key[]) => {
    if (keys.length === 1) {
      const id = Number(keys[0]);
      setIsEdit(true);
      setCurrentId(id);
      setModalVisible(true);
      try {
        const data = await getDemand(id);
        setIsEditingDraft(isDemandDraft(data));
        formRef.current?.setFieldsValue(data);
      } catch (error: any) {
        messageApi.error('获取需求详情失败');
      }
    }
  };

  /**
   * 处理提交表单（仅用于编辑，如修改优先级）
   */
  const handleSubmit = async (values: any) => {
    if (!isEdit || !currentId) return;
    try {
      await updateDemand(currentId, values);
      messageApi.success('需求更新成功');
      setModalVisible(false);
      invalidateStatistics();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      throw error;
    }
  };

  useEffect(() => {
    if (!drawerVisible || !currentDemand?.id) return;

    const loadExtraData = async () => {
      setRecalcHistoryLoading(true);
      try {
        const history = await listDemandRecalcHistory(currentDemand.id!, { limit: 50 });
        setRecalcHistory(history);
      } catch {
        messageApi.error('获取重算历史失败');
      } finally {
        setRecalcHistoryLoading(false);
      }

      setSnapshotsLoading(true);
      try {
        const list = await listDemandSnapshots(currentDemand.id!, { limit: 20 });
        setSnapshots(list);
      } catch {
        messageApi.error('获取快照列表失败');
      } finally {
        setSnapshotsLoading(false);
      }
    };

    loadExtraData();
  }, [drawerVisible, currentDemand?.id, messageApi]);

  const handleDetail = async (keys: React.Key[]) => {
    if (keys.length === 1) {
      const id = Number(keys[0]);
      try {
        const data = await getDemand(id, true, false);
        setCurrentDemand(data);
        setDrawerVisible(true);
        setDemandTrackingRefreshKey((k) => k + 1);
      } catch (error: any) {
        messageApi.error('获取需求详情失败');
      }
    }
  };

  const handleDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) {
      messageApi.warning('请选择要删除的需求');
      return;
    }
    const allowedKeys = keys.filter((k) => {
      const id = Number(k);
      if (isNaN(id)) return false;
      const row = demandRowsByIdRef.current.get(id);
      if (!row) return true;
      if (row.demand_type !== 'demand_plan') return false;
      return isDemandDraft(row) || isDemandPendingReview(row);
    });
    const skipped = keys.length - allowedKeys.length;
    if (skipped > 0) {
      messageApi.warning(
        `已跳过 ${skipped} 条（非手工需求计划或状态不可删）。仅「需求计划」且草稿/待审核可在此删除。`
      );
    }
    if (allowedKeys.length === 0) {
      if (skipped === 0) messageApi.warning('没有符合删除条件的手工需求计划');
      return;
    }
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除选中的 ${allowedKeys.length} 个手工需求计划吗？仅草稿或待审核可删除。`,
      onOk: async () => {
        let successCount = 0;
        const errors: string[] = [];
        for (const k of allowedKeys) {
          const id = Number(k);
          if (isNaN(id)) continue;
          try {
            await deleteDemand(id);
            successCount += 1;
          } catch (e) {
            errors.push(`ID ${id}: ${getApiErrorMessage(e)}`);
          }
        }
        if (successCount > 0) {
          messageApi.success(`成功删除 ${successCount} 个需求`);
          invalidateStatistics();
          actionRef.current?.reload();
          setSelectedRowKeys((prev) => prev.filter((pk) => !allowedKeys.includes(pk)));
        }
        if (errors.length > 0) {
          messageApi.error(errors.slice(0, 3).join('；') + (errors.length > 3 ? ` 等${errors.length}条` : ''));
        }
      },
    });
  };

  const handleMergeComputation = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请先选择要合并计算的需求');
      return;
    }
    const ids = selectedRowKeys.map(k => Number(k)).filter(n => !isNaN(n));
    if (ids.length === 0) return;
    Modal.confirm({
      title: '合并需求计算',
      content: `确定将选中的 ${ids.length} 个需求合并进行需求计算吗？合并计算将保留各需求来源追溯。`,
      onOk: async () => {
        try {
          const payload = ids.length === 1
            ? { demand_id: ids[0], computation_type: 'MRP' as const, computation_params: {} }
            : { demand_ids: ids, computation_type: 'MRP' as const, computation_params: {} };
          const computation = await createDemandComputation(payload);
          messageApi.success('合并计算任务已创建');
          setSelectedRowKeys([]);
          invalidateStatistics();
          actionRef.current?.reload();
          if (computation?.id) {
            window.location.href = `/apps/kuaizhizao/plan-management/demand-computation?highlight=${computation.id}`;
          }
        } catch (error: any) {
          messageApi.error(error?.message || '创建合并计算失败');
        }
      },
    });
  };

  const handlePushToComputation = async (id: number) => {
    Modal.confirm({
      title: '下推到物料需求运算',
      content: '确定要将此需求下推到物料需求运算吗？下推后将创建需求计算任务。',
      onOk: async () => {
        try {
          const result = await pushDemandToComputation(id);
          messageApi.success(result.message || '需求下推成功');
          invalidateStatistics();
          actionRef.current?.reload();
          if (currentDemand?.id === id) {
            void getDemand(id)
              .then((updated) => setCurrentDemand(updated))
              .catch(() => {});
            setDemandTrackingRefreshKey((k) => k + 1);
          }
        } catch (error: any) {
          messageApi.error(error.message || '下推失败');
          throw error;
        }
      },
    });
  };

  const handleWithdrawFromComputation = async (id: number) => {
    Modal.confirm({
      title: '撤回下推',
      content: '确定要撤回此需求的下推吗？撤回后将尝试删除关联的计算任务，若下游已执行则不允许撤回。',
      onOk: async () => {
        try {
          await withdrawDemandFromComputation(id);
          messageApi.success('撤回成功');
          invalidateStatistics();
          actionRef.current?.reload();
          if (currentDemand?.id === id) {
            void getDemand(id)
              .then((updated) => setCurrentDemand(updated))
              .catch(() => {});
            setDemandTrackingRefreshKey((k) => k + 1);
          }
        } catch (error: any) {
          messageApi.error(error.message || '撤回失败');
          throw error;
        }
      },
    });
  };

  const columns: ProColumns<Demand>[] = [
    {
      title: '需求编号',
      dataIndex: 'demand_code',
      width: 160,
      ellipsis: true,
      fixed: 'left',
      render: (_: unknown, record: Demand) => (
        <Space size={4}>
          <span>{record.demand_code ?? '-'}</span>
          {record.demand_code ? (
            <Tooltip title={t('field.invitationCode.copy', { defaultValue: '复制' })}>
              <Button
                type="link"
                size="small"
                icon={<CopyOutlined style={{ fontSize: 12 }} />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopy(record.demand_code!);
                }}
              />
            </Tooltip>
          ) : null}
        </Space>
      ),
    },
    {
      title: '需求类型',
      dataIndex: 'demand_type',
      width: 120,
      render: (_: unknown, record: Demand) => (
        <Tag {...getDemandTypeTagProps(record.demand_type)}>{getDemandTypeLabel(record.demand_type)}</Tag>
      ),
    },
    {
      title: '需求名称',
      dataIndex: 'demand_name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '总数量',
      dataIndex: 'total_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '业务模式',
      dataIndex: 'business_mode',
      width: 100,
      valueEnum: {
        MTS: { text: '按库存生产', status: 'Processing' },
        MTO: { text: '按订单生产', status: 'Success' },
        ATO: { text: '按订单组装 (ATO)', status: 'Warning' },
      },
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle_stage',
      align: 'center' as const,
      fixed: 'right' as const,
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getDemandLifecycle(record);
        return (
          <UniLifecycle
            percent={lifecycle.percent}
            stageName={lifecycle.stageName}
            status={lifecycle.status}
            showLabel
            size="small"
            showCircleTooltip={false}
          />
        );
      },
    },
    {
      title: '操作',
      width: 300,
      fixed: 'right' as const,
      hideInSearch: true,
      render: (_, record) => {
        const canEdit = isDemandDraft(record) || isDemandPendingReview(record);
        const canDelete =
          record.demand_type === 'demand_plan' &&
          (isDemandDraft(record) || isDemandPendingReview(record));
        const parts: React.ReactNode[] = [
          <Button
            key="detail"
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleDetail([record.id!])}
          >
            详情
          </Button>,
        ];
        if (canEdit) {
          parts.push(
            <Button
              key="edit"
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit([record.id!])}
            >
              编辑
            </Button>
          );
        }
        if (canDelete) {
          parts.push(
            <Button
              key="del"
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete([record.id!])}
            >
              删除
            </Button>
          );
        }
        if (record.pushed_to_computation) {
          parts.push(
            <Button
              key="withdraw"
              type="link"
              size="small"
              icon={<RollbackOutlined />}
              onClick={() => handleWithdrawFromComputation(record.id!)}
            >
              撤回下推
            </Button>
          );
        } else if (isDemandAuditedAndApproved(record)) {
          parts.push(
            <Button
              key="push"
              type="link"
              size="small"
              icon={<ArrowDownOutlined />}
              onClick={() => handlePushToComputation(record.id!)}
            >
              下推
            </Button>
          );
        }

        parts.push(
          <UniWorkflowActions
            key="workflow-actions"
            record={record}
            entityName="需求"
            statusField="status"
            reviewStatusField="review_status"
            draftStatuses={[DemandStatus.DRAFT, '草稿']}
            pendingStatuses={[DemandStatus.PENDING_REVIEW, '待审核', '已提交']}
            approvedStatuses={[DemandStatus.AUDITED, '已审核', ReviewStatus.APPROVED, '审核通过', '通过', '已通过']}
            rejectedStatuses={[DemandStatus.REJECTED, '已驳回', ReviewStatus.REJECTED, '审核驳回', '驳回']}
            theme="link"
            size="small"
            actions={{
              submit: submitDemand,
              approve: approveDemand,
              reject: async (id, reason) => {
                if (!reason?.trim()) throw new Error('请输入驳回原因');
                return rejectDemand(id, reason.trim());
              },
            }}
            onSuccess={() => {
              invalidateStatistics();
              actionRef.current?.reload();
            }}
          />
        );
        return renderRowActionsOverflow(parts, `demand-${record.id ?? 'row'}`);
      },
    },
  ];

  const statCards: StatCard[] = statistics
    ? [
        { title: '活动需求', value: statistics.active_count },
        {
          title: '待审核',
          value: statistics.pending_review_count,
          valueStyle: statistics.pending_review_count > 0 ? { color: '#faad14' } : undefined,
          onClick:
            statistics.pending_review_count > 0
              ? () => {
                  tableSearchFormRef.current?.setFieldsValue?.({ lifecycle: '待审核' });
                  actionRef.current?.reload?.();
                }
              : undefined,
        },
        { title: '已审核', value: statistics.audited_count },
        { title: '已下推计算', value: statistics.pushed_count },
        {
          title: '总金额',
          value: statistics.total_amount ?? 0,
          prefix: '¥',
          precision: 2,
        },
      ]
    : [
        { title: '活动需求', value: 0 },
        { title: '待审核', value: 0 },
        { title: '已审核', value: 0 },
        { title: '已下推计算', value: 0 },
        {
          title: '总金额',
          value: 0,
          prefix: '¥',
          precision: 2,
        },
      ];
 
  const appendDemandPlanItemsFromMaterials = useCallback(
    (selected: Material[]) => {
      const current = createPlanFormRef.current?.getFieldValue('items') ?? [];
      const newRows = selected.map((m) => ({
        material_id: m.id,
        material_code: m.mainCode ?? m.code ?? '',
        material_name: m.name ?? '',
        material_unit: m.baseUnit ?? '',
        required_quantity: 0,
        delivery_date: dayjs(),
      }));
      createPlanFormRef.current?.setFieldsValue({ items: [...current, ...newRows] });
      messageApi.success(t('app.kuaizhizao.common.materialBatchAdded', { count: selected.length }));
    },
    [messageApi, t]
  );

  return (
    <>
      <ListPageTemplate statCards={statCards}>
        <UniTable<Demand>
          columnPersistenceId="apps.kuaizhizao.pages.plan-management.demand-management"
          headerTitle="需求管理"
          formRef={tableSearchFormRef}
          actionRef={actionRef}
          columns={columns}
          request={async (params, sort, _filter, searchFormValues) => {
            const apiParams: any = {
              skip: ((params.current || 1) - 1) * (params.pageSize || 20),
              limit: params.pageSize || 20,
            };

            apiParams.demand_type = 'demand_plan';
            if (searchFormValues?.lifecycle) {
              const lifecycleToStatus: Record<string, string> = {
                草稿: 'DRAFT',
                待审核: 'PENDING_REVIEW',
                已驳回: 'REJECTED',
                已审核: 'AUDITED',
                已下推计算: 'AUDITED',
              };
              apiParams.status = lifecycleToStatus[searchFormValues.lifecycle] ?? searchFormValues.lifecycle;
              if (searchFormValues.lifecycle === '已下推计算') {
                apiParams.pushed_to_computation = true;
              }
            } else if (searchFormValues?.status) {
              apiParams.status = searchFormValues.status;
            }

            if (sort) {
              const sortKeys = Object.keys(sort);
              if (sortKeys.length > 0) {
                const key = sortKeys[0];
                apiParams.order_by = sort[key] === 'ascend' ? key : `-${key}`;
              }
            }

            try {
              const response = await listDemands(apiParams);
              const rows = response.data || [];
              demandRowsByIdRef.current = new Map(
                rows.filter((d: Demand) => d.id != null).map((d: Demand) => [d.id as number, d])
              );
              return {
                data: rows,
                success: response.success !== false,
                total: response.total || 0,
              };
            } catch (error: any) {
              messageApi.error(error?.message || '获取列表失败');
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          rowKey="id"
          showAdvancedSearch={true}
          showCreateButton={false}
          showEditButton={false}
          showDeleteButton={true}
          onDelete={handleDelete}
          showImportButton={false}
          showExportButton
          onExport={async (type, keys, pageData) => {
            try {
              const res = await listDemands({ skip: 0, limit: 10000, demand_type: 'demand_plan' });
              let items = res.data || [];
              if (type === 'currentPage' && pageData?.length) {
                items = pageData;
              } else if (type === 'selected' && keys?.length) {
                items = items.filter((d: Demand) => d.id != null && keys.includes(d.id));
              }
              if (items.length === 0) {
                messageApi.warning('暂无数据可导出');
                return;
              }
              const blob = new window.Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `demands-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              window.URL.revokeObjectURL(url);
              messageApi.success(`已导出 ${items.length} 条记录`);
            } catch (error: any) {
              messageApi.error(error?.message || '导出失败');
            }
          }}
          enableRowSelection={true}
          onRowSelectionChange={setSelectedRowKeys}
          toolBarActions={[
            <Button
              key="create-plan"
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreatePlanModalVisible(true)}
            >
              新建需求计划
            </Button>,
            <Tooltip
              key="merge-computation-tooltip"
              title="合并选中需求进入统一需求计算，随后在计算单中下推半成品工单等下游单据"
            >
              <Button
                key="merge-computation"
                type="primary"
                icon={<MergeCellsOutlined />}
                disabled={selectedRowKeys.length === 0}
                onClick={handleMergeComputation}
              >
                合并计算
              </Button>
            </Tooltip>,
          ]}
        />
      </ListPageTemplate>

      {/* 新建计划：FormModalTemplate + 两栏表头 + 销售订单式明细 Table */}
      <FormModalTemplate
        title="新建需求计划"
        open={createPlanModalVisible}
        onClose={() => {
          setCreatePlanModalVisible(false);
          createPlanFormRef.current?.resetFields();
        }}
        onFinish={handleCreatePlanSubmit}
        isEdit={false}
        formRef={createPlanFormRef as React.RefObject<ProFormInstance>}
        width={1200}
        loading={createPlanLoading}
        grid={false}
        initialValues={{ business_mode: 'MTS', priority: 5, items: [] }}
      >
        <Row gutter={16}>
          <Col span={24}>
            <ProFormText
              name="demand_name"
              label="计划名称"
              placeholder="请输入计划名称"
              rules={[{ required: true, message: '请输入计划名称' }]}
            />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="start_date"
              label="开始日期"
              rules={[{ required: true, message: '请选择开始日期' }]}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="end_date"
              label="结束日期（选填）"
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="business_mode"
              label={
                <Space size={6} align="center">
                  <span>业务模式</span>
                  <Tooltip
                    title="下推「需求计算」时计算类型统一为 MRP；MTS / MTO / ATO 写入计算头；ATO 下推工单时与 MTO 同为按单驱动（工单生产模式为 MTO）。"
                  >
                    <Button type="text" size="small" icon={<QuestionCircleOutlined />} aria-label="业务模式说明" style={{ padding: 0, height: 'auto', color: 'var(--ant-color-text-tertiary)' }} />
                  </Tooltip>
                </Space>
              }
              options={[
                { label: '按库存生产 (MTS)', value: 'MTS' },
                { label: '按订单生产 (MTO)', value: 'MTO' },
                { label: '按订单组装 (ATO)', value: 'ATO' },
              ]}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="priority"
              label="优先级"
              options={[
                { label: '高 (1)', value: 1 },
                { label: '中 (5)', value: 5 },
                { label: '低 (10)', value: 10 },
              ]}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
        </Row>

        <div className="uni-table-detail" style={{ marginBottom: 24 }}>
          <UniTableDetailHeader title="计划明细" required />
          <ProForm.Item
            name="items"
            noStyle
            rules={[{ type: 'array', min: 1, message: '请至少添加一行明细' }]}
          >
            <AntForm.List name="items">
              {(fields, { add, remove }) => {
                const planDetailColumns = [
                  {
                    title: '物料',
                    dataIndex: 'material_id',
                    width: 280,
                    render: (_: unknown, __: unknown, index: number) => (
                      <>
                        <div
                          className="sales-order-material-cell"
                          style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 8 }}
                        >
                          <div style={{ flex: 1, minWidth: 200 }}>
                            <UniMaterialSelect
                              name={[index, 'material_id']}
                              label=""
                              placeholder="请选择物料"
                              required
                              size="small"
                              listFieldKey={index}
                              listFieldName="items"
                              fillMapping={{
                                material_code: 'mainCode',
                                material_name: 'name',
                                material_unit: 'baseUnit',
                              }}
                              formItemProps={{ style: { margin: 0 } }}
                            />
                          </div>
                        </div>
                        <AntForm.Item name={[index, 'material_code']} hidden>
                          <Input />
                        </AntForm.Item>
                        <AntForm.Item name={[index, 'material_name']} hidden>
                          <Input />
                        </AntForm.Item>
                        <AntForm.Item name={[index, 'material_unit']} hidden>
                          <Input />
                        </AntForm.Item>
                      </>
                    ),
                  },
                  {
                    title: '数量',
                    dataIndex: 'required_quantity',
                    width: 110,
                    align: 'right' as const,
                    render: (_: unknown, __: unknown, index: number) => (
                      <AntForm.Item
                        name={[index, 'required_quantity']}
                        rules={[
                          { required: true, message: '必填' },
                          { type: 'number', min: 0.0001, message: '>0' },
                        ]}
                        style={{ margin: 0 }}
                      >
                        <InputNumber placeholder="数量" min={0} precision={4} style={{ width: '100%' }} size="small" />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: '需求日期',
                    dataIndex: 'delivery_date',
                    width: 130,
                    render: (_: unknown, __: unknown, index: number) => (
                      <AntForm.Item
                        name={[index, 'delivery_date']}
                        rules={[{ required: true, message: '必填' }]}
                        style={{ margin: 0 }}
                      >
                        <DatePicker size="small" style={{ width: '100%' }} format="YYYY-MM-DD" />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: '操作',
                    width: 72,
                    fixed: 'right' as const,
                    onHeaderCell: () => ({ className: 'sales-order-fixed-op-header' }),
                    render: (_: unknown, __: unknown, index: number) => (
                      <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(index)}>
                        删除
                      </Button>
                    ),
                  },
                ];
                const totalWidth = planDetailColumns.reduce((s, c) => s + (typeof c.width === 'number' ? c.width : 0), 0);
                return (
                  <div style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                    <style>{`
                      .sales-order-detail-table .ant-table-thead > tr > th {
                        background-color: var(--ant-color-fill-alter) !important;
                        font-weight: 600;
                      }
                      .sales-order-detail-table .ant-table-thead > tr > th.sales-order-fixed-op-header {
                        background: var(--ant-color-fill-alter) !important;
                      }
                      .sales-order-detail-table .ant-table-cell-fix-right {
                        background: var(--ant-color-bg-container) !important;
                      }
                      .sales-order-detail-table .ant-table {
                        border-top: 1px solid var(--ant-color-border);
                      }
                      .sales-order-detail-table .ant-table-tbody > tr > td {
                        border-bottom: 1px solid var(--ant-color-border);
                        overflow: visible !important;
                      }
                      .sales-order-detail-table .sales-order-material-cell .ant-form-item,
                      .sales-order-detail-table .sales-order-material-cell .ant-form-item-control,
                      .sales-order-detail-table .sales-order-material-cell .ant-form-item-control-input,
                      .sales-order-detail-table .sales-order-material-cell .ant-select {
                        width: 100% !important;
                        min-width: 0;
                      }
                      .sales-order-detail-table .ant-form-item-explain,
                      .sales-order-detail-table .ant-form-item-explain-error {
                        display: none !important;
                      }
                      .sales-order-detail-table .ant-input-number-input::selection,
                      .sales-order-detail-table .ant-input::selection {
                        background-color: var(--ant-color-primary);
                        color: #fff;
                        border-radius: 0;
                      }
                    `}</style>
                    <div style={{ width: '100%', overflowX: 'auto' }}>
                      <Table
                        className="sales-order-detail-table"
                        size="small"
                        dataSource={fields.map((f, i) => ({ ...f, key: f.key ?? i }))}
                        rowKey="key"
                        pagination={false}
                        columns={planDetailColumns}
                        scroll={fields.length > 0 ? { x: totalWidth } : undefined}
                        style={{ width: '100%', margin: 0 }}
                        footer={() => (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%' }}>
                            <Button
                              type="dashed"
                              icon={<PlusOutlined />}
                              style={{ flex: 1, minWidth: 120 }}
                              onClick={() =>
                                add({
                                  material_id: undefined,
                                  material_code: '',
                                  material_name: '',
                                  material_unit: '',
                                  required_quantity: 0,
                                  delivery_date: dayjs(),
                                })
                              }
                            >
                              添加明细
                            </Button>
                            <Button
                              type="default"
                              icon={<AppstoreAddOutlined />}
                              style={{ flex: 1, minWidth: 120 }}
                              onClick={() => setMaterialPickerOpen(true)}
                            >
                              {t('app.kuaizhizao.common.materialBatchSelect')}
                            </Button>
                          </div>
                        )}
                      />
                    </div>
                  </div>
                );
              }}
            </AntForm.List>
          </ProForm.Item>
        </div>

        <Row gutter={16}>
          <Col span={24}>
            <ProFormTextArea name="notes" label="备注" fieldProps={{ rows: 2 }} />
          </Col>
        </Row>
      </FormModalTemplate>

      <UniMaterialBatchPicker
        open={materialPickerOpen}
        onCancel={() => setMaterialPickerOpen(false)}
        onConfirm={appendDemandPlanItemsFromMaterials}
      />

      {/* 编辑需求 Modal：非草稿仅可改优先级和备注；草稿可改更多字段 */}
      <Modal
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        title={isEditingDraft ? '编辑需求' : '修改需求'}
        width={MODAL_CONFIG.SMALL_WIDTH}
        footer={null}
        destroyOnHidden
      >
        <ProForm
          formRef={formRef}
          onFinish={handleSubmit}
          layout="vertical"
          submitter={{
            render: () => (
              <div style={{ textAlign: 'right', marginTop: 16 }}>
                <Space>
                  <Button onClick={() => setModalVisible(false)}>取消</Button>
                  <Button type="primary" onClick={() => formRef.current?.submit()}>
                    更新
                  </Button>
                </Space>
              </div>
            ),
          }}
        >
          {/* 非草稿：仅可修改优先级和备注（与上游同步） */}
          {!isEditingDraft && (
            <Row gutter={16}>
              <Col span={24}>
                <ProFormSelect
                  name="priority"
                  label="优先级"
                  options={[
                    { label: '高 (1)', value: 1 },
                    { label: '中 (5)', value: 5 },
                    { label: '低 (10)', value: 10 },
                  ]}
                  fieldProps={{ style: { width: 200 } }}
                />
              </Col>
              <Col span={24}>
                <ProFormTextArea
                  name="notes"
                  label="备注"
                  fieldProps={{ rows: 3 }}
                />
              </Col>
            </Row>
          )}
          {/* 草稿：可编辑必要字段 */}
          {isEditingDraft && (
            <Row gutter={16}>
              <Col span={12}>
                <ProFormSelect
                  name="priority"
                  label="优先级"
                  options={[
                    { label: '高 (1)', value: 1 },
                    { label: '中 (5)', value: 5 },
                    { label: '低 (10)', value: 10 },
                  ]}
                  fieldProps={{ style: { width: '100%' } }}
                />
              </Col>
              <Col span={12}>
                <ProFormSelect
                  name="demand_type"
                  label="需求类型"
                  options={[
                    { label: '需求计划', value: 'demand_plan' },
                  ]}
                  rules={[{ required: true, message: '请选择需求类型' }]}
                  fieldProps={{
                    style: { width: '100%' },
                  }}
                />
              </Col>
              <Col span={12}>
                <ProFormText
                  name="demand_name"
                  label="需求名称"
                  placeholder="请输入需求名称"
                  rules={[{ required: true, message: '请输入需求名称' }]}
                />
              </Col>
              <Col span={12}>
                <ProFormDatePicker
                  name="start_date"
                  label="开始日期"
                  rules={[{ required: true, message: '请选择开始日期' }]}
                  width="100%"
                />
              </Col>
              <Col span={12}>
                <ProFormDatePicker
                  name="end_date"
                  label="结束日期"
                  width="100%"
                />
              </Col>
              <Col span={24}>
                <ProFormTextArea
                  name="notes"
                  label="备注"
                  fieldProps={{ rows: 3 }}
                />
              </Col>
            </Row>
          )}
        </ProForm>
      </Modal>

      <DetailDrawerTemplate
        title={
          currentDemand?.demand_code ? (
            <Space align="center" size={8}>
              <span>{`需求详情 - ${currentDemand.demand_code}`}</span>
              <Tooltip title={t('field.invitationCode.copy', { defaultValue: '复制' })}>
                <Button
                  type="text"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => handleCopy(currentDemand.demand_code!)}
                />
              </Tooltip>
            </Space>
          ) : (
            '需求详情'
          )
        }
        open={drawerVisible}
        zIndex={demandDetailDrawerZIndex}
        onClose={() => {
          setDrawerVisible(false);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        extra={
          currentDemand && (
            <Space>
              <UniWorkflowActions
                record={currentDemand}
                entityName="需求"
                statusField="status"
                reviewStatusField="review_status"
                draftStatuses={[DemandStatus.DRAFT, '草稿']}
                pendingStatuses={[DemandStatus.PENDING_REVIEW, '待审核', '已提交']}
                approvedStatuses={[DemandStatus.AUDITED, '已审核', ReviewStatus.APPROVED, '审核通过', '通过', '已通过']}
                rejectedStatuses={[DemandStatus.REJECTED, '已驳回', ReviewStatus.REJECTED, '审核驳回', '驳回']}
                theme="default"
                size="middle"
                actions={{
                  submit: submitDemand,
                  approve: approveDemand,
                  reject: async (id, reason) => {
                    if (!reason?.trim()) throw new Error('请输入驳回原因');
                    return rejectDemand(id, reason.trim());
                  },
                }}
                onSuccess={async () => {
                  invalidateStatistics();
                  actionRef.current?.reload();
                  setDemandTrackingRefreshKey((k) => k + 1);
                  if (currentDemand?.id) {
                    const updated = await getDemand(currentDemand.id, true, false);
                    setCurrentDemand(updated);
                  }
                }}
              />
              <Button
                icon={<EditOutlined />}
                onClick={() => {
                  setDrawerVisible(false);
                  handleEdit([currentDemand.id!]);
                }}
              >
                编辑
              </Button>
              {currentDemand.pushed_to_computation ? (
                <Button
                  icon={<RollbackOutlined />}
                  onClick={() => handleWithdrawFromComputation(currentDemand.id!)}
                >
                  撤回下推
                </Button>
              ) : (
                isDemandAuditedAndApproved(currentDemand) && (
                  <Button
                    type="primary"
                    icon={<ArrowDownOutlined />}
                    onClick={() => handlePushToComputation(currentDemand.id!)}
                  >
                    下推到物料需求运算
                  </Button>
                )
              )}
            </Space>
          )
        }
      >
        {currentDemand && (
          <div style={{ padding: '0 0 16px 0' }}>
            {currentDemand.pushed_to_computation && currentDemand.computation_id && (
              <Alert
                type="info"
                showIcon
                message="需求已变更时，请前往需求计算重新执行计算"
                description={
                  <span>
                    本需求已下推至需求计算
                    {currentDemand.computation_code && `（${currentDemand.computation_code}）`}
                    。若上游已修改并同步，请
                    <Button
                      type="link"
                      size="small"
                      style={{ padding: 0 }}
                      onClick={() => {
                        setDrawerVisible(false);
                        navigate(`/apps/kuaizhizao/plan-management/demand-computation?highlight=${currentDemand.computation_id}`);
                      }}
                    >
                      前往需求计算
                    </Button>
                    重新执行计算。
                  </span>
                }
                style={{ marginBottom: 16 }}
              />
            )}

            <DetailDrawerSection title="基本信息">
              <ProDescriptions column={3} dataSource={currentDemand}>
                <ProDescriptions.Item label="需求编号" dataIndex="demand_code">
                  <Space size={4}>
                    <span>{currentDemand.demand_code ?? '-'}</span>
                    {currentDemand.demand_code ? (
                      <Tooltip title={t('field.invitationCode.copy', { defaultValue: '复制' })}>
                        <Button
                          type="link"
                          size="small"
                          icon={<CopyOutlined style={{ fontSize: 12 }} />}
                          onClick={() => handleCopy(currentDemand.demand_code!)}
                        />
                      </Tooltip>
                    ) : null}
                  </Space>
                </ProDescriptions.Item>
                <ProDescriptions.Item label="需求类型">
                  <Tag {...getDemandTypeTagProps(currentDemand.demand_type)}>{getDemandTypeLabel(currentDemand.demand_type)}</Tag>
                </ProDescriptions.Item>
                <ProDescriptions.Item label="需求名称" dataIndex="demand_name" />
                <ProDescriptions.Item label="业务模式" dataIndex="business_mode">
                  <Tag color={getDemandBusinessModeTagColor(currentDemand.business_mode)}>
                    {getDemandBusinessModeLabel(currentDemand.business_mode)}
                  </Tag>
                </ProDescriptions.Item>
                <ProDescriptions.Item label="开始日期" dataIndex="start_date" valueType="date" />
                <ProDescriptions.Item label="结束日期" dataIndex="end_date" valueType="date" />
                {currentDemand.demand_type === 'sales_forecast' && (
                  <ProDescriptions.Item label="预测周期" dataIndex="forecast_period" />
                )}
                {currentDemand.demand_type === 'sales_order' && (
                  <>
                    <ProDescriptions.Item label="订单日期" dataIndex="order_date" valueType="date" />
                    <ProDescriptions.Item label="交货日期" dataIndex="delivery_date" valueType="date" />
                  </>
                )}
                <ProDescriptions.Item label="客户名称" dataIndex="customer_name" />
                {currentDemand.demand_type === 'sales_order' && (
                  <>
                    <ProDescriptions.Item label="销售员" dataIndex="salesman_name" />
                    <ProDescriptions.Item label="收货地址" dataIndex="shipping_address" span={3} />
                    <ProDescriptions.Item label="发货方式">
                      {getDictLabel(dictLabelMap, 'SHIPPING_METHOD', currentDemand.shipping_method)}
                    </ProDescriptions.Item>
                    <ProDescriptions.Item label="付款条件">
                      {getDictLabel(dictLabelMap, 'PAYMENT_TERMS', currentDemand.payment_terms)}
                    </ProDescriptions.Item>
                  </>
                )}
                <ProDescriptions.Item label="总数量" dataIndex="total_quantity" />
                <ProDescriptions.Item label="状态">
                  {(() => {
                    const lifecycle = getDemandLifecycle(currentDemand);
                    return (
                      <Tag {...getDocumentLifecycleStageTagProps(lifecycle.stageName)}>
                        {lifecycle.stageName}
                      </Tag>
                    );
                  })()}
                </ProDescriptions.Item>
                <ProDescriptions.Item label="备注" dataIndex="notes" span={3} />
              </ProDescriptions>
            </DetailDrawerSection>

            <DetailDrawerSection title={buildDemandLifecycleSectionTitle(currentDemand)}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {(() => {
                  const lifecycle = getDemandLifecycle(currentDemand);
                  const mainStages = lifecycle.mainStages ?? [];
                  const hasStepper = mainStages.length > 0;
                  return (
                    <>
                      {mainStages.length > 0 && (
                        <UniLifecycleStepper
                          steps={mainStages}
                          status={lifecycle.status}
                          showLabels
                          nextStepSuggestions={lifecycle.nextStepSuggestions}
                          hideNextStepSuggestions
                        />
                      )}
                      {!hasStepper && (
                        <Typography.Text type="secondary">暂无可展示的生命周期步骤</Typography.Text>
                      )}
                    </>
                  );
                })()}
                {currentDemand.id != null ? (
                  <DetailDrawerInlineFullChain
                    documentType="demand"
                    documentId={currentDemand.id}
                    active={drawerVisible}
                    selfDocumentId={currentDemand.id}
                    renderBriefActions={(doc) => (
                      <WarehouseTraceBriefPrimaryActions
                        doc={doc}
                        t={t}
                        navigate={navigate}
                        closeDrawer={() => {
                          setDrawerVisible(false);
                        }}
                      />
                    )}
                  />
                ) : null}
              </div>
            </DetailDrawerSection>

            <DetailDrawerSection title="明细信息">
              <style>{`
                .demand-detail-items .ant-table-wrapper .ant-table-body,
                .demand-detail-items .ant-table-wrapper .ant-table-content {
                  overflow: visible !important;
                }
                .demand-detail-items .ant-table-thead > tr > th {
                  white-space: nowrap !important;
                }
              `}</style>
              {currentDemand.items && currentDemand.items.length > 0 ? (
                <div
                  className="demand-detail-items"
                  style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', overflowY: 'hidden' }}
                >
                  <Table<DemandItem>
                    size="small"
                    tableLayout="fixed"
                    style={{ minWidth: 1100 }}
                    columns={[
                      { title: '物料编号', dataIndex: 'material_code', width: 120 },
                      { title: '物料名称', dataIndex: 'material_name', width: 150 },
                      { title: '物料规格', dataIndex: 'material_spec', width: 120 },
                      {
                        title: '属性',
                        dataIndex: 'variant_attributes',
                        width: 140,
                        ellipsis: true,
                        render: (v: Record<string, unknown> | string | undefined) => {
                          if (v == null) return '-';
                          if (typeof v === 'string') return v || '-';
                          return Object.keys(v).length > 0 ? JSON.stringify(v) : '-';
                        },
                      },
                      {
                        title: '单位',
                        dataIndex: 'material_unit',
                        width: 80,
                        render: (v: string) => getDictLabel(dictLabelMap, 'MATERIAL_UNIT', v) || v || '-',
                      },
                      { title: '需求数量', dataIndex: 'required_quantity', width: 100, align: 'right' as const },
                      ...(currentDemand.demand_type === 'sales_forecast'
                        ? [
                            { title: '预测日期', dataIndex: 'forecast_date', width: 120 },
                            { title: '预测月份', dataIndex: 'forecast_month', width: 100 },
                          ]
                        : [
                            { title: '交货日期', dataIndex: 'delivery_date', width: 120 },
                            { title: '已交货数量', dataIndex: 'delivered_quantity', width: 100, align: 'right' as const },
                            { title: '剩余数量', dataIndex: 'remaining_quantity', width: 100, align: 'right' as const },
                          ]),
                    ]}
                    dataSource={currentDemand.items}
                    pagination={false}
                    bordered
                    rowKey="id"
                  />
                </div>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无明细" />
              )}
            </DetailDrawerSection>

            <DetailDrawerSection title="操作记录">
              <Tabs
                tabPosition="left"
                size="small"
                style={{ minHeight: 120 }}
                items={[
                  {
                    key: 'timeline',
                    label: '操作记录',
                    children: (
                      <div style={{ paddingLeft: 8, minHeight: 80 }}>
                        {demandTracking.loading && <Spin size="small" />}
                        {demandTracking.error && <Typography.Text type="danger">{demandTracking.error}</Typography.Text>}
                        {demandTracking.data && <DocumentTrackingTimelineBody data={demandTracking.data} />}
                      </div>
                    ),
                  },
                  {
                    key: 'recalc',
                    label: '重算历史',
                    children: (
                      <div style={{ paddingLeft: 8, overflowX: 'auto' }}>
                        <Table<DemandRecalcHistoryItem>
                          size="small"
                          loading={recalcHistoryLoading}
                          dataSource={recalcHistory}
                          rowKey="id"
                          columns={[
                            { title: '操作时间', dataIndex: 'recalc_at', width: 180, render: (val) => formatDateTime(val) },
                            {
                              title: '触发方式',
                              dataIndex: 'trigger_type',
                              width: 100,
                              render: (v) => (v === 'upstream_change' ? '上游变更' : v === 'manual' ? '手动触发' : v || '-'),
                            },
                            {
                              title: '数据来源',
                              dataIndex: 'source_type',
                              width: 100,
                              render: (v) => (v === 'sales_order' ? '销售订单' : v === 'sales_forecast' ? '销售预测' : v || '-'),
                            },
                            { title: '变更说明', dataIndex: 'trigger_reason', ellipsis: true, render: (v) => v || '-' },
                            {
                              title: '执行结果',
                              dataIndex: 'result',
                              width: 90,
                              render: (v) => (v === 'success' ? '成功' : v === 'failed' ? '失败' : v || '-'),
                            },
                            { title: '说明', dataIndex: 'message', ellipsis: true, render: (v) => v || '-' },
                          ]}
                          pagination={false}
                        />
                      </div>
                    ),
                  },
                  {
                    key: 'snapshots',
                    label: '变更快照',
                    children: (
                      <div style={{ paddingLeft: 8, overflowX: 'auto' }}>
                        <Table<DemandSnapshotItem>
                          size="small"
                          loading={snapshotsLoading}
                          dataSource={snapshots}
                          rowKey="id"
                          expandable={{
                            expandedRowRender: (record) => (
                              <div style={{ padding: 8 }}>
                                {record.demand_snapshot && (
                                  <div style={{ marginBottom: 12 }}>
                                    <strong>变更前需求数据：</strong>
                                    <pre style={{ margin: '4px 0 0', fontSize: 12, maxHeight: 200, overflow: 'auto' }}>
                                      {JSON.stringify(record.demand_snapshot, null, 2)}
                                    </pre>
                                  </div>
                                )}
                                {record.demand_items_snapshot && record.demand_items_snapshot.length > 0 && (
                                  <>
                                    <strong>变更前明细数据：</strong>
                                    <pre style={{ margin: '4px 0 0', fontSize: 12, maxHeight: 200, overflow: 'auto' }}>
                                      {JSON.stringify(record.demand_items_snapshot, null, 2)}
                                    </pre>
                                  </>
                                )}
                                {!record.demand_snapshot && (!record.demand_items_snapshot || record.demand_items_snapshot.length === 0) && (
                                  <span style={{ color: '#999' }}>暂无详细数据</span>
                                )}
                              </div>
                            ),
                          }}
                          columns={[
                            { title: '记录时间', dataIndex: 'snapshot_at', width: 180, render: (val) => formatDateTime(val) },
                            {
                              title: '变更类型',
                              dataIndex: 'snapshot_type',
                              width: 100,
                              render: (v) => (v === 'before_recalc' ? '重算前' : v || '-'),
                            },
                            {
                              title: '变更说明',
                              dataIndex: 'trigger_reason',
                              ellipsis: true,
                              render: (v) => {
                                if (!v) return '-';
                                if (v.includes('sales_order')) return '销售订单变更';
                                if (v.includes('sales_forecast')) return '销售预测变更';
                                return v;
                              },
                            },
                          ]}
                          pagination={false}
                        />
                      </div>
                    ),
                  },
                ]}
              />
            </DetailDrawerSection>
          </div>
        )}
      </DetailDrawerTemplate>
    </>
  );
};

export default DemandManagementPage;

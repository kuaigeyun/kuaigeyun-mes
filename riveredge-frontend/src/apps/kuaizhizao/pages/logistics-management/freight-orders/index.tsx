import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  App,
  Button,
  Col,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Table,
} from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { rowActionKind } from '../../../../../components/uni-action';
import {
  DetailDrawerActions,
  FormModalTemplate,
  ListPageTemplate,
  MODAL_CONFIG,
} from '../../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { FreightOrderDetailDrawer } from './components/FreightOrderDetailDrawer';
import { UniTable } from '../../../../../components/uni-table';
import {
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
  UniTableStackedPrimaryCell,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { SourceDocumentCode } from '../../../../../components/linked-document-code/SourceDocumentCode';
import {
  UNI_PULL_QUERY_MAX_FETCH_LIMIT,
  UniPullQueryModal,
  paginatePullRows,
  useUniPullQuery,
} from '../../../../../components/uni-pull-query';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { alignProColumns } from '../../sales-management/shared/documentFieldAlignment';
import { formatDateTimeBySiteSetting } from '../../../../../utils/format';
import {
  renderFreightOrderStatusTag,
  renderFreightPullableTag,
  renderLogisticsBusinessDirectionTag,
  renderLogisticsTransportModeTag,
} from '../shared/logisticsListPresentation';
import {
  arriveFreightOrder,
  createFreightOrder,
  updateFreightOrder,
  deleteFreightOrder,
  dispatchFreightOrder,
  getFreightOrder,
  listFreightOrders,
  listFreightPullCandidates,
  markFreightOrderInTransit,
  shipFreightOrder,
  signFreightOrder,
  type FreightOrder,
  type FreightPullCandidate,
} from '../../../services/logistics';
import { getAntdModal } from '../../../../../utils/antdAppApis';
import { buildLogisticsTrackingUrl } from '../tracking/logisticsTrackingDeepLink';
import { CarrierSelectDropdown } from '../shared/CarrierSelectDropdown';
import { DriverSelectDropdown } from '../shared/DriverSelectDropdown';
import { VehicleSelectDropdown } from '../shared/VehicleSelectDropdown';

function freightPullRowKey(row: FreightPullCandidate): string {
  return `${row.source_type}-${row.source_id}`;
}

function isFreightPullRowDisabled(row: FreightPullCandidate): boolean {
  return row.pullable === false;
}

function canEditFreightOrder(status?: string | null): boolean {
  return status === 'draft' || status === 'scheduled';
}

function freightOrderPartnerName(row: FreightOrder): string {
  const names = [...new Set(
    (row.sources ?? [])
      .map((src) => String(src.partner_name ?? '').trim())
      .filter(Boolean),
  )];
  return names.join(' ') || '-';
}

const FreightOrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const perms = useResourcePermissions('kuaizhizao:freight-order');
  const actionRef = useRef<ActionType>();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<FreightOrder | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<FreightOrder | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRetryIdRef = useRef<number | null>(null);
  const [selectedSources, setSelectedSources] = useState<FreightPullCandidate[]>([]);
  const pendingCreateSourcesRef = useRef<FreightPullCandidate[] | null>(null);
  const [signForm] = Form.useForm();

  const openCreateFromSources = useCallback(async (rows: FreightPullCandidate[]) => {
    setEditingOrder(null);
    setSelectedSources(rows);
    setCreateOpen(true);
  }, []);

  const createInitialValues = useMemo(
    () => ({
      transport_mode: 'external_carrier',
      business_direction: selectedSources[0]?.business_direction || 'sales_outbound',
      destination_address: selectedSources.find((row) => row.address)?.address,
      tracking_number: selectedSources.find((row) => row.tracking_number)?.tracking_number,
      sender_phone: selectedSources.find((row) => row.sender_phone)?.sender_phone,
      recipient_phone: selectedSources.find((row) => row.recipient_phone)?.recipient_phone,
    }),
    [selectedSources],
  );

  const formInitialValues = useMemo(() => {
    if (!editingOrder) return createInitialValues;
    return {
      transport_mode: editingOrder.transport_mode || 'external_carrier',
      business_direction: editingOrder.business_direction,
      carrier_id: editingOrder.carrier_id,
      vehicle_id: editingOrder.vehicle_id,
      driver_id: editingOrder.driver_id,
      tracking_number: editingOrder.tracking_number,
      sender_phone: editingOrder.sender_phone,
      recipient_phone: editingOrder.recipient_phone,
      origin_address: editingOrder.origin_address,
      destination_address: editingOrder.destination_address,
    };
  }, [createInitialValues, editingOrder]);

  const pullScopeOptions = useMemo(
    () => [
      { label: t('app.kuaizhizao.logistics.option.direction.salesOutbound'), value: 'sales_outbound' },
      { label: t('app.kuaizhizao.logistics.option.direction.purchaseInbound'), value: 'purchase_inbound' },
      { label: t('components.uniPullQuery.scopeAll'), value: 'all' },
    ],
    [t],
  );

  const pullFromSourceQuery = useUniPullQuery<FreightPullCandidate>({
    rowKey: freightPullRowKey,
    selectionType: 'checkbox',
    scopeOptions: pullScopeOptions,
    defaultScope: 'sales_outbound',
    loadData: async ({ keyword, page, pageSize, scope }) => {
      const res = await listFreightPullCandidates({
        keyword: keyword.trim() || undefined,
        business_direction: scope && scope !== 'all' ? scope : undefined,
        skip: 0,
        limit: UNI_PULL_QUERY_MAX_FETCH_LIMIT,
      });
      return paginatePullRows(res.items ?? [], page, pageSize);
    },
    onConfirm: async (_keys, rows) => {
      const confirmed = rows;
      if (!confirmed.length) {
        messageApi.warning(t('app.kuaizhizao.logistics.message.selectSource'));
        return;
      }
      const blocked = confirmed.filter(isFreightPullRowDisabled);
      if (blocked.length) {
        messageApi.warning(t('app.kuaizhizao.logistics.message.sourceAlreadyLinked'));
        return;
      }
      const directions = [...new Set(confirmed.map((row) => row.business_direction).filter(Boolean))];
      if (directions.length > 1) {
        messageApi.warning(t('app.kuaizhizao.logistics.message.mixedDirection'));
        return;
      }
      pendingCreateSourcesRef.current = confirmed;
      pullFromSourceQuery.closeModal();
    },
  });

  const loadDetail = useCallback(async (id: number) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      setDetail(await getFreightOrder(id));
    } catch (error) {
      const msg = getApiErrorMessage(error, t('app.kuaizhizao.logistics.message.loadDetailFailed'));
      setDetail(null);
      setDetailError(msg);
    } finally {
      setDetailLoading(false);
    }
  }, [t]);

  const openDetail = (row: FreightOrder) => {
    detailRetryIdRef.current = row.id;
    setDetailOpen(true);
    setDetail(null);
    setDetailError(null);
    void loadDetail(row.id);
  };

  const closeFormModal = () => {
    setCreateOpen(false);
    setEditingOrder(null);
    setSelectedSources([]);
  };

  const openEdit = useCallback(
    async (row: FreightOrder) => {
      try {
        const full = await getFreightOrder(row.id);
        if (!canEditFreightOrder(full.status)) {
          messageApi.warning(t('app.kuaizhizao.logistics.message.editOnlyDraftOrScheduled'));
          return;
        }
        setEditingOrder(full);
        setSelectedSources(
          (full.sources ?? []).map((src) => ({
            source_type: src.source_type,
            source_id: src.source_id,
            source_code: src.source_code,
            partner_name: src.partner_name || '',
            business_direction: full.business_direction,
            pullable: true,
          })),
        );
        setCreateOpen(true);
      } catch (error) {
        messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.logistics.message.loadDetailFailed')));
      }
    },
    [messageApi, t],
  );

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (editingOrder) {
      try {
        const next = await updateFreightOrder(editingOrder.id, {
          transport_mode: values.transport_mode,
          carrier_id: values.carrier_id,
          vehicle_id: values.vehicle_id,
          driver_id: values.driver_id,
          tracking_number: values.tracking_number,
          sender_phone: values.sender_phone,
          recipient_phone: values.recipient_phone,
          origin_address: values.origin_address,
          destination_address: values.destination_address,
        });
        messageApi.success(t('common.updateSuccess'));
        closeFormModal();
        actionRef.current?.reload();
        if (detail?.id === next.id) {
          setDetail(next);
        }
      } catch (error) {
        messageApi.error(getApiErrorMessage(error, t('common.updateFailed')));
        throw error;
      }
      return;
    }
    if (!selectedSources.length) {
      messageApi.warning(t('app.kuaizhizao.logistics.message.selectSource'));
      throw new Error(t('app.kuaizhizao.logistics.message.selectSource'));
    }
    try {
      await createFreightOrder({
        ...values,
        sources: selectedSources.map((item) => ({
          source_type: item.source_type,
          source_id: item.source_id,
          source_code: item.source_code,
          partner_name: item.partner_name,
        })),
      });
      messageApi.success(t('common.createSuccess'));
      closeFormModal();
      actionRef.current?.reload();
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, t('common.createFailed')));
      throw error;
    }
  };

  const refreshDetail = async (id: number) => {
    const data = await getFreightOrder(id);
    setDetail(data);
    actionRef.current?.reload();
  };

  const runStatusAction = async (action: () => Promise<FreightOrder>) => {
    try {
      const next = await action();
      setDetail(next);
      actionRef.current?.reload();
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, t('common.operationFailed')));
    }
  };

  const sourceColumns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.logistics.field.sourceCode'),
        dataIndex: 'source_code',
        width: 168,
        ellipsis: true,
        render: (_: unknown, row: FreightPullCandidate) => (
          <SourceDocumentCode
            sourceType={row.source_type}
            sourceId={row.source_id}
            sourceCode={row.source_code}
          />
        ),
      },
      {
        title: t('app.kuaizhizao.logistics.field.partnerName'),
        dataIndex: 'partner_name',
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.logistics.field.businessDirection'),
        dataIndex: 'business_direction',
        width: 100,
        ellipsis: true,
        render: (_: unknown, row: FreightPullCandidate) =>
          renderLogisticsBusinessDirectionTag(t, row.business_direction),
      },
      {
        title: t('app.kuaizhizao.logistics.field.pullStatus'),
        width: 112,
        ellipsis: true,
        render: (_: unknown, row: FreightPullCandidate) => renderFreightPullableTag(t, row),
      },
    ],
    [t],
  );

  const columns: ProColumns<FreightOrder>[] = useMemo(
    () =>
      alignProColumns<FreightOrder>([
        {
          title: t('app.kuaizhizao.logistics.field.orderCode'),
          dataIndex: 'order_code',
          ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
          fixed: 'left',
          render: (_, row) => (
            <UniTableStackedPrimaryCell
              primary={String(row.order_code ?? '').trim() || '-'}
              secondary={String(row.tracking_number ?? '').trim() || '-'}
              secondaryCopyable={Boolean(String(row.tracking_number ?? '').trim())}
            />
          ),
        },
        {
          title: t('app.kuaizhizao.logistics.field.trackingNumber'),
          dataIndex: 'tracking_number',
          hideInTable: true,
        },
        {
          title: t('app.kuaizhizao.logistics.field.sourceCode'),
          dataIndex: 'source_code',
          width: 180,
          minWidth: 180,
          ellipsis: true,
          render: (_, row) => {
            const sources = row.sources ?? [];
            if (!sources.length) return '-';
            return (
              <Space orientation="vertical" size={0}>
                {sources.map((src) => (
                  <SourceDocumentCode
                    key={`${src.source_type}-${src.source_id}`}
                    sourceType={src.source_type}
                    sourceId={src.source_id}
                    sourceCode={src.source_code}
                  />
                ))}
              </Space>
            );
          },
        },
        {
          title: t('app.kuaizhizao.logistics.field.partnerName'),
          key: 'partnerName',
          dataIndex: 'partner_name',
          width: 140,
          minWidth: 140,
          uniTableKeepWidth: true,
          resizable: false,
          ellipsis: true,
          render: (_, row) => freightOrderPartnerName(row),
        },
        {
          title: t('app.kuaizhizao.logistics.field.businessDirection'),
          dataIndex: 'business_direction',
          width: 110,
          minWidth: 110,
          uniTableKeepWidth: true,
          resizable: false,
          render: (_, row) => renderLogisticsBusinessDirectionTag(t, row.business_direction),
        },
        {
          title: t('app.kuaizhizao.logistics.field.transportMode'),
          dataIndex: 'transport_mode',
          width: 96,
          minWidth: 96,
          uniTableKeepWidth: true,
          resizable: false,
          render: (_, row) => renderLogisticsTransportModeTag(t, row.transport_mode),
        },
        {
          title: t('app.kuaizhizao.logistics.field.carrierName'),
          dataIndex: 'carrier_name',
          width: 140,
          minWidth: 140,
          uniTableKeepWidth: true,
          resizable: false,
          ellipsis: true,
          render: (_, row) => row.carrier_name || '-',
        },
        {
          title: t('app.kuaizhizao.logistics.field.vehicleDriver'),
          key: 'logistics_vehicle_driver_stacked',
          dataIndex: 'vehicle_plate',
          width: 140,
          minWidth: 140,
          uniTableKeepWidth: true,
          resizable: false,
          render: (_, row) => (
            <UniTableStackedPrimaryCell
              primary={String(row.vehicle_plate ?? '').trim() || '-'}
              secondary={String(row.driver_name ?? '').trim() || '-'}
              primaryBold={false}
            />
          ),
        },
        {
          title: t('app.kuaizhizao.logistics.field.route'),
          key: 'freight_route_stacked',
          dataIndex: 'origin_address',
          width: 200,
          minWidth: 200,
          ellipsis: true,
          render: (_, row) => (
            <UniTableStackedPrimaryCell
              primary={String(row.origin_address ?? '').trim() || '-'}
              secondary={String(row.destination_address ?? '').trim() || '-'}
              primaryBold={false}
            />
          ),
        },
        {
          title: t('app.kuaizhizao.logistics.field.plannedSchedule'),
          key: 'planned_depart_at',
          dataIndex: 'planned_depart_at',
          width: 168,
          minWidth: 168,
          uniTableKeepWidth: true,
          resizable: false,
          render: (_, row) => (
            <UniTableStackedPrimaryCell
              primary={formatDateTimeBySiteSetting(row.planned_depart_at)}
              secondary={formatDateTimeBySiteSetting(row.planned_arrive_at)}
              primaryBold={false}
            />
          ),
        },
        {
          title: t('app.kuaizhizao.logistics.field.status'),
          key: 'lifecycle',
          dataIndex: 'status',
          fixed: 'right',
          hideInSearch: true,
          render: (_, row) => renderFreightOrderStatusTag(t, row.status),
        },
        {
          title: t('common.action'),
          key: 'action',
          valueType: 'option',
          fixed: 'right',
          hideInSearch: true,
          render: (_, row) => {
            const nodes: React.ReactNode[] = [];
            if (perms.canRead) {
              nodes.push(
                <Button key="detail" {...rowActionKind('read')} type="link" size="small" onClick={() => openDetail(row)}>
                  {t('common.detail')}
                </Button>,
              );
            }
            if (perms.canUpdate && canEditFreightOrder(row.status)) {
              nodes.push(
                <Button
                  key="edit"
                  {...rowActionKind('update')}
                  type="link"
                  size="small"
                  onClick={() => void openEdit(row)}
                >
                  {t('common.edit')}
                </Button>,
              );
            }
            return nodes;
          },
        },
      ]),
    [openEdit, perms.canRead, perms.canUpdate, t],
  );

  return (
    <ListPageTemplate>
      <UniTable<FreightOrder>
        actionRef={actionRef}
        columns={columns}
        columnPersistenceId="apps.kuaizhizao.pages.logistics-management.freight-orders.v3"
        rowKey="id"
        request={async (params) => {
          const res = await listFreightOrders({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize,
            keyword: params.keyword as string | undefined,
          });
          return { data: res.items, total: res.total, success: true };
        }}
        showCreateButton={perms.canCreate}
        createButtonText={t('app.kuaizhizao.logistics.action.createFreightOrder')}
        onCreate={pullFromSourceQuery.openModal}
        enableRowSelection={perms.canDelete}
        showDeleteButton={perms.canDelete}
        onDelete={async (keys) => {
          await Promise.all(keys.map((key) => deleteFreightOrder(Number(key))));
          messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
          actionRef.current?.reload();
        }}
      />

      <UniPullQueryModal<FreightPullCandidate>
        open={pullFromSourceQuery.open}
        title={t('app.kuaizhizao.logistics.action.pullSelectSource')}
        onCancel={pullFromSourceQuery.closeModal}
        onOk={pullFromSourceQuery.handleConfirm}
        rowKey={freightPullRowKey}
        columns={sourceColumns}
        dataSource={pullFromSourceQuery.dataSource}
        loading={pullFromSourceQuery.loading}
        confirmLoading={pullFromSourceQuery.confirmLoading}
        selectionType={pullFromSourceQuery.selectionType}
        selectedRowKeys={pullFromSourceQuery.selectedRowKeys}
        selectedRows={pullFromSourceQuery.selectedRows}
        getRowLabel={(row) => String(row.source_code ?? '').trim()}
        onSelectedRowKeysChange={pullFromSourceQuery.handleSelectedRowKeysChange}
        searchDraft={pullFromSourceQuery.searchDraft}
        onSearchDraftChange={pullFromSourceQuery.setSearchDraft}
        onSearchApply={pullFromSourceQuery.handleSearchApply}
        onSearchClear={pullFromSourceQuery.handleSearchClear}
        appliedKeyword={pullFromSourceQuery.appliedKeyword}
        searchPlaceholder={t('components.uniPullQuery.searchPlaceholder')}
        page={pullFromSourceQuery.page}
        pageSize={pullFromSourceQuery.pageSize}
        total={pullFromSourceQuery.total}
        onPageChange={pullFromSourceQuery.handlePageChange}
        scopeOptions={pullFromSourceQuery.scopeOptions}
        scope={pullFromSourceQuery.scope}
        onScopeChange={pullFromSourceQuery.handleScopeChange}
        isRowDisabled={isFreightPullRowDisabled}
        okText={t('common.next')}
        afterOpenChange={(open) => {
          if (open) return;
          const rows = pendingCreateSourcesRef.current;
          if (!rows?.length) return;
          pendingCreateSourcesRef.current = null;
          void openCreateFromSources(rows);
        }}
      />

      <FormModalTemplate
        title={
          editingOrder
            ? t('app.kuaizhizao.logistics.action.editFreightOrder')
            : t('app.kuaizhizao.logistics.action.createFreightOrder')
        }
        open={createOpen}
        isEdit={Boolean(editingOrder)}
        grid={false}
        key={editingOrder ? `edit-${editingOrder.id}` : 'create'}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        initialValues={formInitialValues}
        onClose={closeFormModal}
        onFinish={handleSubmit}
      >
        <Table<FreightPullCandidate>
          size="small"
          rowKey={freightPullRowKey}
          dataSource={selectedSources}
          pagination={false}
          style={{ width: '100%', margin: 0, marginBottom: 16 }}
          columns={sourceColumns.slice(0, 3)}
          title={() => t('app.kuaizhizao.logistics.field.selectedSources')}
        />
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="business_direction" label={t('app.kuaizhizao.logistics.field.businessDirection')} rules={[{ required: true }]}>
              <Select
                disabled={Boolean(editingOrder)}
                options={[
                  { label: t('app.kuaizhizao.logistics.option.direction.salesOutbound'), value: 'sales_outbound' },
                  { label: t('app.kuaizhizao.logistics.option.direction.purchaseInbound'), value: 'purchase_inbound' },
                ]}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="transport_mode" label={t('app.kuaizhizao.logistics.field.transportMode')}>
              <Select
                options={[
                  { label: t('app.kuaizhizao.logistics.option.transportMode.ownVehicle'), value: 'own_vehicle' },
                  { label: t('app.kuaizhizao.logistics.option.transportMode.externalCarrier'), value: 'external_carrier' },
                  { label: t('app.kuaizhizao.logistics.option.transportMode.express'), value: 'express' },
                ]}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="carrier_id" label={t('app.kuaizhizao.logistics.field.carrierName')}>
              <CarrierSelectDropdown />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="vehicle_id" label={t('app.kuaizhizao.logistics.field.plateNumber')}>
              <VehicleSelectDropdown />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="driver_id" label={t('app.kuaizhizao.logistics.field.driverName')}>
              <DriverSelectDropdown />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="tracking_number" label={t('app.kuaizhizao.logistics.field.trackingNumber')}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="origin_address" label={t('app.kuaizhizao.logistics.field.originAddress')}>
              <Input.TextArea rows={2} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="destination_address" label={t('app.kuaizhizao.logistics.field.destinationAddress')}>
              <Input.TextArea rows={2} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="sender_phone" label={t('app.kuaizhizao.logistics.field.senderPhone')}>
              <Input allowClear />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="recipient_phone" label={t('app.kuaizhizao.logistics.field.recipientPhone')}>
              <Input allowClear />
            </Form.Item>
          </Col>
        </Row>
      </FormModalTemplate>

      <FreightOrderDetailDrawer
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetail(null);
          setDetailError(null);
        }}
        order={detail}
        loading={detailLoading}
        error={detailError}
        onRetry={() => {
          const id = detailRetryIdRef.current;
          if (id != null) void loadDetail(id);
        }}
        extra={
          detail ? (
            <DetailDrawerActions
              items={[
                {
                  key: 'edit',
                  visible: Boolean(perms.canUpdate && canEditFreightOrder(detail.status)),
                  render: (
                    <Button onClick={() => void openEdit(detail)}>
                      {t('common.edit')}
                    </Button>
                  ),
                },
                {
                  key: 'tracking',
                  visible: true,
                  render: (
                    <Button
                      onClick={() => {
                        navigate(buildLogisticsTrackingUrl({ id: detail.id, uuid: detail.uuid }));
                      }}
                    >
                      {t('app.kuaizhizao.logistics.action.openTracking')}
                    </Button>
                  ),
                },
                ...(perms.canUpdate
                  ? [
                      {
                        key: 'dispatch',
                        visible: detail.status === 'draft',
                        render: (
                          <Button onClick={() => void runStatusAction(() => dispatchFreightOrder(detail.id))}>
                            {t('app.kuaizhizao.logistics.action.dispatch')}
                          </Button>
                        ),
                      },
                      {
                        key: 'ship',
                        visible: detail.status === 'scheduled',
                        render: (
                          <Button onClick={() => void runStatusAction(() => shipFreightOrder(detail.id))}>
                            {t('app.kuaizhizao.logistics.action.ship')}
                          </Button>
                        ),
                      },
                      {
                        key: 'inTransit',
                        visible: detail.status === 'shipped',
                        render: (
                          <Button onClick={() => void runStatusAction(() => markFreightOrderInTransit(detail.id))}>
                            {t('app.kuaizhizao.logistics.action.markInTransit')}
                          </Button>
                        ),
                      },
                      {
                        key: 'arrive',
                        visible: detail.status === 'in_transit',
                        render: (
                          <Button onClick={() => void runStatusAction(() => arriveFreightOrder(detail.id))}>
                            {t('app.kuaizhizao.logistics.action.arrive')}
                          </Button>
                        ),
                      },
                      {
                        key: 'sign',
                        visible: detail.status === 'arrived',
                        render: (
                          <Button
                            type="primary"
                            onClick={() => {
                              signForm.resetFields();
                              getAntdModal().confirm({
                                title: t('app.kuaizhizao.logistics.action.signReceipt'),
                                content: (
                                  <Form form={signForm} layout="vertical">
                                    <Form.Item
                                      name="signed_by"
                                      label={t('app.kuaizhizao.logistics.field.signedBy')}
                                      rules={[{ required: true }]}
                                    >
                                      <Input />
                                    </Form.Item>
                                    <Form.Item
                                      name="receipt_result"
                                      label={t('app.kuaizhizao.logistics.field.receiptResult')}
                                      initialValue="full"
                                    >
                                      <Select
                                        options={[
                                          { label: t('app.kuaizhizao.logistics.option.receiptResult.full'), value: 'full' },
                                          {
                                            label: t('app.kuaizhizao.logistics.option.receiptResult.partial'),
                                            value: 'partial',
                                          },
                                          { label: t('app.kuaizhizao.logistics.option.receiptResult.reject'), value: 'reject' },
                                        ]}
                                      />
                                    </Form.Item>
                                  </Form>
                                ),
                                onOk: async () => {
                                  const values = await signForm.validateFields();
                                  await signFreightOrder(detail.id, values);
                                  await refreshDetail(detail.id);
                                },
                              });
                            }}
                          >
                            {t('app.kuaizhizao.logistics.action.signReceipt')}
                          </Button>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          ) : null
        }
      />
    </ListPageTemplate>
  );
};

export default FreightOrdersPage;

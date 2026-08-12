import React, { useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  Button,
  Drawer,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Timeline,
  message,
} from 'antd';
import { useTranslation } from 'react-i18next';
import { rowActionKind } from '../../../../../components/uni-action';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import {
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
  UniTableStackedPrimaryCell,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { SourceDocumentCode } from '../../../../../components/linked-document-code/SourceDocumentCode';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { formatDateTimeBySiteSetting } from '../../../../../utils/format';
import { alignProColumns } from '../../sales-management/shared/documentFieldAlignment';
import {
  freightOrderStatusLabel,
  renderFreightOrderStatusTag,
  renderLogisticsBusinessDirectionTag,
} from '../shared/logisticsListPresentation';
import {
  arriveFreightOrder,
  createFreightOrder,
  deleteFreightOrder,
  dispatchFreightOrder,
  getFreightOrder,
  listCarriers,
  listDrivers,
  listFreightOrders,
  listFreightPullCandidates,
  listVehicles,
  shipFreightOrder,
  signFreightOrder,
  type FreightOrder,
  type FreightPullCandidate,
} from '../../../services/logistics';

const FreightOrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const perms = useResourcePermissions('kuaizhizao:freight-order');
  const actionRef = useRef<ActionType>();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<FreightOrder | null>(null);
  const [candidates, setCandidates] = useState<FreightPullCandidate[]>([]);
  const [selectedSources, setSelectedSources] = useState<FreightPullCandidate[]>([]);
  const [form] = Form.useForm();
  const [signForm] = Form.useForm();
  const [carriers, setCarriers] = useState<{ label: string; value: number }[]>([]);
  const [vehicles, setVehicles] = useState<{ label: string; value: number }[]>([]);
  const [drivers, setDrivers] = useState<{ label: string; value: number }[]>([]);

  const loadMasterOptions = async () => {
    const [carrierRes, vehicleRes, driverRes] = await Promise.all([
      listCarriers({ limit: 200 }),
      listVehicles({ limit: 200 }),
      listDrivers({ limit: 200 }),
    ]);
    setCarriers(carrierRes.items.map((item) => ({ label: item.name, value: item.id })));
    setVehicles(vehicleRes.items.map((item) => ({ label: item.plate_number, value: item.id })));
    setDrivers(driverRes.items.map((item) => ({ label: item.name, value: item.id })));
  };

  const openCreate = async () => {
    await loadMasterOptions();
    const res = await listFreightPullCandidates({ limit: 100 });
    setCandidates(res.items);
    setSelectedSources([]);
    form.resetFields();
    form.setFieldsValue({ transport_mode: 'external_carrier', business_direction: 'sales_outbound' });
    setCreateOpen(true);
  };

  const openDetail = async (row: FreightOrder) => {
    const data = await getFreightOrder(row.id);
    setDetail(data);
    setDetailOpen(true);
  };

  const handleCreate = async () => {
    const values = await form.validateFields();
    if (!selectedSources.length) {
      message.warning(t('app.kuaizhizao.logistics.message.selectSource'));
      return;
    }
    await createFreightOrder({
      ...values,
      sources: selectedSources.map((item) => ({
        source_type: item.source_type,
        source_id: item.source_id,
        source_code: item.source_code,
        partner_name: item.partner_name,
      })),
    });
    message.success(t('common.createSuccess'));
    setCreateOpen(false);
    actionRef.current?.reload();
  };

  const refreshDetail = async (id: number) => {
    const data = await getFreightOrder(id);
    setDetail(data);
    actionRef.current?.reload();
  };

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
          title: t('app.kuaizhizao.logistics.field.businessDirection'),
          dataIndex: 'business_direction',
          width: 110,
          minWidth: 110,
          uniTableKeepWidth: true,
          resizable: false,
          render: (_, row) => renderLogisticsBusinessDirectionTag(t, row.business_direction),
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
          render: (_, row) => (
            <Button {...rowActionKind('read')} type="link" size="small" onClick={() => openDetail(row)}>
              {t('common.detail')}
            </Button>
          ),
        },
      ]),
    [t],
  );

  return (
    <ListPageTemplate>
      <UniTable<FreightOrder>
        actionRef={actionRef}
        columns={columns}
        columnPersistenceId="apps.kuaizhizao.pages.logistics-management.freight-orders.v1"
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
        onCreate={openCreate}
        enableRowSelection={perms.canDelete}
        showDeleteButton={perms.canDelete}
        onDelete={async (keys) => {
          await Promise.all(keys.map((key) => deleteFreightOrder(Number(key))));
          message.success(t('common.batchDeleteSuccess', { count: keys.length }));
          actionRef.current?.reload();
        }}
      />

      <Modal
        open={createOpen}
        width={880}
        title={t('app.kuaizhizao.logistics.action.createFreightOrder')}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="business_direction" label={t('app.kuaizhizao.logistics.field.businessDirection')} rules={[{ required: true }]}>
            <Select
              options={[
                { label: t('app.kuaizhizao.logistics.option.direction.salesOutbound'), value: 'sales_outbound' },
                { label: t('app.kuaizhizao.logistics.option.direction.purchaseInbound'), value: 'purchase_inbound' },
              ]}
            />
          </Form.Item>
          <Form.Item name="transport_mode" label={t('app.kuaizhizao.logistics.field.transportMode')}>
            <Select
              options={[
                { label: t('app.kuaizhizao.logistics.option.transportMode.ownVehicle'), value: 'own_vehicle' },
                { label: t('app.kuaizhizao.logistics.option.transportMode.externalCarrier'), value: 'external_carrier' },
                { label: t('app.kuaizhizao.logistics.option.transportMode.express'), value: 'express' },
              ]}
            />
          </Form.Item>
          <Form.Item name="carrier_id" label={t('app.kuaizhizao.logistics.field.carrierName')}>
            <Select allowClear options={carriers} />
          </Form.Item>
          <Form.Item name="vehicle_id" label={t('app.kuaizhizao.logistics.field.plateNumber')}>
            <Select allowClear options={vehicles} />
          </Form.Item>
          <Form.Item name="driver_id" label={t('app.kuaizhizao.logistics.field.driverName')}>
            <Select allowClear options={drivers} />
          </Form.Item>
          <Form.Item name="tracking_number" label={t('app.kuaizhizao.logistics.field.trackingNumber')}>
            <Input />
          </Form.Item>
          <Form.Item name="origin_address" label={t('app.kuaizhizao.logistics.field.originAddress')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="destination_address" label={t('app.kuaizhizao.logistics.field.destinationAddress')}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
        <Table<FreightPullCandidate>
          size="small"
          rowKey={(row) => `${row.source_type}-${row.source_id}`}
          dataSource={candidates}
          pagination={false}
          rowSelection={{
            selectedRowKeys: selectedSources.map((item) => `${item.source_type}-${item.source_id}`),
            onChange: (_, rows) => setSelectedSources(rows),
          }}
          columns={[
            {
              title: t('app.kuaizhizao.logistics.field.sourceCode'),
              dataIndex: 'source_code',
              render: (_, row) => (
                <SourceDocumentCode
                  sourceType={row.source_type}
                  sourceId={row.source_id}
                  sourceCode={row.source_code}
                />
              ),
            },
            { title: t('app.kuaizhizao.logistics.field.partnerName'), dataIndex: 'partner_name' },
            { title: t('app.kuaizhizao.logistics.field.businessDirection'), dataIndex: 'business_direction' },
          ]}
        />
      </Modal>

      <Drawer
        open={detailOpen}
        width={720}
        title={detail?.order_code}
        onClose={() => setDetailOpen(false)}
        extra={
          detail && perms.canUpdate ? (
            <Space wrap>
              {detail.status === 'draft' ? (
                <Button onClick={() => dispatchFreightOrder(detail.id).then(() => refreshDetail(detail.id))}>
                  {t('app.kuaizhizao.logistics.action.dispatch')}
                </Button>
              ) : null}
              {detail.status === 'scheduled' ? (
                <Button onClick={() => shipFreightOrder(detail.id).then(() => refreshDetail(detail.id))}>
                  {t('app.kuaizhizao.logistics.action.ship')}
                </Button>
              ) : null}
              {detail.status === 'in_transit' ? (
                <Button onClick={() => arriveFreightOrder(detail.id).then(() => refreshDetail(detail.id))}>
                  {t('app.kuaizhizao.logistics.action.arrive')}
                </Button>
              ) : null}
              {detail.status === 'arrived' ? (
                <Button
                  type="primary"
                  onClick={() => {
                    signForm.resetFields();
                    Modal.confirm({
                      title: t('app.kuaizhizao.logistics.action.signReceipt'),
                      content: (
                        <Form form={signForm} layout="vertical">
                          <Form.Item name="signed_by" label={t('app.kuaizhizao.logistics.field.signedBy')} rules={[{ required: true }]}>
                            <Input />
                          </Form.Item>
                          <Form.Item name="receipt_result" label={t('app.kuaizhizao.logistics.field.receiptResult')} initialValue="full">
                            <Select
                              options={[
                                { label: t('app.kuaizhizao.logistics.option.receiptResult.full'), value: 'full' },
                                { label: t('app.kuaizhizao.logistics.option.receiptResult.partial'), value: 'partial' },
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
              ) : null}
            </Space>
          ) : null
        }
      >
        {detail ? (
          <>
            <p>
              {t('app.kuaizhizao.logistics.field.status')}: {freightOrderStatusLabel(t, detail.status)}
            </p>
            <p>{t('app.kuaizhizao.logistics.field.trackingNumber')}: {detail.tracking_number || '-'}</p>
            <Timeline
              items={(detail.tracking_events || []).map((event) => ({
                children: `${event.event_type} ${formatDateTimeBySiteSetting(event.event_time)} ${event.location || ''}`,
              }))}
            />
          </>
        ) : null}
      </Drawer>
    </ListPageTemplate>
  );
};

export default FreightOrdersPage;

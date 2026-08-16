import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  List,
  Select,
  Space,
  Typography,
  message,
} from 'antd';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import {
  addFreightTrackingEvent,
  deleteFreightTrackingEvent,
  getFreightOrder,
  getLogisticsMapConfig,
  listFreightOrders,
  trackLogistics,
  type AmapMapPublicConfig,
  type FreightOrder,
} from '../../../services/logistics';
import {
  renderFreightOrderStatusTag,
  renderLogisticsBusinessDirectionTag,
} from '../shared/logisticsListPresentation';
import { LogisticsTrackingMap } from './LogisticsTrackingMap';
import { TrackingDetailPanel } from './TrackingDetailPanel';

const DEFAULT_STATUS_IN = 'scheduled,shipped,in_transit,arrived';

const LogisticsTrackingPage: React.FC = () => {
  const { t } = useTranslation();
  const [messageApi, contextHolder] = message.useMessage();
  const [searchParams] = useSearchParams();
  const perms = useResourcePermissions('kuaizhizao:freight-order');

  const [filterForm] = Form.useForm();
  const [eventForm] = Form.useForm();

  const [mapConfig, setMapConfig] = useState<AmapMapPublicConfig | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [orders, setOrders] = useState<FreightOrder[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<FreightOrder | null>(null);
  const [externalEvents, setExternalEvents] = useState<{ label: string; time?: string }[]>([]);
  const [externalError, setExternalError] = useState<string | null>(null);
  const [externalLoading, setExternalLoading] = useState(false);
  const [queryPhone, setQueryPhone] = useState('');
  const [addingEvent, setAddingEvent] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState<number | null>(null);

  const canAddEvent = perms.canUpdate || perms.canAction?.('execute');

  const loadList = useCallback(async () => {
    const values = filterForm.getFieldsValue();
    setListLoading(true);
    try {
      const res = await listFreightOrders({
        skip: 0,
        limit: 100,
        keyword: values.keyword?.trim() || undefined,
        business_direction: values.business_direction || undefined,
        status_in: values.status_in?.length ? values.status_in.join(',') : DEFAULT_STATUS_IN,
      });
      setOrders(res.items ?? []);
      return res.items ?? [];
    } finally {
      setListLoading(false);
    }
  }, [filterForm]);

  const loadExternalTrack = useCallback(
    async (detail: FreightOrder, phone: string) => {
      if (detail.transport_mode !== 'express' || !detail.tracking_number) {
        setExternalEvents([]);
        setExternalError(null);
        return;
      }
      setExternalLoading(true);
      setExternalError(null);
      try {
        const track = await trackLogistics(detail.carrier_name || '', detail.tracking_number, phone);
        const external = (track.events ?? []).map((item) => ({
          label: item.description || item.status || t('app.kuaizhizao.logistics.tracking.externalNode'),
          time: item.time,
        }));
        setExternalEvents(external);
      } catch (error) {
        setExternalEvents([]);
        setExternalError(getApiErrorMessage(error, t('app.kuaizhizao.logistics.tracking.queryFailed')));
      } finally {
        setExternalLoading(false);
      }
    },
    [t],
  );

  const loadDetail = useCallback(
    async (id: number) => {
      setDetailLoading(true);
      setExternalEvents([]);
      setExternalError(null);
      try {
        const detail = await getFreightOrder(id);
        const phone = detail.query_phone?.trim() || '';
        setSelectedOrder(detail);
        setSelectedId(id);
        setQueryPhone(phone);
        await loadExternalTrack(detail, phone);
      } catch (error) {
        messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.logistics.message.loadDetailFailed')));
        setSelectedOrder(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [loadExternalTrack, messageApi, t],
  );

  const handleRefreshExternal = useCallback(async () => {
    if (!selectedOrder) return;
    await loadExternalTrack(selectedOrder, queryPhone);
  }, [loadExternalTrack, queryPhone, selectedOrder]);

  const resolveDeepLink = useCallback(async () => {
    const idParam = searchParams.get('id');
    const uuidParam = searchParams.get('uuid');
    if (idParam) {
      const id = Number(idParam);
      if (Number.isFinite(id) && id > 0) {
        await loadDetail(id);
        return;
      }
    }
    if (uuidParam) {
      const res = await listFreightOrders({ uuid: uuidParam.trim(), limit: 1 });
      const row = res.items?.[0];
      if (row?.id) {
        await loadDetail(row.id);
      }
    }
  }, [loadDetail, searchParams]);

  useEffect(() => {
    void getLogisticsMapConfig().then(setMapConfig).catch(() => setMapConfig({ configured: false }));
  }, []);

  useEffect(() => {
    void (async () => {
      await loadList();
      await resolveDeepLink();
    })();
  }, [loadList, resolveDeepLink]);

  const statusOptions = useMemo(
    () =>
      ['scheduled', 'shipped', 'in_transit', 'arrived', 'signed', 'draft', 'cancelled'].map((value) => ({
        label: t(`app.kuaizhizao.logistics.option.freightOrderStatus.${value}`),
        value,
      })),
    [t],
  );

  const directionOptions = useMemo(
    () => [
      { label: t('app.kuaizhizao.logistics.option.direction.salesOutbound'), value: 'sales_outbound' },
      { label: t('app.kuaizhizao.logistics.option.direction.purchaseInbound'), value: 'purchase_inbound' },
    ],
    [t],
  );

  const handleSearch = async () => {
    await loadList();
  };

  const handleSelectOrder = (row: FreightOrder) => {
    void loadDetail(row.id);
  };

  const handleAddEvent = async () => {
    if (!selectedOrder) return;
    const values = await eventForm.validateFields();
    setAddingEvent(true);
    try {
      const next = await addFreightTrackingEvent(selectedOrder.id, {
        event_type: values.event_type,
        location: values.location,
        remark: values.remark,
      });
      setSelectedOrder(next);
      eventForm.resetFields();
      messageApi.success(t('common.saveSuccess'));
      await loadList();
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, t('common.saveFailed')));
    } finally {
      setAddingEvent(false);
    }
  };

  const handleDeleteEvent = async (eventId: number) => {
    if (!selectedOrder) return;
    setDeletingEventId(eventId);
    try {
      const next = await deleteFreightTrackingEvent(selectedOrder.id, eventId);
      setSelectedOrder(next);
      messageApi.success(t('common.deleteSuccess'));
      await loadList();
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, t('common.deleteFailed')));
    } finally {
      setDeletingEventId(null);
    }
  };

  return (
    <ListPageTemplate fillMain>
      {contextHolder}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: 12 }}>
        <Card size="small" styles={{ body: { padding: 12 } }}>
          <Form form={filterForm} layout="inline" onFinish={handleSearch} initialValues={{ status_in: DEFAULT_STATUS_IN.split(',') }}>
            <Form.Item name="business_direction" label={t('app.kuaizhizao.logistics.field.businessDirection')}>
              <Select allowClear style={{ width: 140 }} options={directionOptions} />
            </Form.Item>
            <Form.Item name="status_in" label={t('app.kuaizhizao.logistics.field.status')}>
              <Select
                mode="multiple"
                allowClear
                style={{ minWidth: 220 }}
                options={statusOptions}
                maxTagCount="responsive"
              />
            </Form.Item>
            <Form.Item name="keyword" label={t('app.kuaizhizao.logistics.tracking.filterKeyword')}>
              <Input allowClear placeholder={t('app.kuaizhizao.logistics.tracking.filterKeywordPlaceholder')} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={listLoading}>
                {t('common.search')}
              </Button>
            </Form.Item>
          </Form>
        </Card>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: '260px minmax(0, 1fr) minmax(380px, 420px)',
            gap: 12,
          }}
        >
          <Card
            size="small"
            title={t('app.kuaizhizao.logistics.tracking.listTitle')}
            styles={{ body: { padding: 0, height: '100%' } }}
            style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              <List<FreightOrder>
                loading={listLoading}
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('common.noData')} /> }}
                dataSource={orders}
                rowKey="id"
                renderItem={(row) => {
                  const active = selectedId === row.id;
                  return (
                    <List.Item
                      onClick={() => handleSelectOrder(row)}
                      style={{
                        cursor: 'pointer',
                        paddingInline: 12,
                        background: active ? 'var(--ant-color-primary-bg)' : undefined,
                      }}
                    >
                      <List.Item.Meta
                        title={
                          <Space size={8} wrap>
                            <Typography.Text strong={active}>{row.order_code}</Typography.Text>
                            {renderFreightOrderStatusTag(t, row.status)}
                          </Space>
                        }
                        description={
                          <Space orientation="vertical" size={2}>
                            <Typography.Text type="secondary" ellipsis>
                              {row.carrier_name || '-'}
                              {row.tracking_number ? ` / ${row.tracking_number}` : ''}
                            </Typography.Text>
                            {renderLogisticsBusinessDirectionTag(t, row.business_direction)}
                          </Space>
                        }
                      />
                    </List.Item>
                  );
                }}
              />
            </div>
          </Card>

          <Card
            size="small"
            title={t('app.kuaizhizao.logistics.tracking.mapTitle')}
            styles={{ body: { padding: 0, height: '100%' } }}
            style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}
          >
            <LogisticsTrackingMap
              mapConfig={mapConfig}
              selectedOrder={selectedOrder}
              listOrders={orders}
              emptyHint={t('app.kuaizhizao.logistics.tracking.mapEmpty')}
              notConfiguredHint={t('app.kuaizhizao.logistics.tracking.mapNotConfigured')}
            />
          </Card>

          <Card
            size="small"
            title={t('app.kuaizhizao.logistics.tracking.detailTitle')}
            styles={{ body: { padding: 0, flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' } }}
            style={{ minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column' }}
          >
            <TrackingDetailPanel
              loading={detailLoading}
              order={selectedOrder}
              externalEvents={externalEvents}
              externalError={externalError}
              externalLoading={externalLoading}
              queryPhone={queryPhone}
              onQueryPhoneChange={setQueryPhone}
              onRefreshExternal={handleRefreshExternal}
              canAddEvent={Boolean(canAddEvent)}
              canDeleteEvent={Boolean(canAddEvent)}
              addingEvent={addingEvent}
              deletingEventId={deletingEventId}
              eventForm={eventForm}
              onAddEvent={handleAddEvent}
              onDeleteEvent={handleDeleteEvent}
            />
          </Card>
        </div>
      </div>
    </ListPageTemplate>
  );
};

export default LogisticsTrackingPage;

import React from 'react';
import { DeleteOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Collapse,
  Empty,
  Flex,
  Form,
  Input,
  Popconfirm,
  Select,
  Spin,
  Timeline,
  Typography,
  theme,
} from 'antd';
import type { FormInstance } from 'antd';
import { useTranslation } from 'react-i18next';
import { SourceDocumentCode } from '../../../../../components/linked-document-code';
import { formatDateTimeBySiteSetting } from '../../../../../utils/format';
import type { FreightOrder } from '../../../services/logistics';
import { logisticsTrackingEventLabel, renderFreightOrderStatusTag } from '../shared/logisticsListPresentation';

type ExternalEvent = { label: string; time?: string };

type TrackingDetailPanelProps = {
  loading: boolean;
  order: FreightOrder | null;
  externalEvents: ExternalEvent[];
  externalError?: string | null;
  externalLoading?: boolean;
  queryPhone: string;
  onQueryPhoneChange: (value: string) => void;
  onRefreshExternal: () => void | Promise<void>;
  canAddEvent: boolean;
  canDeleteEvent: boolean;
  addingEvent: boolean;
  deletingEventId?: number | null;
  eventForm: FormInstance;
  onAddEvent: () => void | Promise<void>;
  onDeleteEvent: (eventId: number) => void | Promise<void>;
};

const ADDRESS_MARK_SIZE = 22;
const ROW_LINE_HEIGHT = 22;

function AddressKindMark({ kind, title }: { kind: 'origin' | 'dest'; title: string }) {
  const { token } = theme.useToken();
  const isOrigin = kind === 'origin';
  return (
    <span
      title={title}
      aria-label={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: ADDRESS_MARK_SIZE,
        height: ADDRESS_MARK_SIZE,
        borderRadius: 4,
        fontSize: 13,
        fontWeight: 600,
        lineHeight: 1,
        color: token.colorTextLightSolid,
        background: isOrigin ? '#000' : token.colorPrimary,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {isOrigin ? '发' : '收'}
    </span>
  );
}

function DetailFieldList({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'max-content minmax(0, 1fr)',
        columnGap: 8,
        alignItems: 'start',
      }}
    >
      {children}
    </div>
  );
}

function DetailFieldRow({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-start',
          alignItems: 'center',
          minHeight: ROW_LINE_HEIGHT,
          paddingBlock: 4,
          color: 'var(--ant-color-text-secondary)',
          lineHeight: `${ROW_LINE_HEIGHT}px`,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </div>
      <div style={{ minWidth: 0, paddingBlock: 4, lineHeight: `${ROW_LINE_HEIGHT}px` }}>{children}</div>
    </>
  );
}

function AddressFieldRow({
  kind,
  title,
  address,
}: {
  kind: 'origin' | 'dest';
  title: string;
  address?: string | null;
}) {
  return (
    <div
      style={{
        gridColumn: '1 / -1',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        paddingBlock: 4,
        minWidth: 0,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', height: ROW_LINE_HEIGHT, flexShrink: 0 }}>
        <AddressKindMark kind={kind} title={title} />
      </span>
      <div style={{ minWidth: 0, lineHeight: `${ROW_LINE_HEIGHT}px` }}>{address || '-'}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Typography.Text type="secondary" style={{ fontSize: 12, lineHeight: '20px' }}>
      {children}
    </Typography.Text>
  );
}

export const TrackingDetailPanel: React.FC<TrackingDetailPanelProps> = ({
  loading,
  order,
  externalEvents,
  externalError,
  externalLoading,
  queryPhone,
  onQueryPhoneChange,
  onRefreshExternal,
  canAddEvent,
  canDeleteEvent,
  addingEvent,
  deletingEventId,
  eventForm,
  onAddEvent,
  onDeleteEvent,
}) => {
  const { t } = useTranslation();

  if (loading) {
    return (
      <Flex align="center" justify="center" style={{ flex: 1, minHeight: 200 }}>
        <Spin />
      </Flex>
    );
  }

  if (!order) {
    return (
      <Flex align="center" justify="center" style={{ flex: 1 }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('app.kuaizhizao.logistics.tracking.selectOrderHint')}
        />
      </Flex>
    );
  }

  const carrierBits = [order.carrier_name, order.vehicle_plate, order.driver_name].filter(Boolean);
  const sources = order.sources ?? [];
  const systemEvents = order.tracking_events ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <div style={{ padding: '12px 12px 8px', flexShrink: 0 }}>
        <Flex align="center" justify="space-between" gap={8} style={{ marginBottom: 8 }}>
          <Typography.Text strong copyable={{ text: order.order_code }} ellipsis style={{ minWidth: 0 }}>
            {order.order_code}
          </Typography.Text>
          {renderFreightOrderStatusTag(t, order.status)}
        </Flex>
        <DetailFieldList>
          <DetailFieldRow label={`${t('app.kuaizhizao.logistics.section.sources')}：`}>
            {sources.length ? (
              <Flex wrap gap={4}>
                {sources.map((src) => (
                  <SourceDocumentCode
                    key={`${src.source_type}-${src.source_id}`}
                    sourceType={src.source_type}
                    sourceId={src.source_id}
                    sourceCode={src.source_code}
                  />
                ))}
              </Flex>
            ) : (
              '-'
            )}
          </DetailFieldRow>
          <DetailFieldRow label={`${t('app.kuaizhizao.logistics.field.trackingNumber')}：`}>
            {order.tracking_number ? (
              <Typography.Text copyable={{ text: order.tracking_number }}>{order.tracking_number}</Typography.Text>
            ) : (
              '-'
            )}
          </DetailFieldRow>
          <DetailFieldRow label={`${t('app.kuaizhizao.logistics.field.carrierName')}：`}>
            {carrierBits.length ? carrierBits.join(' ') : '-'}
          </DetailFieldRow>
          <AddressFieldRow
            kind="origin"
            title={t('app.kuaizhizao.logistics.field.originAddress')}
            address={order.origin_address}
          />
          <AddressFieldRow
            kind="dest"
            title={t('app.kuaizhizao.logistics.field.destinationAddress')}
            address={order.destination_address}
          />
        </DetailFieldList>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 12px 12px' }}>
        <Collapse
          ghost
          size="small"
          defaultActiveKey={[]}
          styles={{ header: { paddingInline: 0, paddingBlock: 4 }, body: { paddingInline: 0 } }}
          items={[
            {
              key: 'system',
              label: (
                <Typography.Text type="secondary" style={{ fontSize: 12, lineHeight: '20px' }}>
                  {t('app.kuaizhizao.logistics.tracking.timelineTitle')}
                  {systemEvents.length ? ` ${systemEvents.length}` : ''}
                </Typography.Text>
              ),
              children: (
                <div>
                  {systemEvents.length > 0 ? (
                    <Timeline
                      style={{ marginTop: 8, marginBottom: 0 }}
                      items={systemEvents.map((event) => ({
                        children: (
                          <div>
                            <Flex align="flex-start" justify="space-between" gap={8}>
                              <Typography.Text>{logisticsTrackingEventLabel(t, event.event_type)}</Typography.Text>
                              {canDeleteEvent ? (
                                <Popconfirm
                                  title={t('common.confirmDelete')}
                                  onConfirm={() => void onDeleteEvent(event.id)}
                                >
                                  <Button
                                    type="link"
                                    danger
                                    size="small"
                                    icon={<DeleteOutlined />}
                                    loading={deletingEventId === event.id}
                                  />
                                </Popconfirm>
                              ) : null}
                            </Flex>
                            {event.location ? (
                              <div>
                                <Typography.Text type="secondary">{event.location}</Typography.Text>
                              </div>
                            ) : null}
                            {event.remark ? (
                              <div>
                                <Typography.Text type="secondary">{event.remark}</Typography.Text>
                              </div>
                            ) : null}
                            {event.event_time ? (
                              <div>
                                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                  {formatDateTimeBySiteSetting(event.event_time)}
                                </Typography.Text>
                              </div>
                            ) : null}
                          </div>
                        ),
                      }))}
                    />
                  ) : (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={t('app.kuaizhizao.logistics.detail.noTracking')}
                      style={{ marginBlock: 12 }}
                    />
                  )}
                  {canAddEvent ? (
                    <Form
                      form={eventForm}
                      layout="vertical"
                      size="small"
                      onFinish={onAddEvent}
                      initialValues={{ event_type: 'in_transit' }}
                      style={{ marginTop: 8 }}
                    >
                      <SectionTitle>{t('app.kuaizhizao.logistics.tracking.addEventTitle')}</SectionTitle>
                      <Flex gap={8} style={{ marginTop: 8 }}>
                        <Form.Item
                          name="event_type"
                          label={t('app.kuaizhizao.logistics.tracking.eventType')}
                          rules={[{ required: true }]}
                          style={{ width: 112, marginBottom: 8 }}
                        >
                          <Select
                            options={['depart', 'in_transit', 'arrived', 'signed'].map((value) => ({
                              label: logisticsTrackingEventLabel(t, value),
                              value,
                            }))}
                          />
                        </Form.Item>
                        <Form.Item
                          name="location"
                          label={t('app.kuaizhizao.logistics.tracking.eventLocation')}
                          rules={[{ required: true, whitespace: true }]}
                          style={{ flex: 1, minWidth: 0, marginBottom: 8 }}
                        >
                          <Input />
                        </Form.Item>
                      </Flex>
                      <Form.Item name="remark" label={t('common.remark')} style={{ marginBottom: 8 }}>
                        <Input />
                      </Form.Item>
                      <Button type="primary" htmlType="submit" loading={addingEvent} block>
                        {t('app.kuaizhizao.logistics.tracking.addEventSubmit')}
                      </Button>
                    </Form>
                  ) : null}
                </div>
              ),
            },
          ]}
        />

        {order.transport_mode === 'express' && order.tracking_number ? (
          <div style={{ marginTop: 12 }}>
            <SectionTitle>{t('app.kuaizhizao.logistics.tracking.externalTimelineTitle')}</SectionTitle>
            <Flex gap={8} style={{ marginTop: 8, marginBottom: 8 }}>
              <Input
                value={queryPhone}
                onChange={(e) => onQueryPhoneChange(e.target.value)}
                placeholder={t('app.kuaizhizao.logistics.tracking.queryPhonePlaceholder')}
                allowClear
              />
              <Button onClick={() => void onRefreshExternal()} loading={externalLoading}>
                {t('app.kuaizhizao.logistics.tracking.refreshTrack')}
              </Button>
            </Flex>
            {externalError ? (
              <Alert title={externalError} type="warning" showIcon style={{ marginBottom: 8 }} />
            ) : null}
            {externalEvents.length > 0 ? (
              <Timeline
                style={{ marginTop: 8, marginBottom: 0 }}
                items={externalEvents.map((event) => ({
                  children: (
                    <div>
                      <Typography.Text>{event.label}</Typography.Text>
                      {event.time ? (
                        <div>
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            {formatDateTimeBySiteSetting(event.time)}
                          </Typography.Text>
                        </div>
                      ) : null}
                    </div>
                  ),
                }))}
              />
            ) : null}
          </div>
        ) : null}
      </div>

    </div>
  );
};

export default TrackingDetailPanel;

import React, { useState } from 'react';
import { Button, Card, Form, Input, Space, Timeline, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { formatDateTimeBySiteSetting } from '../../../../../utils/format';
import { getFreightOrder, listFreightOrders, trackLogistics } from '../../../services/logistics';

const TrackingPage: React.FC = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [events, setEvents] = useState<{ label: string; time?: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    const values = await form.validateFields();
    setLoading(true);
    try {
      const orders = await listFreightOrders({ keyword: values.keyword, limit: 1 });
      if (orders.items.length > 0) {
        const detail = await getFreightOrder(orders.items[0].id);
        const manualEvents = (detail.tracking_events || []).map((event) => ({
          label: `${event.event_type} ${event.location || ''} ${event.remark || ''}`.trim(),
          time: event.event_time,
        }));
        setEvents(manualEvents);
        if (detail.transport_mode === 'express' && detail.tracking_number && values.carrier) {
          const track = await trackLogistics(values.carrier, detail.tracking_number);
          const external = Array.isArray(track?.events)
            ? track.events.map((item: Record<string, string>) => ({
                label: item.description || item.status || t('app.kuaizhizao.logistics.tracking.externalNode'),
                time: item.time,
              }))
            : [];
          setEvents([...manualEvents, ...external]);
        }
        return;
      }
      if (values.carrier && values.tracking_number) {
        const track = await trackLogistics(values.carrier, values.tracking_number);
        const external = Array.isArray(track?.events)
          ? track.events.map((item: Record<string, string>) => ({
              label: item.description || item.status || t('app.kuaizhizao.logistics.tracking.externalNode'),
              time: item.time,
            }))
          : [];
        setEvents(external);
        return;
      }
      message.warning(t('app.kuaizhizao.logistics.message.trackingNotFound'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ListPageTemplate>
      <Card>
        <Form form={form} layout="inline" onFinish={handleSearch}>
          <Form.Item name="keyword" label={t('app.kuaizhizao.logistics.field.orderCode')}>
            <Input allowClear />
          </Form.Item>
          <Form.Item name="carrier" label={t('app.kuaizhizao.logistics.field.carrierName')}>
            <Input allowClear />
          </Form.Item>
          <Form.Item name="tracking_number" label={t('app.kuaizhizao.logistics.field.trackingNumber')}>
            <Input allowClear />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                {t('common.search')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
        <Timeline
          style={{ marginTop: 24 }}
          items={events.map((event) => ({
            children: `${event.label}${event.time ? ` (${formatDateTimeBySiteSetting(event.time)})` : ''}`,
          }))}
        />
      </Card>
    </ListPageTemplate>
  );
};

export default TrackingPage;

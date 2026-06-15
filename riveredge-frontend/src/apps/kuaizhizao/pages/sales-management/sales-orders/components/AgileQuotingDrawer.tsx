import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Drawer, Table, Card, Statistic, Row, Col, InputNumber, Button, Typography, Space, Divider, message, Spin } from 'antd';
import { CalculatorOutlined, CheckCircleOutlined, DollarOutlined } from '@ant-design/icons';
import { getQuoteBreakdown, QuoteBreakdownResponse, QuoteItemResponse } from '../../../../services/sales-order';

const { Title, Text, Paragraph } = Typography;

interface AgileQuotingDrawerProps {
  materialId?: number;
  open: boolean;
  onClose: () => void;
  onAdopt?: (price: number) => void;
  /** 高于新建/编辑订单 Modal（与同页 Drawer 追溯浮层错层） */
  zIndex?: number;
}

export const AgileQuotingDrawer: React.FC<AgileQuotingDrawerProps> = ({
  materialId,
  open,
  onClose,
  onAdopt,
  zIndex,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<QuoteBreakdownResponse | null>(null);
  const [margin, setMargin] = useState<number>(20);
  const [finalPrice, setFinalPrice] = useState<number>(0);

  useEffect(() => {
    if (open && materialId) {
      loadData();
    }
  }, [open, materialId]);

  useEffect(() => {
    if (data) {
      calculatePrice(margin);
    }
  }, [data, margin]);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await getQuoteBreakdown(materialId!);
      setData(res);
      setFinalPrice(res.suggested_price);
    } catch (e) {
      message.error(t('app.kuaizhizao.agileQuoting.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const calculatePrice = (m: number) => {
    if (!data) return;
    const cost = data.total_estimated_cost;
    const price = m >= 100 ? cost * 10 : cost / (1 - m / 100);
    setFinalPrice(Number(price.toFixed(2)));
  };

  const itemTypeLabels = useMemo(
    () => ({
      material: t('app.kuaizhizao.agileQuoting.itemTypeMaterial'),
      labor: t('app.kuaizhizao.agileQuoting.itemTypeLabor'),
      overhead: t('app.kuaizhizao.agileQuoting.itemTypeOverhead'),
    }),
    [t],
  );

  const columns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.agileQuoting.colItemName'),
        dataIndex: 'name',
        key: 'name',
      },
      {
        title: t('app.kuaizhizao.agileQuoting.colItemType'),
        dataIndex: 'item_type',
        key: 'item_type',
        render: (type: string) => itemTypeLabels[type as keyof typeof itemTypeLabels] || type,
      },
      {
        title: t('app.kuaizhizao.agileQuoting.colQuantity'),
        dataIndex: 'quantity',
        key: 'quantity',
        render: (val: number, record: QuoteItemResponse) => `${val} ${record.unit || ''}`,
      },
      {
        title: t('app.kuaizhizao.agileQuoting.colUnitCost'),
        dataIndex: 'unit_cost',
        key: 'unit_cost',
        render: (val: number) => `¥${val.toFixed(2)}`,
      },
      {
        title: t('app.kuaizhizao.agileQuoting.colSubtotal'),
        dataIndex: 'total_cost',
        key: 'total_cost',
        render: (val: number) => <Text strong>¥{val.toFixed(2)}</Text>,
      },
      {
        title: t('app.kuaizhizao.agileQuoting.colRemark'),
        dataIndex: 'remark',
        key: 'remark',
        render: (text: string) => <Text type="secondary" style={{ fontSize: 12 }}>{text}</Text>,
      },
    ],
    [itemTypeLabels, t],
  );

  const allItems = [...(data?.material_costs || []), ...(data?.manufacturing_costs || [])];
  const materialRatio = data
    ? ((data.total_material_cost / (data.total_estimated_cost || 1)) * 100).toFixed(1)
    : '0';

  return (
    <Drawer
      title={
        <Space>
          <CalculatorOutlined />
          <span>{t('app.kuaizhizao.agileQuoting.title')}</span>
        </Space>
      }
      placement="right"
      zIndex={zIndex}
      size={800}
      onClose={onClose}
      open={open}
      footer={
        <div style={{ textAlign: 'right', padding: '10px 16px' }}>
          <Button onClick={onClose} style={{ marginRight: 8 }}>{t('common.cancel')}</Button>
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            disabled={!data}
            onClick={() => {
              onAdopt?.(finalPrice);
              onClose();
            }}
          >
            {t('app.kuaizhizao.agileQuoting.adoptPrice')}
          </Button>
        </div>
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <Spin />
          <div style={{ marginTop: 12, color: 'var(--ant-color-text-secondary)' }}>
            {t('app.kuaizhizao.agileQuoting.calculating')}
          </div>
        </div>
      ) : data ? (
        <div style={{ padding: '0 10px' }}>
          <Card size="small" style={{ marginBottom: 20, background: '#fafafa', border: '1px solid #f0f0f0' }}>
            <Title level={4} style={{ marginBottom: 4 }}>{data.material_name}</Title>
            <Text type="secondary">
              {t('app.kuaizhizao.agileQuoting.materialCode')}: {data.material_code}
              {data.material_spec
                ? ` | ${t('app.kuaizhizao.agileQuoting.materialSpec')}: ${data.material_spec}`
                : ''}
            </Text>
          </Card>

          <Title level={5} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <DollarOutlined /> {t('app.kuaizhizao.agileQuoting.costBreakdownTitle')}
          </Title>
          <Table
            dataSource={allItems}
            columns={columns}
            pagination={false}
            size="small"
            rowKey={(record, index) => `${record.name}-${index}`}
            summary={() => (
              <Table.Summary fixed>
                <Table.Summary.Row style={{ background: '#fafafa' }}>
                  <Table.Summary.Cell index={0} colSpan={4}>
                    {t('app.kuaizhizao.agileQuoting.totalEstimatedCost')}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1}>
                    <Text type="danger" strong>¥ {data.total_estimated_cost.toFixed(2)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} />
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />

          <Divider />

          <Title level={5}>{t('app.kuaizhizao.agileQuoting.analysisTitle')}</Title>
          <Row gutter={24} align="middle">
            <Col span={8}>
              <div style={{ marginBottom: 8 }}>{t('app.kuaizhizao.agileQuoting.targetMargin')}</div>
              <InputNumber
                min={0}
                max={100}
                value={margin}
                onChange={(v) => setMargin(v || 0)}
                style={{ width: '100%' }}
                formatter={(value) => `${value}%`}
                parser={(value) => Number(value!.replace('%', ''))}
              />
            </Col>
            <Col span={16}>
              <Card
                styles={{ body: { padding: '16px 24px' } }}
                style={{ border: '1px solid #52c41a', background: 'linear-gradient(135deg, #f6ffed 0%, #fff 100%)' }}
              >
                <Statistic
                  title={t('app.kuaizhizao.agileQuoting.suggestedPrice')}
                  value={finalPrice}
                  precision={2}
                  prefix="¥"
                  styles={{ content: { color: '#52c41a', fontSize: 32, fontWeight: 'bold' } }}
                />
                <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
                  {t('app.kuaizhizao.agileQuoting.priceModelHint')}
                </Paragraph>
              </Card>
            </Col>
          </Row>

          <div style={{ marginTop: 24, padding: 16, background: '#fff7e6', borderRadius: 8 }}>
            <Text type="warning" strong>{t('app.kuaizhizao.agileQuoting.adviceTitle')}</Text>
            <Paragraph style={{ fontSize: 13, color: '#874d00', marginTop: 4 }}>
              {t('app.kuaizhizao.agileQuoting.adviceContent', { ratio: materialRatio })}
            </Paragraph>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          {t('app.kuaizhizao.agileQuoting.noData')}
        </div>
      )}
    </Drawer>
  );
};

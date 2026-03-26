import React, { useEffect, useState } from 'react';
import { Drawer, Table, Card, Statistic, Row, Col, InputNumber, Button, Typography, Space, Divider, message, Spin } from 'antd';
import { CalculatorOutlined, CheckCircleOutlined, DollarOutlined } from '@ant-design/icons';
import { getQuoteBreakdown, QuoteBreakdownResponse, QuoteItemResponse } from '../../../../services/sales-order';

const { Title, Text, Paragraph } = Typography;

interface AgileQuotingDrawerProps {
  materialId?: number;
  visible: boolean;
  onClose: () => void;
  onAdopt?: (price: number) => void;
}

export const AgileQuotingDrawer: React.FC<AgileQuotingDrawerProps> = ({
  materialId,
  visible,
  onClose,
  onAdopt
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<QuoteBreakdownResponse | null>(null);
  const [margin, setMargin] = useState<number>(20); // 默认 20% 毛利
  const [finalPrice, setFinalPrice] = useState<number>(0);

  useEffect(() => {
    if (visible && materialId) {
      loadData();
    }
  }, [visible, materialId]);

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
      // 如果后端有建议价格，初始化 finalPrice
      setFinalPrice(res.suggested_price);
    } catch (e) {
      message.error('获取核价明细失败');
    } finally {
      setLoading(false);
    }
  };

  const calculatePrice = (m: number) => {
    if (!data) return;
    const cost = data.total_estimated_cost;
    // 售价 = 成本 / (1 - 毛利率)
    const price = m >= 100 ? cost * 10 : cost / (1 - m / 100);
    setFinalPrice(Number(price.toFixed(2)));
  };

  const columns = [
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '明细类型',
      dataIndex: 'item_type',
      key: 'item_type',
      render: (type: string) => {
        const map: any = { material: '材料', labor: '人工/制费', overhead: '制造费用' };
        return map[type] || type;
      }
    },
    {
      title: '预估用量/工时',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (val: number, record: QuoteItemResponse) => `${val} ${record.unit || ''}`
    },
    {
      title: '预估单价',
      dataIndex: 'unit_cost',
      key: 'unit_cost',
      render: (val: number) => `¥${val.toFixed(2)}`
    },
    {
      title: '小计',
      dataIndex: 'total_cost',
      key: 'total_cost',
      render: (val: number) => <Text strong>¥{val.toFixed(2)}</Text>
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      render: (text: string) => <Text type="secondary" style={{ fontSize: 12 }}>{text}</Text>
    }
  ];

  const allItems = [
    ...(data?.material_costs || []),
    ...(data?.manufacturing_costs || [])
  ];

  return (
    <Drawer
      title={
        <Space>
          <CalculatorOutlined />
          <span>敏捷核价器 (Agile Quoting Tool)</span>
        </Space>
      }
      placement="right"
      width={800}
      onClose={onClose}
      open={visible}
      footer={
        <div style={{ textAlign: 'right', padding: '10px 16px' }}>
          <Button onClick={onClose} style={{ marginRight: 8 }}>取消</Button>
          <Button 
            type="primary" 
            icon={<CheckCircleOutlined />} 
            disabled={!data}
            onClick={() => {
              onAdopt?.(finalPrice);
              onClose();
            }}
          >
            采纳价格至订单
          </Button>
        </div>
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '100px 0' }}><Spin tip="核算成本中..." /></div>
      ) : data ? (
        <div style={{ padding: '0 10px' }}>
          <Card size="small" style={{ marginBottom: 20, background: '#fafafa', border: '1px solid #f0f0f0' }}>
            <Title level={4} style={{ marginBottom: 4 }}>{data.material_name}</Title>
            <Text type="secondary">编码: {data.material_code} {data.material_spec ? ` | 规格: ${data.material_spec}` : ''}</Text>
          </Card>

          <Title level={5} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <DollarOutlined /> 成本构成明细
          </Title>
          <Table 
            dataSource={allItems} 
            columns={columns} 
            pagination={false} 
            size="small" 
            rowKey={(record, index) => `${record.name}-${index}`}
            summary={pageData => {
              return (
                <Table.Summary fixed>
                  <Table.Summary.Row style={{ background: '#fafafa' }}>
                    <Table.Summary.Cell index={0} colSpan={4}>合计预估底价</Table.Summary.Cell>
                    <Table.Summary.Cell index={1}>
                      <Text type="danger" strong>¥ {data.total_estimated_cost.toFixed(2)}</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} />
                  </Table.Summary.Row>
                </Table.Summary>
              );
            }}
          />

          <Divider />

          <Title level={5}>报价分析与模拟</Title>
          <Row gutter={24} align="middle">
            <Col span={8}>
              <div style={{ marginBottom: 8 }}>目标毛利率 (%)</div>
              <InputNumber 
                min={0} 
                max={100} 
                value={margin} 
                onChange={v => setMargin(v || 0)} 
                style={{ width: '100%' }} 
                formatter={value => `${value}%`}
                parser={value => Number(value!.replace('%', ''))}
              />
            </Col>
            <Col span={16}>
              <Card 
                bodyStyle={{ padding: '16px 24px' }} 
                style={{ border: '1px solid #52c41a', background: 'linear-gradient(135deg, #f6ffed 0%, #fff 100%)' }}
              >
                <Statistic 
                  title="建议对外报价" 
                  value={finalPrice} 
                  precision={2} 
                  prefix="¥" 
                  valueStyle={{ color: '#52c41a', fontSize: 32, fontWeight: 'bold' }}
                />
                <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
                  * 基于“成本 + 毛利”模型。实际报价建议根据客户级关系及订单规模动态调整。
                </Paragraph>
              </Card>
            </Col>
          </Row>

          <div style={{ marginTop: 24, padding: 16, background: '#fff7e6', borderRadius: 8 }}>
            <Text type="warning" strong>核价建议：</Text>
            <Paragraph style={{ fontSize: 13, color: '#874d00', marginTop: 4 }}>
              当前产品材料成本占比为 {((data.total_material_cost / (data.total_estimated_cost || 1)) * 100).toFixed(1)}%。
              近期原材料价格波动较大，建议在报价单中增加“有效期”条款（建议 7 天）。
            </Paragraph>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '100px 0' }}>未找到核价数据，请确保产品已配置 BOM 和工艺路线。</div>
      )}
    </Drawer>
  );
};

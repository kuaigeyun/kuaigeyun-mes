import React from 'react';
import { PageContainer, ProTable, ProCard, StatisticCard } from '@ant-design/pro-components';
import { Tag, Badge, message, Row, Col } from 'antd';
import { sparePartApi } from '../../../services/equipment';

const SparePartsPage: React.FC = () => {
  return (
    <PageContainer title="备品备件库" subTitle="关键耗材与维护备件库存监控">
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <StatisticCard
            statistic={{
              title: '库存异常预警',
              value: 3,
              status: 'error',
            }}
            footer={<div>当前 3 项备件低于安全库存</div>}
          />
        </Col>
        <Col span={16}>
          <ProCard ghost gutter={8}>
            <ProCard layout="center" bordered> 极低库存: 2 </ProCard>
            <ProCard layout="center" bordered> 本月领用: 45 次 </ProCard>
          </ProCard>
        </Col>
      </Row>

      <ProTable
        headerTitle="备件库存列表"
        rowKey="id"
        request={async () => {
          try {
            const data = await sparePartApi.listInventory();
            return { data, success: true };
          } catch (e) {
            return { data: [], success: false };
          }
        }}
        columns={[
          { title: '备件编码', dataIndex: 'part_no' },
          { title: '备件名称', dataIndex: 'part_name' },
          { title: '当前库存', dataIndex: 'stock_quantity', valueType: 'digit' },
          { title: '库位', dataIndex: 'warehouse_location' },
          {
            title: '库存状态',
            render: (_, record) => (
              record.stock_quantity < 5 ? <Badge status="error" text="低库存" /> : <Badge status="success" text="充足" />
            )
          },
        ]}
      />
    </PageContainer>
  );
};

export default SparePartsPage;

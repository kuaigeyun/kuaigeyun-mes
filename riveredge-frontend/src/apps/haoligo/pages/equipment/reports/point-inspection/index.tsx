/**
 * 好力 GO — 设备点检（按台账/点检方案的参数项执行结果）
 *
 * 规划见 riveredge-adapt/haoli-go/PAGE_CONSTRUCTION_PLAN.md §1.3；列表数据待与移动端点检提交事实表对接（P2）。
 */

import React from 'react';
import { Alert, Button, Card, Space, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ListPageTemplate } from '../../../../../../components/layout-templates';

const { Paragraph, Text } = Typography;

const EquipmentPointInspectionReportPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <ListPageTemplate>
      <Card title={t('app.haoligo.menu.equipment.reports.point-inspection')}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message="数据接入（P2）"
            description="本页将提供按设备、车间、时间与点检方案筛选的参数点检结果列表与导出，与移动端「按设备点检」提交口径一致。当前后端事实表与查询 API 尚未挂载，占位避免菜单 404。"
          />
          <Paragraph type="secondary">
            请先在 <Text strong>设备台账</Text> 为设备绑定点检方案，并在 <Text strong>点检参数 / 点检方案</Text> 中维护参数项与方案明细。
          </Paragraph>
          <Space wrap>
            <Link to="/apps/haoligo/equipment/ledger">
              <Button type="primary">设备台账</Button>
            </Link>
            <Link to="/apps/haoligo/equipment/inspection-param-sets">
              <Button>点检方案</Button>
            </Link>
            <Link to="/apps/haoligo/equipment/inspection-params">
              <Button>点检参数</Button>
            </Link>
          </Space>
        </Space>
      </Card>
    </ListPageTemplate>
  );
};

export default EquipmentPointInspectionReportPage;
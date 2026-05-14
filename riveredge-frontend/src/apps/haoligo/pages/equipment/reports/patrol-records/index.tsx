/**
 * 好力 GO — 路线巡检（按巡检路线与步骤顺序的执行轨迹）
 *
 * 规划见 riveredge-adapt/haoli-go/PAGE_CONSTRUCTION_PLAN.md §1.3；列表数据待与路线执行回写对接（P2）。
 */

import React from 'react';
import { Alert, Button, Card, Space, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ListPageTemplate } from '../../../../../../components/layout-templates';

const { Paragraph, Text } = Typography;

const EquipmentPatrolRecordsReportPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <ListPageTemplate>
      <Card title={t('app.haoligo.menu.equipment.reports.patrol-records')}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message="数据接入（P2）"
            description="本页将提供按巡检路线、设备顺序与时间筛选的巡线执行情况与导出，与 PC 端「巡检路线」配置及移动端按路线巡检一致。当前后端事实表与查询 API 尚未挂载，占位避免菜单 404。"
          />
          <Paragraph type="secondary">
            请先在 <Text strong>巡检路线</Text> 中维护车间与设备顺序；路线执行结果回写就绪后，本表将自动汇总。
          </Paragraph>
          <Space wrap>
            <Link to="/apps/haoligo/equipment/patrol-routes">
              <Button type="primary">巡检路线</Button>
            </Link>
            <Link to="/apps/haoligo/equipment/ledger">
              <Button>设备台账</Button>
            </Link>
          </Space>
        </Space>
      </Card>
    </ListPageTemplate>
  );
};

export default EquipmentPatrolRecordsReportPage;
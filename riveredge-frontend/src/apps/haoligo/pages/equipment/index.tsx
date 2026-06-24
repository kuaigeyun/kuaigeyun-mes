import React, { useCallback, useEffect, useState } from 'react';
import { App, Card, Col, List, Row, Space, Statistic, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ListPageTemplate } from '../../../../components/layout-templates';
import { listEquipments } from '../../services/haoligo';

const { Title, Paragraph, Text } = Typography;

type NavItem = { to: string; titleKey: string };

const MASTER_LINKS: NavItem[] = [
  { to: '/apps/haoligo/equipment/ledger', titleKey: 'app.haoligo.menu.equipment.ledger' },
  { to: '/apps/master-data/factory/workshops', titleKey: 'app.haoligo.menu.equipment.masterDataWorkshops' },
  { to: '/apps/haoligo/equipment/categories', titleKey: 'app.haoligo.menu.equipment.categories' },
  { to: '/apps/haoligo/equipment/manufacturers', titleKey: 'app.haoligo.menu.equipment.manufacturers' },
  { to: '/apps/haoligo/equipment/inspection-params', titleKey: 'app.haoligo.menu.equipment.inspection-params' },
  { to: '/apps/haoligo/equipment/inspection-param-sets', titleKey: 'app.haoligo.menu.equipment.inspection-param-sets' },
  { to: '/apps/haoligo/equipment/patrol-routes', titleKey: 'app.haoligo.menu.equipment.patrol-routes' },
];

const REPORT_LINKS: NavItem[] = [
  { to: '/apps/haoligo/equipment/documents/acceptance', titleKey: 'app.haoligo.menu.equipment.documents.acceptance' },
  { to: '/apps/haoligo/equipment/documents/spot-check', titleKey: 'app.haoligo.menu.equipment.documents.spot-check' },
  { to: '/apps/haoligo/equipment/documents/route-patrol', titleKey: 'app.haoligo.menu.equipment.documents.route-patrol' },
  { to: '/apps/haoligo/equipment/documents/upkeep-sheet', titleKey: 'app.haoligo.menu.equipment.documents.upkeep-sheet' },
  { to: '/apps/haoligo/equipment/documents/upkeep-complete', titleKey: 'app.haoligo.menu.equipment.documents.upkeep-complete' },
  { to: '/apps/haoligo/equipment/documents/output-record', titleKey: 'app.haoligo.menu.equipment.documents.output-record' },
  { to: '/apps/haoligo/equipment/documents/status-adjustment', titleKey: 'app.haoligo.menu.equipment.documents.status-adjustment' },
];

const ANALYTICS_LINKS: NavItem[] = [
  { to: '/apps/haoligo/equipment/dashboard/status', titleKey: 'app.haoligo.menu.equipment.dashboard.status' },
  { to: '/apps/haoligo/equipment/reports/capacity', titleKey: 'app.haoligo.menu.equipment.reports.capacity' },
  { to: '/apps/haoligo/equipment/reports/maintenance-plan', titleKey: 'app.haoligo.menu.equipment.reports.maintenance-plan' },
];

const EquipmentPage: React.FC = () => {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const [equipmentTotal, setEquipmentTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const eq = await listEquipments({ limit: 1, skip: 0 });
      setEquipmentTotal(eq.total);
    } catch (e) {
      message.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
      setEquipmentTotal(null);
    } finally {
      setLoading(false);
    }
  }, [message, t]);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  const renderLinkList = (items: NavItem[]) => (
    <List
      size="small"
      dataSource={items}
      renderItem={(item) => (
        <List.Item style={{ padding: '6px 0', borderBlockEnd: 'none' }}>
          <Link to={item.to}>{t(item.titleKey)}</Link>
        </List.Item>
      )}
    />
  );

  return (
    <div style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      <ListPageTemplate>
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <div>
            <Title level={4} style={{ marginTop: 0, marginBottom: 8 }}>
              {t('app.haoligo.equipment.hub.title')}
            </Title>
            <Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 14, lineHeight: 1.65 }}>
              {t('app.haoligo.equipment.hub.lead')}
            </Paragraph>
          </div>

          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={8}>
              <Card size="small" loading={loading}>
                <Statistic title={t('app.haoligo.equipment.hub.statEquipments')} value={equipmentTotal ?? '—'} />
              </Card>
            </Col>
          </Row>

          <Card size="small" title={<Text strong>{t('app.haoligo.equipment.hub.sectionMaster')}</Text>}>
            {renderLinkList(MASTER_LINKS)}
          </Card>

          <Card size="small" title={<Text strong>{t('app.haoligo.equipment.hub.sectionReports')}</Text>}>
            {renderLinkList(REPORT_LINKS)}
          </Card>

          <Card size="small" title={<Text strong>{t('app.haoligo.equipment.hub.sectionAnalytics')}</Text>}>
            {renderLinkList(ANALYTICS_LINKS)}
          </Card>
        </Space>
      </ListPageTemplate>
    </div>
  );
};

export default EquipmentPage;

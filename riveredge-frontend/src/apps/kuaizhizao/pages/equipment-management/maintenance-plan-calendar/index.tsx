import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Card, List, Typography, theme } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { StatusTag } from '../../../../../constants/statusBadges';
import { renderDocumentStatusTag } from '../../../../../utils/documentLifecycleStatusTag';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { maintenancePlanApi } from '../../../services/equipment';

const P = 'app.kuaizhizao.maintenancePlanCalendar';
const RESOURCE = 'kuaizhizao:maintenance-plan';

interface MaintenancePlanItem {
  uuid: string;
  plan_no?: string;
  plan_name?: string;
  equipment_name?: string;
  planned_start_date?: string;
  status?: string;
}


const MaintenancePlanCalendarPage: React.FC = () => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  useResourcePermissions(RESOURCE);
  const [plans, setPlans] = useState<MaintenancePlanItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [loading, setLoading] = useState(false);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await maintenancePlanApi.list({ limit: 1000 });
      setPlans(res.items ?? res.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  const plansByDate = useMemo(() => {
    const map = new Map<string, MaintenancePlanItem[]>();
    for (const plan of plans) {
      if (!plan.planned_start_date) continue;
      const key = dayjs(plan.planned_start_date).format('YYYY-MM-DD');
      const bucket = map.get(key) ?? [];
      bucket.push(plan);
      map.set(key, bucket);
    }
    return map;
  }, [plans]);

  const selectedPlans = plansByDate.get(selectedDate.format('YYYY-MM-DD')) ?? [];

  const renderCalendarDateCell = (value: Dayjs) => {
    const key = value.format('YYYY-MM-DD');
    const dayPlans = plansByDate.get(key) ?? [];
    if (dayPlans.length === 0) return null;
    return (
      <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {dayPlans.slice(0, 2).map((p) => (
          <li key={p.uuid}>
            <Typography.Text ellipsis style={{ fontSize: 12 }}>
              {p.plan_no ?? p.plan_name}
            </Typography.Text>
          </li>
        ))}
        {dayPlans.length > 2 && (
          <li>
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              +{dayPlans.length - 2}
            </Typography.Text>
          </li>
        )}
      </ul>
    );
  };

  return (
    <ListPageTemplate>
      <Card title={t(`${P}.title`)} loading={loading}>
        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              flex: '2 1 480px',
              minWidth: 320,
              paddingRight: 4,
            }}
          >
            <Calendar
              value={selectedDate}
              onSelect={setSelectedDate}
              cellRender={(current, info) => (info.type === 'date' ? renderCalendarDateCell(current) : info.originNode)}
            />
          </div>
          <div
            style={{
              flex: '1 1 280px',
              minWidth: 260,
              maxWidth: 420,
              padding: 16,
              background: token.colorFillAlter,
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: token.borderRadiusLG,
            }}
          >
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              {t(`${P}.selectedDate`, { date: selectedDate.format('YYYY-MM-DD') })}
            </Typography.Title>
            <List
              locale={{ emptyText: t(`${P}.noPlans`) }}
              dataSource={selectedPlans}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <>
                        {item.plan_no ?? item.plan_name}{' '}
                        {renderDocumentStatusTag(item.status, item.status)}
                      </>
                    }
                    description={`${item.equipment_name ?? '-'} - ${item.plan_name ?? ''}`}
                  />
                </List.Item>
              )}
            />
          </div>
        </div>
      </Card>
    </ListPageTemplate>
  );
};

export default MaintenancePlanCalendarPage;

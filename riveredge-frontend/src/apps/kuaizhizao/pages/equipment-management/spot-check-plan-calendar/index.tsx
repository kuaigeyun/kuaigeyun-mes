import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App, Calendar, Card, List, Typography, theme } from 'antd';
import { useNavigate } from 'react-router-dom';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { renderDocumentStatusTag } from '../../../../../utils/documentLifecycleStatusTag';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { spotChecksApi } from '../../../services/equipmentOps';

const P = 'app.kuaizhizao.spotCheckPlanCalendar';
const RESOURCE = 'kuaizhizao:equipment-spot-check-plan';

interface SpotCheckPlanItem {
  id: number;
  uuid: string;
  document_no?: string;
  equipment_name?: string;
  shift_name?: string;
  scheduled_at?: string;
  status?: string;
}

const SpotCheckPlanCalendarPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { token } = theme.useToken();
  useResourcePermissions(RESOURCE);
  const [plans, setPlans] = useState<SpotCheckPlanItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [loading, setLoading] = useState(false);
  const month = selectedDate.format('YYYY-MM');
  const loadSequence = useRef(0);

  const loadPlans = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    try {
      const items: SpotCheckPlanItem[] = [];
      for (let skip = 0; ; skip += 1000) {
        const res = await spotChecksApi.list({
          skip, limit: 1000,
          check_start_date: dayjs(month).startOf('month').format('YYYY-MM-DD'),
          check_end_date: dayjs(month).endOf('month').format('YYYY-MM-DD'),
          scheme_domain: 'equipment',
        }) as { items: SpotCheckPlanItem[]; total: number };
        if (sequence !== loadSequence.current) return;
        items.push(...res.items);
        if (skip + res.items.length >= res.total || !res.items.length) break;
      }
      setPlans(items.filter((task) => task.scheduled_at));
    } catch {
      if (sequence !== loadSequence.current) return;
      setPlans([]);
      message.error('加载点检任务失败');
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [month, message]);

  useEffect(() => {
    void loadPlans();
    return () => { loadSequence.current += 1; };
  }, [loadPlans]);

  const plansByDate = useMemo(() => {
    const map = new Map<string, SpotCheckPlanItem[]>();
    for (const plan of plans) {
      if (!plan.scheduled_at) continue;
      const key = dayjs(plan.scheduled_at).format('YYYY-MM-DD');
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
              {p.equipment_name} {p.shift_name}
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
      <Card loading={loading}>
        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: '2 1 480px', minWidth: 320, paddingRight: 4 }}>
            <Calendar
              value={selectedDate}
              onSelect={setSelectedDate}
              cellRender={(current, info) =>
                info.type === 'date' ? renderCalendarDateCell(current) : info.originNode
              }
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
                        <Typography.Link onClick={() => navigate(
                          `/apps/kuaizhizao/equipment-management/spot-checks?uuid=${item.uuid}`,
                        )}>{item.document_no}</Typography.Link>{' '}
                        {renderDocumentStatusTag(item.status, item.status)}
                      </>
                    }
                    description={[
                      item.equipment_name,
                      item.shift_name,
                    ]
                      .filter(Boolean)
                      .join(' ')}
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

export default SpotCheckPlanCalendarPage;

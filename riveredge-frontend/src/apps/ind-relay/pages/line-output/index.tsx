import React, { useMemo, useRef, useState } from 'react';
import { DatePicker, Space } from 'antd';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { ListPageTemplate } from '../../../../components/layout-templates';
import { UniTable } from '../../../../components/uni-table';
import { industryRelayApi, type RelayLineOutput } from '../../services/industryRelayApi';

const { RangePicker } = DatePicker;

export default function RelayLineOutputPage() {
  const { t } = useTranslation();
  const actionRef = useRef<ActionType>(null);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs(), dayjs()]);

  const columns: ProColumns<RelayLineOutput>[] = useMemo(
    () => [
      {
        title: t('app.ind-relay.lineOutput.line'),
        dataIndex: 'production_line_name',
        ellipsis: true,
        render: (_, row) => row.production_line_name || row.production_line_code || row.production_line_id,
      },
      {
        title: t('app.ind-relay.lineOutput.dailyCapacity'),
        dataIndex: 'daily_capacity_qty',
        width: 120,
      },
      {
        title: t('app.ind-relay.lineOutput.plannedQuantity'),
        dataIndex: 'planned_quantity',
        width: 110,
        render: (_, row) => Number(row.planned_quantity || 0),
      },
      {
        title: t('app.ind-relay.lineOutput.outputQualified'),
        dataIndex: 'output_qualified',
        width: 140,
      },
      {
        title: t('app.ind-relay.lineOutput.achievementRate'),
        dataIndex: 'achievement_rate',
        width: 120,
        render: (_, row) => `${Number(row.achievement_rate || 0).toFixed(1)}%`,
      },
      {
        title: t('app.ind-relay.lineOutput.planAchievementRate'),
        dataIndex: 'plan_achievement_rate',
        width: 120,
        render: (_, row) => `${Number(row.plan_achievement_rate || 0).toFixed(1)}%`,
      },
    ],
    [t]
  );

  return (
    <ListPageTemplate>
      <UniTable<RelayLineOutput>
        actionRef={actionRef}
        rowKey="production_line_id"
        columns={columns}
        search={false}
        headerTitle={
          <Space>
            <span>{t('app.ind-relay.lineOutput.dateRange')}</span>
            <RangePicker
              value={dateRange}
              allowClear={false}
              format="YYYY-MM-DD"
              onChange={(dates) => {
                if (dates?.[0] && dates[1]) {
                  setDateRange([dates[0], dates[1]]);
                }
              }}
            />
          </Space>
        }
        request={async () => {
          const items = await industryRelayApi.listLineOutput({
            date_start: dateRange[0].format('YYYY-MM-DD'),
            date_end: dateRange[1].format('YYYY-MM-DD'),
          });
          return { data: items, success: true, total: items.length };
        }}
        params={{
          date_start: dateRange[0].format('YYYY-MM-DD'),
          date_end: dateRange[1].format('YYYY-MM-DD'),
        }}
      />
    </ListPageTemplate>
  );
}

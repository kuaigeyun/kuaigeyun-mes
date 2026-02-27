/**
 * 绩效汇总页面
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Space, DatePicker, Select } from 'antd';
import { CalculatorOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, DetailDrawerTemplate, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { employeePerformanceApi } from '../../../services/performance';
import type { PerformanceSummary, PerformanceDetail } from '../../../types/performance';
import type { ProDescriptionsItemType } from '@ant-design/pro-components';
import dayjs from 'dayjs';

const SummariesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [period, setPeriod] = useState<string>(dayjs().format('YYYY-MM'));
  const [employeeId, setEmployeeId] = useState<number | undefined>();
  const [employees, setEmployees] = useState<{ id: number; full_name: string }[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detail, setDetail] = useState<PerformanceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [calcLoading, setCalcLoading] = useState(false);

  useEffect(() => {
    employeePerformanceApi.listEmployees({ limit: 500 }).then((r) => {
      setEmployees(r.items.map((e) => ({ id: e.id, full_name: e.full_name || e.username })));
    }).catch(() => {});
  }, []);

  const handleCalculate = async () => {
    try {
      setCalcLoading(true);
      await employeePerformanceApi.calculate(period);
      messageApi.success('计算完成');
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || '计算失败');
    } finally {
      setCalcLoading(false);
    }
  };

  const handleViewDetail = async (record: PerformanceSummary) => {
    try {
      setDrawerVisible(true);
      setDetailLoading(true);
      const d = await employeePerformanceApi.getDetail({ period: record.period, employee_id: record.employee_id });
      setDetail(d);
    } catch (e: any) {
      messageApi.error(e?.message || '加载失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const detailColumns: ProDescriptionsItemType<PerformanceDetail>[] = [
    { title: '员工', dataIndex: 'employee_name' },
    { title: '周期', dataIndex: 'period' },
    { title: '总工时', dataIndex: ['summary', 'total_hours'], render: (_, r) => r?.summary?.total_hours ?? '-' },
    { title: '总件数', dataIndex: ['summary', 'total_pieces'], render: (_, r) => r?.summary?.total_pieces ?? '-' },
    { title: '应发金额', dataIndex: ['summary', 'total_amount'], render: (_, r) => r?.summary?.total_amount ?? '-' },
  ];

  const columns: ProColumns<PerformanceSummary>[] = [
    { title: '员工', dataIndex: 'employee_name', width: 120, fixed: 'left' },
    { title: '周期', dataIndex: 'period', width: 100 },
    { title: '总工时', dataIndex: 'total_hours', width: 100, align: 'right' },
    { title: '总件数', dataIndex: 'total_pieces', width: 100, align: 'right' },
    { title: '计时金额', dataIndex: 'time_amount', width: 110, align: 'right' },
    { title: '计件金额', dataIndex: 'piece_amount', width: 110, align: 'right' },
    { title: '应发总额', dataIndex: 'total_amount', width: 110, align: 'right' },
    { title: '状态', dataIndex: 'status', width: 90, render: (_, r) => <span>{r.status === 'calculated' ? '已计算' : r.status}</span> },
    {
      title: '操作',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>明细</Button>
      ),
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<PerformanceSummary>
          headerTitle="绩效汇总"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          request={async (params) => {
            try {
              const result = await employeePerformanceApi.listSummaries({
                period,
                employee_id: employeeId,
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
              });
              return { data: result, success: true, total: result.length };
            } catch (e: any) {
              messageApi.error(e?.message || '加载失败');
              return { data: [], success: false, total: 0 };
            }
          }}
          toolBarRender={() => [
            <Space key="filters">
              <DatePicker picker="month" value={period ? dayjs(period) : null} onChange={(d) => { setPeriod(d ? d.format('YYYY-MM') : ''); actionRef.current?.reload(); }} placeholder="周期" />
              <Select
                placeholder="员工"
                allowClear
                style={{ width: 160 }}
                options={employees.map((e) => ({ label: e.full_name, value: e.id }))}
                value={employeeId}
                onChange={(v) => { setEmployeeId(v); actionRef.current?.reload(); }}
              />
              <Button type="primary" icon={<CalculatorOutlined />} loading={calcLoading} onClick={handleCalculate}>计算绩效</Button>
            </Space>,
          ]}
        />
      </ListPageTemplate>

      <DetailDrawerTemplate<PerformanceDetail>
        title={`绩效明细 - ${detail?.employee_name || ''} ${detail?.period || ''}`}
        open={drawerVisible}
        onClose={() => { setDrawerVisible(false); setDetail(null); }}
        dataSource={detail || undefined}
        columns={detailColumns}
        loading={detailLoading}
        width={DRAWER_CONFIG.HALF_WIDTH}
      />
    </>
  );
};

export default SummariesPage;

import React, { useMemo, useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormDateTimePicker, ProFormDigit, ProFormText } from '@ant-design/pro-components';
import { App, Button, Card, Empty, Space, Tag, Typography } from 'antd';
import { UniTable } from '../../../../../components/uni-table';
import { FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { qualityImprovementApi, SPCSample } from '../../../services/quality-improvement';
import { useGlobalStore } from '../../../../../stores/globalStore';
import { hasPermission } from '../../../../../utils/permission';
import PermissionGuard from '../../../../../components/permission/PermissionGuard';

const SPCMonitorPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const actionRef = useRef<ActionType>(null);
  const createFormRef = useRef<any>(null);
  const [createVisible, setCreateVisible] = useState(false);
  const [characteristicName, setCharacteristicName] = useState<string>('');
  const [chartData, setChartData] = useState<any>(null);
  const canCreate = hasPermission(currentUser ?? undefined, 'kuaizhizao:quality-management-spc-monitor:create');

  const columns: ProColumns<SPCSample>[] = [
    { title: '质量特性', dataIndex: 'characteristic_name', width: 180 },
    { title: '控制图类型', dataIndex: 'chart_type', width: 120, valueEnum: { imr: 'I-MR' } },
    { title: '采样值', dataIndex: 'sample_value', width: 120, valueType: 'digit' },
    { title: '样本量', dataIndex: 'sample_size', width: 100, valueType: 'digit' },
    { title: '采样时间', dataIndex: 'sample_time', width: 180, valueType: 'dateTime' },
  ];

  const chartLines = useMemo(() => {
    if (!chartData?.points) return [] as string[];
    return chartData.points.map((p: any, idx: number) => {
      const flag = p.out_of_control ? ' [超限]' : '';
      return `${idx + 1}. ${p.sample_time} => ${p.sample_value}${flag}`;
    });
  }, [chartData]);

  return (
    <PermissionGuard
      permission="kuaizhizao:quality-management-spc-monitor:read"
      fallback={<Empty description="暂无SPC查看权限" style={{ marginTop: 120 }} />}
    >
      <ListPageTemplate>
        <UniTable<SPCSample>
          headerTitle="SPC 监控（I-MR）"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          columnPersistenceId="apps.kuaizhizao.pages.quality-management.spc-monitor"
          toolBarRender={() => [
            ...(canCreate
              ? [
                  <Button key="addSample" type="primary" onClick={() => setCreateVisible(true)}>
                    新增采样
                  </Button>,
                ]
              : []),
            <Button
              key="refreshChart"
              onClick={async () => {
                if (!characteristicName) {
                  messageApi.warning('请先选择一条数据后再查看控制线');
                  return;
                }
                const chart = await qualityImprovementApi.spc.getImrChart(characteristicName, 100);
                setChartData(chart);
              }}
            >
              刷新控制线
            </Button>,
          ]}
          request={async (params) => {
            const pageSize = params.pageSize || 20;
            const skip = ((params.current || 1) - 1) * pageSize;
            const rows = await qualityImprovementApi.spc.listSamples({
              skip,
              limit: pageSize,
              characteristic_name: params.characteristic_name,
            });
            if (!characteristicName && rows.length > 0) setCharacteristicName(rows[0].characteristic_name);
            return {
              success: true,
              data: rows || [],
              total: rows.length < pageSize ? skip + rows.length : skip + rows.length + 1,
            };
          }}
          onRow={(record) => ({
            onClick: async () => {
              setCharacteristicName(record.characteristic_name);
              const chart = await qualityImprovementApi.spc.getImrChart(record.characteristic_name, 100);
              setChartData(chart);
            },
          })}
        />

        <Card title={`控制线 - ${characteristicName || '-'}`} style={{ marginTop: 16 }}>
          {chartData ? (
            <Space orientation="vertical" style={{ width: '100%' }}>
              <Typography.Text>中心线(CL): {Number(chartData.mean || 0).toFixed(4)}</Typography.Text>
              <Typography.Text>上控制线(UCL): {Number(chartData.ucl || 0).toFixed(4)}</Typography.Text>
              <Typography.Text>下控制线(LCL): {Number(chartData.lcl || 0).toFixed(4)}</Typography.Text>
              <div>
                {(chartData.triggered_summary || []).map((r: string) => (
                  <Tag key={r} color="warning">
                    {r}
                  </Tag>
                ))}
              </div>
              <div style={{ maxHeight: 240, overflow: 'auto', border: '1px solid #f0f0f0', padding: 8 }}>
                {chartLines.map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </div>
            </Space>
          ) : (
            <Typography.Text type="secondary">点击任一采样记录即可加载该质量特性的控制线。</Typography.Text>
          )}
        </Card>

        <FormModalTemplate
          title="新增 SPC 采样"
          open={createVisible}
          width={MODAL_CONFIG.SMALL_WIDTH}
          formRef={createFormRef}
          onClose={() => {
            setCreateVisible(false);
            createFormRef.current?.resetFields();
          }}
          onFinish={async (values) => {
            if (!canCreate) {
              messageApi.error('无采样新增权限');
              return false;
            }
            await qualityImprovementApi.spc.createSample({
              ...values,
              chart_type: 'imr',
            });
            messageApi.success('采样已保存');
            setCreateVisible(false);
            actionRef.current?.reload();
          }}
        >
          <ProFormText name="characteristic_name" label="质量特性" rules={[{ required: true }]} />
          <ProFormDigit name="sample_value" label="采样值" rules={[{ required: true }]} />
          <ProFormDigit name="sample_size" label="样本量" initialValue={1} rules={[{ required: true }]} />
          <ProFormDateTimePicker name="sample_time" label="采样时间" rules={[{ required: true }]} />
        </FormModalTemplate>
      </ListPageTemplate>
    </PermissionGuard>
  );
};

export default SPCMonitorPage;

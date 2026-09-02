/**
 * 辐条轮毂 - 总装调试：录入 3 个百分表读数，自动算极差判定同心度
 */
import React, { useState, useEffect, useMemo } from 'react';
import { App, Button, Card, Col, Form, Input, InputNumber, Row, Statistic, Table, Tag, Typography, Result } from 'antd';
import { AimOutlined, CheckCircleOutlined, CloseCircleOutlined, PlusOutlined, ToolOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { Icon as IconifyIcon } from '@iconify/react/dist/offline';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ListPageTemplate } from '../../../../components/layout-templates';
import {
  listAssemblies,
  createAssembly,
  updateAssembly,
  createCheck,
  listChecksByAssembly,
  type SpokeWheelAssembly,
  type ConcentricityCheck,
} from '../../services/spoke-wheel';

const { Title, Text } = Typography;
const TOLERANCE_DEFAULT = 0.8;

export default function AssemblyDebugPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [createForm] = Form.useForm();
  const [checkForm] = Form.useForm();

  // 1) 总装记录列表
  const { data: assemblies, isLoading } = useQuery({
    queryKey: ['spoke-wheel', 'assemblies'],
    queryFn: () => listAssemblies({ page_size: 50 }),
  });

  const selected = useMemo(
    () => (assemblies || []).find((a) => a.id === selectedId) || null,
    [assemblies, selectedId],
  );

  // 2) 当前总装的同心度检测历史
  const { data: checks } = useQuery({
    queryKey: ['spoke-wheel', 'checks', selectedId],
    queryFn: () => listChecksByAssembly(selectedId!),
    enabled: !!selectedId,
  });

  // 监听当前选中总装自动算极差
  const finalAssembly = selected;
  const livePreview = useMemo(() => {
    const v1 = checkForm.getFieldValue('dial_1_value');
    const v2 = checkForm.getFieldValue('dial_2_value');
    const v3 = checkForm.getFieldValue('dial_3_value');
    const tol = checkForm.getFieldValue('tolerance_mm') ?? TOLERANCE_DEFAULT;
    if (v1 == null || v2 == null || v3 == null) return null;
    const max = Math.max(v1, v2, v3);
    const min = Math.min(v1, v2, v3);
    const dev = +(max - min).toFixed(4);
    return { dev, tol, qualified: dev <= tol };
  }, [checkForm]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['spoke-wheel', 'assemblies'] });
    queryClient.invalidateQueries({ queryKey: ['spoke-wheel', 'checks', selectedId] });
  };

  // 创建总装
  const onCreate = async () => {
    try {
      const values = await createForm.validateFields();
      const created = await createAssembly({
        product_material_code: 'SW-PRODUCT',
        product_material_name: '辐条轮毂',
        fixture_dial_count: 3,
        remarks: values.remarks || 'MES 改造验证',
      });
      message.success(`总装记录 ${created.code} 创建成功`);
      createForm.resetFields();
      refresh();
      setSelectedId(created.id);
    } catch (e: any) {
      message.error(e?.message || '创建失败');
    }
  };

  // 标记 4 等份固定完成
  const onMarkFixed = async () => {
    if (!selectedId) return;
    await updateAssembly(selectedId, { status: 'fixed', hub_assembled: true, hub_barrel_assembled: true });
    message.success('已标记 4 等份固定完成');
    refresh();
  };

  // 提交同心度检测
  const onSubmitCheck = async () => {
    if (!selectedId) {
      message.warning('请先选择一个总装记录');
      return;
    }
    try {
      const v = await checkForm.validateFields();
      const res = await createCheck({
        assembly_id: selectedId,
        dial_1_value: v.dial_1_value,
        dial_2_value: v.dial_2_value,
        dial_3_value: v.dial_3_value,
        tolerance_mm: v.tolerance_mm ?? TOLERANCE_DEFAULT,
        remarks: v.remarks,
      });
      if (res.is_qualified) {
        message.success(`合格!极差 ${res.max_deviation_mm}mm ≤ ${res.tolerance_mm}mm`);
      } else {
        message.error(`不合格!极差 ${res.max_deviation_mm}mm > ${res.tolerance_mm}mm`);
      }
      checkForm.resetFields();
      refresh();
    } catch (e: any) {
      message.error(e?.message || '提交失败');
    }
  };

  return (
    <ListPageTemplate>
      <Title level={3} style={{ marginTop: 0 }}>
        <IconifyIcon icon="solar:wheel-bold-duotone" width={28} height={28} style={{ marginRight: 8, verticalAlign: '-0.2em' }} />
        {t('app.spoke-wheel.menu.assembly-debug')}
      </Title>
      <Text type="secondary">
        4 等份固定 → 3 百分表调试(同心度 ≤ 0.8mm) → 穿钢丝弹头 → 包装入库
      </Text>

      <Row gutter={16} style={{ marginTop: 16 }}>
        {/* 左:总装记录列表 + 新建 */}
        <Col span={10}>
          <Card title="总装记录" size="small" extra={
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={onCreate}>
              新建总装
            </Button>
          }>
            <Form form={createForm} layout="inline" style={{ marginBottom: 12 }}>
              <Form.Item name="remarks" style={{ flex: 1, marginRight: 8 }}>
                <Input placeholder="备注(可选)" allowClear />
              </Form.Item>
            </Form>
            <Table<SpokeWheelAssembly>
              size="small"
              loading={isLoading}
              rowKey="id"
              dataSource={assemblies || []}
              pagination={false}
              scroll={{ y: 380 }}
              onRow={(record) => ({
                onClick: () => setSelectedId(record.id),
                style: { cursor: 'pointer', background: selectedId === record.id ? '#e6f4ff' : undefined },
              })}
              columns={[
                { title: '单号', dataIndex: 'code', width: 150 },
                {
                  title: '状态', dataIndex: 'status', width: 80,
                  render: (s: string) => <Tag color={s === 'qc_passed' ? 'green' : s === 'qc_failed' ? 'red' : 'blue'}>{s}</Tag>,
                },
                { title: '极差', dataIndex: 'final_max_deviation_mm', width: 70, render: (v) => v ? `${v}mm` : '-' },
                { title: '创建', dataIndex: 'created_at', width: 130, render: (v) => v?.slice(5, 16) },
              ]}
            />
          </Card>
        </Col>

        {/* 右:当前总装详情 + 同心度检测 */}
        <Col span={14}>
          {!selected ? (
            <Card><Result title="请选择左侧总装记录" icon={<ToolOutlined />} /></Card>
          ) : (
            <>
              <Card size="small" title={`总装 ${selected.code}`} style={{ marginBottom: 16 }}>
                <Row gutter={16}>
                  <Col span={6}><Statistic title="状态" value={selected.status} styles={{ content: { fontSize: 14 } }} /></Col>
                  <Col span={6}><Statistic title="百分表数" value={selected.fixture_dial_count} /></Col>
                  <Col span={6}><Statistic title="最终极差" value={selected.final_max_deviation_mm ?? '-'} suffix={selected.final_max_deviation_mm ? 'mm' : ''} /></Col>
                  <Col span={6}>
                    <Statistic
                      title="判定"
                      value={selected.final_qc_passed == null ? '待测' : (selected.final_qc_passed ? '合格' : '不合格')}
                      styles={{
                        content: {
                          color: selected.final_qc_passed ? '#3f8600' : selected.final_qc_passed === false ? '#cf1322' : undefined,
                          fontSize: 18,
                        },
                      }}
                      prefix={selected.final_qc_passed ? <CheckCircleOutlined /> : selected.final_qc_passed === false ? <CloseCircleOutlined /> : null}
                    />
                  </Col>
                </Row>
                {selected.status === 'draft' && (
                  <Button type="primary" onClick={onMarkFixed} style={{ marginTop: 12 }}>
                    标记 4 等份固定完成
                  </Button>
                )}
              </Card>

              <Card size="small" title="3 百分表同心度检测">
                <Form form={checkForm} layout="vertical">
                  <Row gutter={16}>
                    <Col span={6}>
                      <Form.Item label="百分表 1 读数 (mm)" name="dial_1_value" rules={[{ required: true }]}>
                        <InputNumber step={0.01} min={0} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item label="百分表 2 读数 (mm)" name="dial_2_value" rules={[{ required: true }]}>
                        <InputNumber step={0.01} min={0} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item label="百分表 3 读数 (mm)" name="dial_3_value" rules={[{ required: true }]}>
                        <InputNumber step={0.01} min={0} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item label="允差 (mm)" name="tolerance_mm" initialValue={TOLERANCE_DEFAULT}>
                        <InputNumber step={0.1} min={0} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>

                  {livePreview && (
                    <Card size="small" style={{ background: livePreview.qualified ? '#f6ffed' : '#fff1f0', marginBottom: 12 }}>
                      <Row gutter={16}>
                        <Col span={8}>
                          <Statistic title="极差 (max-min)" value={livePreview.dev} suffix="mm" />
                        </Col>
                        <Col span={8}>
                          <Statistic title="允差" value={livePreview.tol} suffix="mm" />
                        </Col>
                        <Col span={8}>
                          <Statistic
                            title="预览判定"
                            value={livePreview.qualified ? '合格' : '不合格'}
                            styles={{ content: { color: livePreview.qualified ? '#3f8600' : '#cf1322' } }}
                            prefix={livePreview.qualified ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                          />
                        </Col>
                      </Row>
                    </Card>
                  )}

                  <Form.Item label="备注" name="remarks">
                    <Input.TextArea rows={2} placeholder="返工/调整说明" />
                  </Form.Item>

                  <Button type="primary" size="large" icon={<AimOutlined />} onClick={onSubmitCheck} block>
                    提交同心度检测
                  </Button>
                </Form>
              </Card>

              {checks && checks.length > 0 && (
                <Card size="small" title={`检测历史 (${checks.length} 次)`} style={{ marginTop: 16 }}>
                  <Table<ConcentricityCheck>
                    size="small"
                    rowKey="id"
                    dataSource={checks}
                    pagination={false}
                    columns={[
                      { title: '时间', dataIndex: 'created_at', width: 140, render: (v) => v?.slice(5, 16) },
                      { title: '读数 1', dataIndex: 'dial_1_value', width: 70 },
                      { title: '读数 2', dataIndex: 'dial_2_value', width: 70 },
                      { title: '读数 3', dataIndex: 'dial_3_value', width: 70 },
                      { title: '极差', dataIndex: 'max_deviation_mm', width: 70, render: (v) => `${v}mm` },
                      { title: '允差', dataIndex: 'tolerance_mm', width: 70, render: (v) => `${v}mm` },
                      {
                        title: '判定', dataIndex: 'is_qualified', width: 80,
                        render: (q: boolean, r) => (
                          <Tag color={q ? 'green' : 'red'} icon={q ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>
                            {q ? `合格` : `不合格(${r.max_deviation_mm}mm > ${r.tolerance_mm}mm)`}
                          </Tag>
                        ),
                      },
                      { title: '录入人', dataIndex: 'inspector_name', width: 100 },
                    ]}
                  />
                </Card>
              )}
            </>
          )}
        </Col>
      </Row>
    </ListPageTemplate>
  );
}
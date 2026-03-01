/**
 * 工单详情 - 真实 API，支持开工/报工
 */
import React, { useEffect, useState } from 'react';
import { View, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { List, Button, WhiteSpace, WingBlank, Steps, Modal, Toast } from '@ant-design/react-native';
import {
  getWorkOrderDetail,
  getWorkOrderOperations,
  startOperation,
  WorkOrder,
  WorkOrderOperation,
} from '../../src/services/workOrderService';

const Item = List.Item;
const Brief = Item.Brief;
const Step = Steps.Step;

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    pending: '待开工',
    in_progress: '进行中',
    completed: '已完成',
  };
  return map[s] || s;
}

export default function WorkOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [operations, setOperations] = useState<WorkOrderOperation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [wo, ops] = await Promise.all([
          getWorkOrderDetail(Number(id)),
          getWorkOrderOperations(Number(id)),
        ]);
        setWorkOrder(wo);
        setOperations(ops || []);
      } catch {
        Toast.fail('获取工单详情失败');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleStart = () => {
    const pendingOp = operations.find((o) => o.status === 'pending');
    if (!pendingOp) {
      Toast.info('没有待开工的工序');
      return;
    }
    Modal.alert('确认', `确定开始工序「${pendingOp.operation_name}」吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '确定',
        onPress: async () => {
          try {
            await startOperation(Number(id), pendingOp.operation_id);
            Toast.success('工序已开工');
            const [wo, ops] = await Promise.all([
              getWorkOrderDetail(Number(id)),
              getWorkOrderOperations(Number(id)),
            ]);
            setWorkOrder(wo);
            setOperations(ops || []);
          } catch (e: any) {
            Toast.fail(e?.response?.data?.detail || e?.message || '开工失败');
          }
        },
      },
    ]);
  };

  const handleReport = () => {
    const reportableOp = operations.find((o) => o.status === 'in_progress' || o.status === 'pending');
    if (!reportableOp) {
      Toast.info('请先开始工序');
      return;
    }
    router.push({
      pathname: '/mes/report',
      params: {
        workOrderId: id,
        workOrderCode: workOrder?.code || '',
        workOrderName: workOrder?.name || workOrder?.product_name || '',
        operationId: String(reportableOp.operation_id),
        operationCode: reportableOp.operation_code,
        operationName: reportableOp.operation_name,
      },
    } as any);
  };

  if (loading || !workOrder) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f9' }}>
        <ActivityIndicator size="large" color="#1677ff" />
      </View>
    );
  }

  const woStatus = workOrder.status;
  const canStart = woStatus === 'released' || woStatus === 'in_progress';
  const pendingOp = operations.find((o) => o.status === 'pending');
  const inProgressOp = operations.find((o) => o.status === 'in_progress');

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f5f9' }}>
      <ScrollView>
        <List renderHeader="基本信息">
          <Item extra={woStatus === 'draft' ? '草稿' : woStatus === 'released' ? '已下达' : woStatus === 'in_progress' ? '进行中' : woStatus === 'completed' ? '已完成' : woStatus}>
            状态
          </Item>
          <Item extra={workOrder.priority}>优先级</Item>
          <Item extra={workOrder.workshop_name || '-'}>车间</Item>
        </List>

        <List renderHeader="产品信息">
          <Item multipleLine>
            {workOrder.product_name}
            <Brief>{workOrder.product_code}</Brief>
          </Item>
          <Item extra={`${workOrder.completed_quantity} / ${workOrder.planned_quantity}`}>完成进度</Item>
        </List>

        {operations.length > 0 && (
          <View style={{ marginTop: 20, paddingHorizontal: 15, backgroundColor: '#fff', paddingVertical: 20 }}>
            <Steps direction="vertical" size="small">
              {operations.map((op, idx) => {
                const st = op.status === 'completed' ? 'finish' : op.status === 'in_progress' ? 'process' : 'wait';
                return (
                  <Step
                    key={op.id}
                    title={op.operation_name}
                    description={statusLabel(op.status)}
                    status={st as any}
                  />
                );
              })}
            </Steps>
          </View>
        )}

        <WhiteSpace size="xl" />
      </ScrollView>

      <View style={{ backgroundColor: '#fff', padding: 10, borderTopWidth: 1, borderTopColor: '#ddd' }}>
        <WingBlank>
          {pendingOp && canStart ? (
            <Button type="primary" onPress={handleStart}>
              开工（{pendingOp.operation_name}）
            </Button>
          ) : workOrder.status === 'completed' ? (
            <Button disabled>工单已完成</Button>
          ) : (
            <Button type="primary" onPress={handleReport}>
              生产报工
            </Button>
          )}
        </WingBlank>
      </View>
    </View>
  );
}

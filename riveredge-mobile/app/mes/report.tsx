/**
 * 报工录入 - 对接真实报工 API
 */
import React, { useState, useEffect } from 'react';
import { View, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { List, InputItem, TextareaItem, Button, WhiteSpace, WingBlank, Toast } from '@ant-design/react-native';
import { createReporting } from '../../src/services/reportingService';
import { getStoredUser } from '../../src/services/authService';

export default function ReportScreen() {
  const params = useLocalSearchParams<{
    workOrderId: string;
    workOrderCode: string;
    workOrderName: string;
    operationId: string;
    operationCode: string;
    operationName: string;
  }>();

  const [qualifiedQty, setQualifiedQty] = useState('');
  const [unqualifiedQty, setUnqualifiedQty] = useState('');
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [workerId, setWorkerId] = useState<number>(0);
  const [workerName, setWorkerName] = useState('操作员');

  useEffect(() => {
    (async () => {
      const user = await getStoredUser();
      if (user) {
        setWorkerId(user.id);
        setWorkerName(user.full_name || user.username || '操作员');
      }
    })();
  }, []);

  const handleSubmit = async () => {
    const q = parseInt(qualifiedQty || '0', 10);
    const u = parseInt(unqualifiedQty || '0', 10);
    if (q + u <= 0) {
      Toast.fail('请输入合格或不良数量');
      return;
    }
    if (!params?.workOrderId || !params?.operationId) {
      Toast.fail('缺少工单或工序信息');
      return;
    }

    setLoading(true);
    try {
      await createReporting({
        work_order_id: parseInt(params.workOrderId, 10),
        work_order_code: params.workOrderCode || '',
        work_order_name: params.workOrderName || '',
        operation_id: parseInt(params.operationId, 10),
        operation_code: params.operationCode || '',
        operation_name: params.operationName || '',
        worker_id: workerId || 0,
        worker_name: workerName,
        reported_quantity: q + u,
        qualified_quantity: q,
        unqualified_quantity: u,
        work_hours: 0,
        remarks: remarks.trim() || undefined,
      });
      Toast.success('报工成功');
      router.back();
    } catch (e: any) {
      Toast.fail(e?.response?.data?.detail || e?.message || '报工失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f5f9' }}>
        <ScrollView>
          <List renderHeader={`工单 ${params?.workOrderCode} · ${params?.operationName}`}>
            <InputItem
              type="number"
              value={qualifiedQty}
              onChange={setQualifiedQty}
              placeholder="0"
              clear
            >
              合格数量
            </InputItem>
            <InputItem
              type="number"
              value={unqualifiedQty}
              onChange={setUnqualifiedQty}
              placeholder="0"
              clear
            >
              不良数量
            </InputItem>
            <TextareaItem
              rows={4}
              placeholder="备注信息"
              value={remarks}
              onChange={(val) => setRemarks(val ?? '')}
              count={100}
            />
          </List>
        </ScrollView>

        <View style={{ padding: 15, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee' }}>
          <WingBlank>
            <Button type="primary" onPress={handleSubmit} loading={loading}>
              提交报工
            </Button>
          </WingBlank>
        </View>
      </View>
  );
}

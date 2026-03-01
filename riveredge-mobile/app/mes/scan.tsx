/**
 * 扫码报工 - 相机扫码或输入工单编码，选择工序后跳转报工录入
 */
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { List, InputItem, Button, WhiteSpace, WingBlank, Toast } from '@ant-design/react-native';
import { Icon } from '@ant-design/react-native';
import { getWorkOrders, getWorkOrderOperations, WorkOrder, WorkOrderOperation } from '../../src/services/workOrderService';
import { BarcodeScanner } from '../../src/components/BarcodeScanner';

export default function ScanScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const [inputCode, setInputCode] = useState(params?.code || '');
  const [loading, setLoading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [operations, setOperations] = useState<WorkOrderOperation[]>([]);
  const [selectedOp, setSelectedOp] = useState<WorkOrderOperation | null>(null);

  const handleSearch = useCallback(async (codeArg?: string) => {
    const code = (codeArg ?? inputCode).trim();
    if (!code) {
      Toast.fail('请输入工单编码');
      return;
    }
    setInputCode(code);
    setShowCamera(false);
    setLoading(true);
    setWorkOrder(null);
    setOperations([]);
    setSelectedOp(null);
    try {
      const res = await getWorkOrders({ code, limit: 5 });
      const list = res?.data || [];
      if (list.length === 0) {
        Toast.fail('未找到该工单');
        return;
      }
      const wo = list[0];
      setWorkOrder(wo);
      const ops = await getWorkOrderOperations(wo.id);
      setOperations(ops || []);
      const pending = (ops || []).find((o: any) => o.status !== 'completed');
      if (pending) setSelectedOp(pending);
      else if (ops?.length) setSelectedOp(ops[0]);
    } catch (e: any) {
      Toast.fail(e?.message || '获取工单失败');
    } finally {
      setLoading(false);
    }
  }, [inputCode]);

  const handleReport = () => {
    if (!workOrder || !selectedOp) {
      Toast.fail('请选择工序');
      return;
    }
    router.push({
      pathname: '/mes/report',
      params: {
        workOrderId: String(workOrder.id),
        workOrderCode: workOrder.code,
        workOrderName: workOrder.name || workOrder.product_name,
        operationId: String(selectedOp.operation_id),
        operationCode: selectedOp.operation_code,
        operationName: selectedOp.operation_name,
      },
    } as any);
  };

  return (
    <View style={styles.container}>
      {showCamera && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <BarcodeScanner
            onScan={(code) => handleSearch(code)}
            onClose={() => setShowCamera(false)}
          />
        </View>
      )}
      <WingBlank size="lg">
        <WhiteSpace size="lg" />
        <TouchableOpacity
          style={styles.scanBtn}
          onPress={() => setShowCamera(true)}
          activeOpacity={0.8}
        >
          <Icon name="scan" size={24} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.scanBtnText}>
            {Platform.OS === 'web' ? '模拟扫码（Web 调试）' : '打开相机扫码'}
          </Text>
        </TouchableOpacity>
        <WhiteSpace size="md" />
        <List renderHeader="或输入工单编码">
            <InputItem
              clear
              value={inputCode}
              onChange={setInputCode}
              placeholder="扫描或输入工单编码"
              onSubmitEditing={() => handleSearch()}
              style={styles.input}
            />
          </List>
          <WhiteSpace size="md" />
          <Button type="primary" onPress={() => handleSearch()} loading={loading} style={styles.searchBtn}>
            查询工单
          </Button>

          {loading && (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#1677ff" />
            </View>
          )}

          {workOrder && !loading && (
            <>
              <WhiteSpace size="xl" />
              <List renderHeader={`工单：${workOrder.code}`}>
                <List.Item extra={workOrder.product_name}>产品</List.Item>
                <List.Item extra={`${workOrder.completed_quantity} / ${workOrder.planned_quantity}`}>
                  进度
                </List.Item>
              </List>

              {operations.length > 0 && (
                <>
                  <WhiteSpace size="lg" />
                  <Text style={styles.sectionTitle}>选择工序</Text>
                  {operations.map((op) => (
                    <TouchableOpacity
                      key={op.id}
                      style={[styles.opItem, selectedOp?.id === op.id && styles.opItemSelected]}
                      onPress={() => setSelectedOp(op)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.opRow}>
                        <View
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 10,
                            borderWidth: 2,
                            borderColor: selectedOp?.id === op.id ? '#1890ff' : '#999',
                            backgroundColor: selectedOp?.id === op.id ? '#1890ff' : 'transparent',
                          }}
                        />
                        <View style={styles.opInfo}>
                          <Text style={styles.opName}>{op.operation_name}</Text>
                          <Text style={styles.opMeta}>
                            {op.operation_code} · {op.status === 'completed' ? '已完成' : '待报工'}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}

                  <WhiteSpace size="xl" />
                  <Button
                    type="primary"
                    onPress={handleReport}
                    disabled={!selectedOp}
                    style={styles.reportBtn}
                  >
                    去报工
                  </Button>
                </>
              )}
            </>
          )}
      </WingBlank>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f9' },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#52c41a',
    paddingVertical: 14,
    borderRadius: 12,
  },
  scanBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  input: { fontSize: 16 },
  searchBtn: { marginTop: 8 },
  loadingWrap: { padding: 40, alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 12, marginLeft: 4 },
  opItem: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  opItemSelected: { borderColor: '#1677ff', backgroundColor: '#e6f4ff' },
  opRow: { flexDirection: 'row', alignItems: 'center' },
  opInfo: { marginLeft: 12, flex: 1 },
  opName: { fontSize: 16, fontWeight: '500', color: '#333' },
  opMeta: { fontSize: 12, color: '#999', marginTop: 4 },
  reportBtn: { marginBottom: 24 },
});

/**
 * 执行检验 - 录入合格/不良数量，支持过程/来料/成品检验
 */
import React, { useState, useEffect } from 'react';
import { View, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { List, InputItem, Button, WhiteSpace, WingBlank, Toast } from '@ant-design/react-native';
import {
  getProcessInspection,
  conductProcessInspection,
  getIncomingInspection,
  conductIncomingInspection,
  getFinishedGoodsInspection,
  conductFinishedGoodsInspection,
} from '../../src/services/qualityService';

export default function ConductScreen() {
  const params = useLocalSearchParams<{ id: string; type: 'process' | 'incoming' | 'finished' }>();
  const [qualifiedQty, setQualifiedQty] = useState('');
  const [unqualifiedQty, setUnqualifiedQty] = useState('');
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('执行检验');
  const [inspectionQty, setInspectionQty] = useState(0);

  useEffect(() => {
    (async () => {
      const id = parseInt(params?.id || '0', 10);
      const type = params?.type || 'process';
      if (!id) return;
      try {
        if (type === 'process') {
          const d = await getProcessInspection(id);
          setTitle(`${d.inspection_code} · ${d.operation_name}`);
          setInspectionQty(d.inspection_quantity);
        } else if (type === 'incoming') {
          const d = await getIncomingInspection(id);
          setTitle(d.inspection_code);
          setInspectionQty(d.inspection_quantity ?? 0);
        } else {
          const d = await getFinishedGoodsInspection(id);
          setTitle(d.inspection_code);
          setInspectionQty(d.inspection_quantity ?? 0);
        }
      } catch {
        Toast.fail('获取检验单失败');
      }
    })();
  }, [params?.id, params?.type]);

  const handleSubmit = async () => {
    const q = parseFloat(qualifiedQty || '0');
    const u = parseFloat(unqualifiedQty || '0');
    if (q + u <= 0) {
      Toast.fail('请输入合格或不良数量');
      return;
    }
    const id = parseInt(params?.id || '0', 10);
    const type = params?.type || 'process';
    if (!id) {
      Toast.fail('缺少检验单信息');
      return;
    }

    setLoading(true);
    try {
      const data = { qualified_quantity: q, unqualified_quantity: u };
      if (type === 'process') {
        await conductProcessInspection(id, data);
      } else if (type === 'incoming') {
        await conductIncomingInspection(id, data);
      } else {
        await conductFinishedGoodsInspection(id, data);
      }
      Toast.success('检验完成');
      router.back();
    } catch (e: any) {
      Toast.fail(e?.response?.data?.detail || e?.message || '提交失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f5f9' }}>
      <ScrollView>
        <List renderHeader={title}>
          <List.Item extra={`检验数量: ${inspectionQty}`}>计划数量</List.Item>
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
        </List>
      </ScrollView>
      <View style={{ padding: 15, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee' }}>
        <WingBlank>
          <Button type="primary" onPress={handleSubmit} loading={loading}>
            提交检验
          </Button>
        </WingBlank>
      </View>
    </View>
  );
}

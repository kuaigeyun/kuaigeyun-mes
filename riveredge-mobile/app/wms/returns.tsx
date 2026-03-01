/**
 * 生产退料单列表 - 待确认退料
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Icon } from '@ant-design/react-native';
import {
  getProductionReturns,
  confirmProductionReturn,
  ProductionReturn,
} from '../../src/services/warehouseService';
import { Toast } from '@ant-design/react-native';

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    待退料: '待退料',
    已退料: '已退料',
    已取消: '已取消',
  };
  return map[s] || s;
}

export default function ReturnsScreen() {
  const [list, setList] = useState<ProductionReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | undefined>('待退料');

  const load = useCallback(async () => {
    try {
      const res = await getProductionReturns({
        status: statusFilter,
        limit: 50,
      });
      setList(res || []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleConfirm = (item: ProductionReturn) => {
    if (item.status !== '待退料') {
      Toast.fail('只有待退料状态才能确认');
      return;
    }
    Alert.alert('确认退料', `确认退料单 ${item.return_code}？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '确认',
        onPress: async () => {
          try {
            await confirmProductionReturn(item.id);
            Toast.success('退料确认成功');
            load();
          } catch (e: any) {
            Toast.fail(e?.response?.data?.detail || e?.message || '确认失败');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        {['待退料', undefined].map((s) => (
          <TouchableOpacity
            key={s || 'all'}
            style={[styles.tab, statusFilter === s && styles.tabActive]}
            onPress={() => setStatusFilter(s)}
          >
            <Text style={[styles.tabText, statusFilter === s && styles.tabTextActive]}>
              {s || '全部'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView
        style={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1677ff']} />
        }
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#1677ff" />
          </View>
        ) : list.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Icon name="rollback" size={48} color="#d9d9d9" />
            <Text style={styles.emptyText}>暂无退料单</Text>
          </View>
        ) : (
          list.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardRow}>
                <Text style={styles.cardTitle}>{item.return_code}</Text>
                <Text style={[styles.cardStatus, item.status === '待退料' && styles.cardStatusPending]}>
                  {statusLabel(item.status)}
                </Text>
              </View>
              {item.work_order_code && (
                <Text style={styles.cardMeta}>工单: {item.work_order_code}</Text>
              )}
              {item.picking_code && (
                <Text style={styles.cardMeta}>领料单: {item.picking_code}</Text>
              )}
              {item.status === '待退料' && (
                <TouchableOpacity
                  style={styles.confirmBtn}
                  onPress={() => handleConfirm(item)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.confirmBtnText}>确认退料</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 12 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#1677ff' },
  tabText: { fontSize: 14, color: '#666' },
  tabTextActive: { color: '#1677ff', fontWeight: '600' },
  scroll: { flex: 1 },
  loadingWrap: { padding: 60, alignItems: 'center' },
  emptyWrap: { padding: 60, alignItems: 'center' },
  emptyText: { marginTop: 12, fontSize: 14, color: '#999' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    margin: 12,
    marginTop: 8,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  cardStatus: { fontSize: 12, color: '#999' },
  cardStatusPending: { color: '#faad14' },
  cardMeta: { fontSize: 14, color: '#666', marginTop: 6 },
  confirmBtn: {
    marginTop: 12,
    backgroundColor: '#1677ff',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});

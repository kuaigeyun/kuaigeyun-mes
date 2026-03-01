/**
 * 质量检验 - 入口与检验单列表
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
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Icon } from '@ant-design/react-native';
import {
  getProcessInspections,
  getIncomingInspections,
  getFinishedGoodsInspections,
  ProcessInspection,
  IncomingInspection,
  FinishedGoodsInspection,
} from '../../src/services/qualityService';

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    待检验: '待检验',
    已检验: '已检验',
    待审核: '待审核',
    已审核: '已审核',
  };
  return map[s] || s;
}

export default function QualityIndexScreen() {
  const [processList, setProcessList] = useState<ProcessInspection[]>([]);
  const [incomingList, setIncomingList] = useState<IncomingInspection[]>([]);
  const [finishedList, setFinishedList] = useState<FinishedGoodsInspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'process' | 'incoming' | 'finished'>('process');

  const load = useCallback(async () => {
    try {
      const [p, i, f] = await Promise.all([
        getProcessInspections({ status: '待检验', limit: 50 }),
        getIncomingInspections({ status: '待检验', limit: 50 }),
        getFinishedGoodsInspections({ status: '待检验', limit: 50 }),
      ]);
      setProcessList(p || []);
      setIncomingList(i || []);
      setFinishedList(f || []);
    } catch {
      setProcessList([]);
      setIncomingList([]);
      setFinishedList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const goToConduct = (id: number, type: 'process' | 'incoming' | 'finished') => {
    router.push({ pathname: '/quality/conduct', params: { id: String(id), type } } as any);
  };

  return (
    <View style={styles.container}>
      {/* 过程检验扫码入口 */}
      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={() => router.push('/quality/process-scan' as any)}
        activeOpacity={0.85}
      >
        <Icon name="scan" size={24} color="#fff" style={{ marginRight: 10 }} />
        <Text style={styles.primaryBtnText}>过程检验扫码</Text>
      </TouchableOpacity>

      {/* Tab 切换 */}
      <View style={styles.tabs}>
        {(['process', 'incoming', 'finished'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, activeTab === t && styles.tabActive]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {t === 'process' ? '过程检验' : t === 'incoming' ? '来料检验' : '成品检验'}
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
        ) : (
          <>
            {activeTab === 'process' && (
              <View style={styles.list}>
                {processList.length === 0 ? (
                  <Text style={styles.emptyText}>暂无待检验的过程检验单</Text>
                ) : (
                  processList.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.card}
                      onPress={() => goToConduct(item.id, 'process')}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.cardTitle}>{item.inspection_code}</Text>
                      <Text style={styles.cardMeta}>
                        {item.work_order_code} · {item.operation_name}
                      </Text>
                      <Text style={styles.cardMeta}>{item.material_name}</Text>
                      <Text style={styles.cardStat}>
                        检验数量: {item.inspection_quantity} | {statusLabel(item.status)}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
            {activeTab === 'incoming' && (
              <View style={styles.list}>
                {incomingList.length === 0 ? (
                  <Text style={styles.emptyText}>暂无待检验的来料检验单</Text>
                ) : (
                  incomingList.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.card}
                      onPress={() => goToConduct(item.id, 'incoming')}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.cardTitle}>{item.inspection_code}</Text>
                      <Text style={styles.cardMeta}>{item.material_name || item.material_code}</Text>
                      <Text style={styles.cardStat}>
                        检验数量: {item.inspection_quantity ?? 0} | {statusLabel(item.status)}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
            {activeTab === 'finished' && (
              <View style={styles.list}>
                {finishedList.length === 0 ? (
                  <Text style={styles.emptyText}>暂无待检验的成品检验单</Text>
                ) : (
                  finishedList.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.card}
                      onPress={() => goToConduct(item.id, 'finished')}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.cardTitle}>{item.inspection_code}</Text>
                      <Text style={styles.cardMeta}>
                        {item.work_order_code || ''} · {item.material_name || item.material_code}
                      </Text>
                      <Text style={styles.cardStat}>
                        检验数量: {item.inspection_quantity ?? 0} | {statusLabel(item.status)}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1677ff',
    borderRadius: 8,
    paddingVertical: 14,
    margin: 16,
    marginBottom: 8,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 12 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#1677ff' },
  tabText: { fontSize: 14, color: '#666' },
  tabTextActive: { color: '#1677ff', fontWeight: '600' },
  scroll: { flex: 1 },
  loadingWrap: { padding: 60, alignItems: 'center' },
  list: { padding: 12, paddingBottom: 40 },
  emptyText: { textAlign: 'center', color: '#999', padding: 40, fontSize: 14 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 6 },
  cardMeta: { fontSize: 14, color: '#666', marginBottom: 4 },
  cardStat: { fontSize: 12, color: '#999', marginTop: 4 },
});

/**
 * 工单列表 - 真实 API，支持筛选
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Card, WhiteSpace, WingBlank, Tag, Flex } from '@ant-design/react-native';
import { getWorkOrders, getDelayedWorkOrders, WorkOrder } from '../../src/services/workOrderService';
import { getStoredUser } from '../../src/services/authService';

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    draft: '草稿',
    released: '已下达',
    in_progress: '进行中',
    completed: '已完成',
    cancelled: '已取消',
  };
  return map[s] || s;
}

export default function MESWorkOrderList() {
  const params = useLocalSearchParams<{ status?: string; my?: string }>();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      if (params?.status === 'overdue') {
        const list = await getDelayedWorkOrders();
        setWorkOrders(list);
        return;
      }

      let status: string | undefined;
      if (params?.status === 'in_progress') status = 'in_progress';
      else if (params?.status === 'completed') status = 'completed';

      let assigned_worker_id: number | undefined;
      if (params?.my === '1') {
        const user = await getStoredUser();
        if (user?.id) assigned_worker_id = user.id;
      }

      const res = await getWorkOrders({
        skip: 0,
        limit: 50,
        status,
        assigned_worker_id,
      });
      setWorkOrders(res?.data || []);
    } catch {
      setWorkOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [params?.status, params?.my]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  if (loading && workOrders.length === 0) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#1890ff" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1890ff']} />}
    >
      <View style={{ paddingBottom: 20 }}>
        {workOrders.map((item) => (
          <View key={item.id}>
            <WhiteSpace size="lg" />
            <WingBlank size="lg">
              <TouchableOpacity activeOpacity={0.9} onPress={() => router.push({ pathname: '/mes/work-order-detail', params: { id: item.id } } as any)}>
              <Card full>
                <Card.Header
                  title={item.code}
                  extra={<Tag small>{statusLabel(item.status)}</Tag>}
                />
                <Card.Body>
                  <View style={{ padding: 10 }}>
                    <Flex justify="between" style={{ marginBottom: 6 }}>
                      <View><Tag disabled>{item.product_code}</Tag></View>
                      <View><Tag disabled>{item.priority === 'high' ? '高优先级' : '普通'}</Tag></View>
                    </Flex>
                    <View style={{ marginBottom: 6 }}>
                      <Tag>{item.product_name}</Tag>
                    </View>
                    <Flex style={{ marginTop: 10 }}>
                      <Flex.Item style={{ paddingRight: 4 }}>
                        <View style={styles.statItem}>
                          <View style={styles.statLabel}><Tag small>计划</Tag></View>
                          <View><Text style={styles.statValue}>{item.planned_quantity}</Text></View>
                        </View>
                      </Flex.Item>
                      <Flex.Item style={{ paddingLeft: 4 }}>
                        <View style={styles.statItem}>
                          <View style={styles.statLabel}><Tag small>完成</Tag></View>
                          <View><Text style={styles.statValue}>{item.completed_quantity}</Text></View>
                        </View>
                      </Flex.Item>
                    </Flex>
                  </View>
                </Card.Body>
                <Card.Footer
                  content={`计划: ${item.planned_start_date || '-'}`}
                  extra={item.workshop_name || ''}
                />
              </Card>
              </TouchableOpacity>
            </WingBlank>
          </View>
        ))}
        {!loading && workOrders.length === 0 && (
          <View style={[styles.container, styles.center, { paddingTop: 60 }]}>
            <Tag>暂无工单</Tag>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f9' },
  center: { justifyContent: 'center', alignItems: 'center' },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8f8f8',
    padding: 8,
    borderRadius: 4,
  },
  statLabel: { marginRight: 8 },
  statValue: { fontWeight: 'bold' as const, fontSize: 14 },
});

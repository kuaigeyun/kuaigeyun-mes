/**
 * 仓储领料 - 入口：领料单、入库单、退料单
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '@ant-design/react-native';

export default function WMSIndexScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.cardRow}>
        <TouchableOpacity
          style={styles.entryCard}
          onPress={() => router.push('/wms/pickings' as any)}
          activeOpacity={0.8}
        >
          <Icon name="export" size={40} color="#1677ff" />
          <Text style={styles.entryTitle}>生产领料</Text>
          <Text style={styles.entryDesc}>领料单列表、确认领料</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.entryCard}
          onPress={() => router.push('/wms/receipts' as any)}
          activeOpacity={0.8}
        >
          <Icon name="inbox" size={40} color="#52c41a" />
          <Text style={styles.entryTitle}>成品入库</Text>
          <Text style={styles.entryDesc}>入库单列表、确认入库</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={styles.entryCardFull}
        onPress={() => router.push('/wms/returns' as any)}
        activeOpacity={0.8}
      >
        <Icon name="rollback" size={40} color="#faad14" />
        <Text style={styles.entryTitle}>生产退料</Text>
        <Text style={styles.entryDesc}>退料单列表、确认退料</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16, paddingBottom: 40 },
  cardRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  entryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    minHeight: 140,
    justifyContent: 'center',
  },
  entryTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginTop: 12 },
  entryDesc: { fontSize: 12, color: '#999', marginTop: 6 },
  entryCardFull: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    minHeight: 140,
    justifyContent: 'center',
  },
});

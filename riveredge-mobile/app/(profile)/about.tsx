/**
 * 关于我们 - 占位页
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function AboutScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>快格轻制造</Text>
        <Text style={styles.subtitle}>车间移动工作台</Text>
        <Text style={styles.version}>版本 1.0.0</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 20 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 24,
    alignItems: 'center',
  },
  title: { fontSize: 20, fontWeight: '600', color: '#333' },
  subtitle: { fontSize: 14, color: '#666', marginTop: 8 },
  version: { fontSize: 12, color: '#999', marginTop: 16 },
});

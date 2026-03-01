/**
 * 异常上报 - 占位页
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from '@ant-design/react-native';

export default function ExceptionScreen() {
  return (
    <View style={styles.container}>
      <Icon name="warning" size={64} color="#d9d9d9" />
      <Text style={styles.title}>异常上报</Text>
      <Text style={styles.desc}>功能开发中，敬请期待</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: { fontSize: 18, fontWeight: '600', color: '#333', marginTop: 16 },
  desc: { fontSize: 14, color: '#999', marginTop: 8 },
});

/**
 * 通用设置 - 占位页
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { List } from '@ant-design/react-native';

export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <List style={styles.list}>
        <List.Item>消息通知</List.Item>
        <List.Item>声音提醒</List.Item>
      </List>
      <Text style={styles.hint}>更多设置项敬请期待</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  list: { marginTop: 12 },
  hint: { textAlign: 'center', color: '#999', fontSize: 13, marginTop: 24 },
});

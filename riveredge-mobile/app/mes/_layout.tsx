import { Stack } from 'expo-router';

export default function MESLayout() {
  return (
    <Stack screenOptions={{ headerShown: true, headerBackTitle: '返回' }}>
      <Stack.Screen name="index" options={{ title: '工单列表', headerBackTitle: '工作台' }} />
      <Stack.Screen name="scan" options={{ title: '扫码报工' }} />
      <Stack.Screen name="report" options={{ title: '报工录入' }} />
      <Stack.Screen name="work-order-detail" options={{ title: '工单详情' }} />
    </Stack>
  );
}

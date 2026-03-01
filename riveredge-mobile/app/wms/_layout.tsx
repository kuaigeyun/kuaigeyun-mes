import { Stack } from 'expo-router';

export default function WMSLayout() {
  return (
    <Stack screenOptions={{ headerShown: true, headerBackTitle: '返回' }}>
      <Stack.Screen name="index" options={{ title: '仓储领料', headerBackTitle: '工作台' }} />
      <Stack.Screen name="pickings" options={{ title: '领料单列表' }} />
      <Stack.Screen name="receipts" options={{ title: '入库单列表' }} />
      <Stack.Screen name="returns" options={{ title: '退料单列表' }} />
    </Stack>
  );
}

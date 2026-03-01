import { Stack } from 'expo-router';

export default function QualityLayout() {
  return (
    <Stack screenOptions={{ headerShown: true, headerBackTitle: '返回' }}>
      <Stack.Screen name="index" options={{ title: '质量检验', headerBackTitle: '工作台' }} />
      <Stack.Screen name="process-scan" options={{ title: '过程检验扫码' }} />
      <Stack.Screen name="conduct" options={{ title: '执行检验' }} />
    </Stack>
  );
}

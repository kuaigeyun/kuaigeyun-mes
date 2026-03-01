import { Stack } from 'expo-router';

export default function PerformanceLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: '我的绩效', headerBackTitle: '工作台' }} />
    </Stack>
  );
}

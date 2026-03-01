import { Stack } from 'expo-router';

export default function ProfileLayout() {
  return (
    <Stack screenOptions={{ headerShown: true, headerBackTitle: '返回' }}>
      <Stack.Screen name="settings" options={{ title: '通用设置' }} />
      <Stack.Screen name="about" options={{ title: '关于我们' }} />
    </Stack>
  );
}

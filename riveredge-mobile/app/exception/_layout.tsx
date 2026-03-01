import { Stack } from 'expo-router';

export default function ExceptionLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: '异常上报', headerBackTitle: '工作台' }} />
    </Stack>
  );
}

import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View } from 'react-native';
import { Provider } from '@ant-design/react-native';
import zhCN from '@ant-design/react-native/lib/locale-provider/zh_CN';
import 'react-native-reanimated'; // Import reanimated

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    const [loaded, error] = useFonts({
        // Load Ant Design fonts locally to ensure web compatibility
        'antoutline': require('../assets/fonts/antoutline.ttf'),
        'antfill': require('../assets/fonts/antfill.ttf'),
    });

    useEffect(() => {
        if (loaded || error) {
            SplashScreen.hideAsync();
        }
    }, [loaded, error]);

    if (!loaded && !error) {
        return null;
    }

    return (
        <Provider locale={zhCN}>
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="+not-found" />
            </Stack>
        </Provider>
    );
}

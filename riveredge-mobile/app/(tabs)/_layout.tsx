import { Tabs } from 'expo-router';
import { Icon } from '@ant-design/react-native';

export default function TabLayout() {
    return (
        <Tabs screenOptions={{ tabBarActiveTintColor: '#1890ff', headerShown: false }}>
            <Tabs.Screen
                name="index"
                options={{
                    title: 'MES生产',
                    tabBarIcon: ({ color }) => <Icon name="appstore" size="md" color={color} />,
                }}
            />
            <Tabs.Screen
                name="message"
                options={{
                    title: '消息',
                    tabBarIcon: ({ color }) => <Icon name="message" size="md" color={color} />,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: '我的',
                    tabBarIcon: ({ color }) => <Icon name="user" size="md" color={color} />,
                }}
            />
        </Tabs>
    );
}

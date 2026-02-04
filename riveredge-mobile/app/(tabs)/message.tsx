import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function MessageScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.text}>消息中心</Text>
            <Text style={styles.subText}>暂无新消息</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    text: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    subText: {
        marginTop: 10,
        color: '#888',
    },
});

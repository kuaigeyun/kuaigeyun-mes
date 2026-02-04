import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { List, InputItem, TextareaItem, Button, WhiteSpace, WingBlank, Toast } from '@ant-design/react-native';

export default function ReportScreen() {
    const [goodQuantity, setGoodQuantity] = useState('');
    const [rejectQuantity, setRejectQuantity] = useState('');
    const [remarks, setRemarks] = useState('');

    const handleSubmit = () => {
        if (!goodQuantity && !rejectQuantity) {
            Toast.fail('请输入数量');
            return;
        }

        Toast.loading('提交中...', 1, () => {
            Toast.success('报工成功');
            router.back();
        });
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#f5f5f9' }}>
            <ScrollView>
                <List renderHeader={'报工录入'}>
                    <InputItem
                        type="number"
                        value={goodQuantity}
                        onChange={setGoodQuantity}
                        placeholder="0"
                        clear
                    >
                        合格数量
                    </InputItem>
                    <InputItem
                        type="number"
                        value={rejectQuantity}
                        onChange={setRejectQuantity}
                        placeholder="0"
                        clear
                    >
                        不良数量
                    </InputItem>
                    <TextareaItem
                        rows={4}
                        placeholder="备注信息"
                        value={remarks}
                        onChange={setRemarks}
                        count={100}
                    />
                </List>
            </ScrollView>

            <View style={{ padding: 15 }}>
                <WingBlank>
                    <Button type="primary" onPress={handleSubmit}>提交报工</Button>
                </WingBlank>
            </View>
        </View>
    );
}

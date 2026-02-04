import axios from 'axios';
import { Alert } from 'react-native';

// TODO: update with real backend URL
const BASE_URL = 'http://localhost:8000/api/v1';

const instance = axios.create({
    baseURL: BASE_URL,
    timeout: 10000,
});

// Request interceptor
instance.interceptors.request.use(
    (config) => {
        // TODO: Add token to header
        // const token = await SecureStore.getItemAsync('token');
        // if (token) {
        //   config.headers.Authorization = `Bearer ${token}`;
        // }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor
instance.interceptors.response.use(
    (response) => {
        return response.data;
    },
    (error) => {
        console.error('API Error:', error);
        Alert.alert('Error', error.response?.data?.detail || 'Network Error');
        return Promise.reject(error);
    }
);

export const apiRequest = async (url: string, options: any = {}) => {
    return instance({ url, ...options });
};

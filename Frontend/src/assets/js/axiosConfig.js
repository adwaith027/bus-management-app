import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Main API instance
const api = axios.create({
    baseURL: BASE_URL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    }
});

// Separate instance for refresh to avoid interceptor loops
const refreshApi = axios.create({
    baseURL: BASE_URL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    }
});

// Auto-refresh token on 401 errors
api.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        console.log(`API Error on ${originalRequest.url}:`, error.response?.status);
        
        // No need to retry these endpoints
        if (originalRequest.url?.includes('/token/refresh/') || 
            originalRequest.url?.includes('/verify-auth/') ||
            originalRequest.url?.includes('/login/') ||
            originalRequest.url?.includes('/signup/')) { 
            return Promise.reject(error);
        }

        // If 401 and haven't retried yet
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            
            try {
                console.log('Access token expired, refreshing...');
                
                // Use separate instance to avoid interceptor
                await refreshApi.post('/token/refresh/');
                
                console.log('Token refreshed, retrying request...');
                
                // Retry the original request
                return api(originalRequest);
                
            } catch (refreshError) {
                console.error('Token refresh failed, redirecting to login');
                localStorage.removeItem('user'); // Clear user data
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }
        
        return Promise.reject(error);
    }
);

export default api;
export { BASE_URL };
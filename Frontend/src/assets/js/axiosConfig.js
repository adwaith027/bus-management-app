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

        // No need to retry these endpoints
        if (originalRequest.url?.includes('/token/refresh') || 
            originalRequest.url?.includes('/login') ||
            originalRequest.url?.includes('/signup')) { 
            return Promise.reject(error);
        }

        // If 403 — license expired or forbidden, force logout
        if (error.response?.status === 403) {
            const message = error.response?.data?.detail || error.response?.data?.error || "Access forbidden.";
            ["user", "authToken", "refreshToken", "userRole", "device_uid"]
                .forEach(k => localStorage.removeItem(k));
            window.location.href = `/login?error=${encodeURIComponent(message)}`;
            return Promise.reject(error);
        }

        // If 401 and haven't retried yet
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            
            try {
                // Use separate instance to avoid interceptor
                await refreshApi.post('/token/refresh');

                // Retry the original request
                return api(originalRequest);
                
            } catch (refreshError) {
                ["user", "authToken", "refreshToken", "userRole", "device_uid"]
                    .forEach(k => localStorage.removeItem(k));
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

export default api;
export { BASE_URL, refreshApi };  // exported refreshApi

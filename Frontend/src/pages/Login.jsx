import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import api, { BASE_URL } from '../assets/js/axiosConfig';
import login_img from '../assets/images/login.jpg';

export default function Login() {
  const navigate = useNavigate();
  
  // ========== SECTION 1: STATE MANAGEMENT ==========
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // ========== SECTION 2: FORM VALIDATION & SUBMISSION ==========
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    // Client-side validation
    if (!trimmedUsername && !trimmedPassword) {
      setError("Please fill out all the fields");
      return;
    } else if (!trimmedUsername) {
      setError("Please enter a valid username");
      return;
    } else if (!trimmedPassword) {
      setError("Please enter a valid password");
      setPassword('');
      return;
    }

    setLoading(true);

    try {
      const login_data = { 
        username: trimmedUsername, 
        password: trimmedPassword,
        device_uid: localStorage.getItem("device_uid") || null,
      };

      // API CALL
      const response = await api.post(`${BASE_URL}/login`, login_data);
      
      // TOKEN & USER STORAGE
      if (response.data.token || response.data.access_token) {
        const token = response.data.token || response.data.access_token;
        localStorage.setItem('authToken', token);
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      }

      if (response.data.refresh_token) {
        localStorage.setItem('refreshToken', response.data.refresh_token);
      }

      if (response.data.user) {
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }

      if (response.data.role) {
        localStorage.setItem('userRole', response.data.role);
      }

      navigate('/dashboard');
      
    } catch (err) {
      console.error('Login error:', err);
      const backendCode = err.response?.data?.error_code;
      const backendMessage = err.response?.data?.message || err.response?.data?.error;
      
      // ERROR HANDLING
      if (backendCode === "DEVICE_PENDING_APPROVAL") {
        // First-time registration: backend returns device_uid in details — save it
        // so subsequent login attempts automatically send it
        const generatedUid = err.response?.data?.details?.device_uid;
        if (generatedUid) {
          localStorage.setItem("device_uid", generatedUid);
        }
        setError(backendMessage || "Device registered. Wait for superadmin approval and retry.");
      } else if (backendCode === "DEVICE_INACTIVE") {
        setError(backendMessage || "Device has been revoked. Contact administrator.");
      } else if (backendCode === "DEVICE_UID_ALREADY_BOUND") {
        setError(backendMessage || "This device is linked to another user. Contact administrator.");
      } else if (backendCode === "DEVICE_LIMIT_REACHED") {
        setError(backendMessage || "Maximum active devices reached. Another device must log out first.");
      } else if (backendCode === "DEVICE_UID_REQUIRED") {
        setError(backendMessage || "Device ID is required for mobile login.");
      } else if (err.response) {
        switch (err.response.status) {
          case 401:
            setError(backendMessage || 'Invalid username or password');
            break;
          case 403:
            setError(backendMessage || 'Account is inactive. Contact administrator.');
            break;
          case 400:
            setError(backendMessage || 'Invalid input. Please check your credentials.');
            break;
          case 429:
            setError('Too many login attempts. Please try again later.');
            break;
          case 500:
            setError('Server error. Please try again later.');
            break;
          default:
            setError(backendMessage || 'Login failed. Please try again.');
        }
      } else if (err.request) {
        setError('Network error. Please check your connection.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
      
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  // ========== SECTION 3: SPLIT-SCREEN UI RENDERING ==========
  return (
    <div className="h-screen flex flex-col lg:flex-row overflow-hidden">
      
      {/* ========== LEFT HALF: IMAGE SECTION ========== */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-shrink-0">
        {/* Background Image */}
        <img 
          src={login_img} 
          alt="Bus Management System" 
          className="absolute inset-0 w-full h-full object-cover"
        />
        
        {/* Dark Overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/80 via-slate-800/70 to-slate-900/80"></div>

        {/* Content on top of image */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full p-12 text-center">
          
          {/* App Branding */}
          <div className="mb-8">
            <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6 shadow-2xl border border-white/20">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            
            {/* ========== PRODUCT NAME (Can be uncommented) ========== */}
            {/*
            <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4 tracking-tight">
              Bus Management App
            </h1>
            <p className="text-white/80 text-lg max-w-md mx-auto">
              Streamline your fleet operations with our comprehensive management solution
            </p>
            */}
          </div>

          {/* Feature Highlights */}
          <div className="mt-12 grid grid-cols-1 gap-6 max-w-md">
            <div className="flex items-start space-x-4 bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/20 hover:scale-101 transition-transform duration-300 ease-in-out">
              <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-white text-lg">Fleet Management</h3>
                <p className="text-sm text-white/70">Track and manage your buses</p>
              </div>
            </div>

            <div className="flex items-start space-x-4 bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/20 hover:scale-101 transition-transform duration-300 ease-in-out">
              <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-white text-lg">Smart Transaction Insights</h3>
                <p className="text-sm text-white/70">Access detailed reports and analytics</p>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ========== RIGHT HALF: AUTHENTICATION FORM SECTION ========== */}
      <div className="flex-1 lg:w-1/2 flex items-center justify-center p-6 sm:p-8 lg:p-12 bg-white overflow-y-auto h-full">
        
        <div className="w-full max-w-md">
          
          {/* Mobile Logo (visible only on small screens) */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-16 h-16 bg-slate-800 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Bus Management App</h2>
          </div>

          {/* Form Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-slate-800 mb-2">
              Welcome back
            </h2>
            <p className="text-slate-500">
              Sign in to access your dashboard
            </p>
          </div>

          {/* ========== LOGIN FORM ========== */}
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Username Field */}
            <div className="space-y-2">
              <label htmlFor="username" className="block text-sm font-medium text-slate-700">
                Username
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  placeholder="Enter your username"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent transition duration-200 disabled:bg-slate-50 disabled:cursor-not-allowed"
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  placeholder="Enter your password"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent transition duration-200 disabled:bg-slate-50 disabled:cursor-not-allowed pr-12"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition disabled:opacity-50"
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 animate-shake">
                <div className="flex items-start space-x-2">
                  <svg className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-slate-800 text-white font-medium rounded-lg hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transform transition duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg hover:shadow-xl"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign in'
              )}
            </button>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-slate-500">New user?</span>
              </div>
            </div>

            {/* Sign Up Link */}
            <div className="text-center">
              <NavLink 
                to="/signup" 
                className="text-slate-600 hover:text-slate-800 font-medium transition inline-flex items-center space-x-1 group"
              >
                <span>Create an account</span>
                <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </NavLink>
            </div>
          </form>

          {/* Copyright Footer */}
          <div className="mt-12 text-center">
            <p className="text-sm text-slate-400">
              © 2025 Softland India Ltd. All rights reserved.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
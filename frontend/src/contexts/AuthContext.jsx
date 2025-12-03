import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [banSummary, setBanSummary] = useState(null);

    useEffect(() => {
        // Check if user is already logged in
        const token = localStorage.getItem('token');
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            checkAuthStatus();
        } else {
            setLoading(false);
        }
    }, []);

    const fetchBanSummary = async () => {
        try {
            const response = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/me/ban-summary`);
            setBanSummary(response.data?.banSummary || null);
            return response.data?.banSummary || null;
        } catch (error) {
            if (error.response?.status === 401 || error.response?.status === 403) {
                setBanSummary(null);
            }
            return null;
        }
    };

    const checkAuthStatus = async () => {
        try {
            const response = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/me`);
            setUser(response.data.user);
            setIsAuthenticated(true);
            await fetchBanSummary();
        } catch (error) {
            console.error('Auth check failed:', error);
            // Only clear auth if it's a 401/403 error, not network issues
            if (error.response?.status === 401 || error.response?.status === 403) {
                localStorage.removeItem('token');
                delete axios.defaults.headers.common['Authorization'];
                setUser(null);
                setIsAuthenticated(false);
                setBanSummary(null);
            }
        } finally {
            setLoading(false);
        }
    };

    const login = async (credentials) => {
        try {
            const response = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/login`, credentials);
            const { token, user } = response.data;

            localStorage.setItem('token', token);
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

            setUser(user);
            setIsAuthenticated(true);
            const summary = await fetchBanSummary();
            toast.success('Welcome back!');
            return { success: true, user, banSummary: summary };
        } catch (error) {
            const message = error.response?.data?.message || 'Login failed';
            toast.error(message);
            return { success: false, error: message };
        }
    };

    const register = async (userData) => {
        try {
            const response = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/register`, userData);
            const { token, user } = response.data;

            localStorage.setItem('token', token);
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

            setUser(user);
            setIsAuthenticated(true);
            const summary = await fetchBanSummary();
            toast.success('Account created successfully!');
            return { success: true, user, banSummary: summary };
        } catch (error) {
            const message = error.response?.data?.message || 'Registration failed';
            toast.error(message);
            return { success: false, error: message };
        }
    };

    const googleLogin = async (googleToken) => {
        try {
            const response = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/google`, { token: googleToken });
            const { token, user } = response.data;

            localStorage.setItem('token', token);
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

            setUser(user);
            setIsAuthenticated(true);
            const summary = await fetchBanSummary();
            toast.success('Welcome!');
            return { success: true, user, banSummary: summary };
        } catch (error) {
            const message = error.response?.data?.message || 'Google login failed';
            toast.error(message);
            return { success: false, error: message };
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
        setUser(null);
        setIsAuthenticated(false);
        setBanSummary(null);
        toast.success('Logged out successfully');
    };

    const updateUser = (updatedUserData) => {
        setUser(prevUser => ({
            ...prevUser,
            ...updatedUserData
        }));
    };

    const refreshAuth = async () => {
        const token = localStorage.getItem('token');
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            await checkAuthStatus();
        }
    };

    const value = {
        user,
        isAuthenticated,
        loading,
        banSummary,
        login,
        register,
        googleLogin,
        logout,
        updateUser,
        refreshAuth,
        refreshBanSummary: fetchBanSummary,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

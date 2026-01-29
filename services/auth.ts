/**
 * Authentication service for managing user sessions and tokens.
 */

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'user_data';

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  is_verified: boolean;
  is_staff: boolean;
  is_superuser: boolean;
}

export interface Tenant {
  id: number;
  name: string;
  email: string;
  phone: string;
  status: string;
  property_unit: string;
  lease_start: string | null;
  lease_end: string | null;
  rent_amount: string;
  deposit: string;
  balance: string;
  credit_score: number | null;
  background_check_status: string | null;
  application_data: any;
  lease_status: string | null;
  signed_lease_url: string | null;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: User;
  tenant: Tenant | null;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Login with email and password.
 */
export const login = async (email: string, password: string): Promise<LoginResponse> => {
  const response = await fetch(`${API_URL}/accounts/login/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Login failed' }));
    throw new Error(errorData.error || 'Login failed');
  }

  const data: LoginResponse = await response.json();
  
  // Store tokens and user data
  localStorage.setItem(ACCESS_TOKEN_KEY, data.access);
  localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  
  return data;
};

/**
 * Logout the current user.
 */
export const logout = (): void => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

/**
 * Get the current access token.
 */
export const getAccessToken = (): string | null => {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
};

/**
 * Get the current refresh token.
 */
export const getRefreshToken = (): string | null => {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
};

/**
 * Get the current user data.
 */
export const getCurrentUser = (): User | null => {
  const userStr = localStorage.getItem(USER_KEY);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr) as User;
  } catch {
    return null;
  }
};

/**
 * Check if user is authenticated.
 */
export const isAuthenticated = (): boolean => {
  return !!getAccessToken();
};

/**
 * Get authorization header value.
 */
export const getAuthHeader = (): string | null => {
  const token = getAccessToken();
  return token ? `Bearer ${token}` : null;
};

/**
 * Clear invalid tokens when 401 is received.
 */
export const clearInvalidTokens = (): void => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

/**
 * Decode JWT token to get payload (without verification).
 * Returns null if token is invalid or cannot be decoded.
 */
const decodeJWT = (token: string): any | null => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    return null;
  }
};

/**
 * Check if access token is expired or will expire soon.
 * @param bufferMinutes - Minutes before expiration to consider token as "expiring soon" (default: 5)
 * @returns true if token is expired or expiring soon
 */
export const isTokenExpiredOrExpiringSoon = (bufferMinutes: number = 5): boolean => {
  const token = getAccessToken();
  if (!token) return true;

  const decoded = decodeJWT(token);
  if (!decoded || !decoded.exp) return true;

  const expirationTime = decoded.exp * 1000; // Convert to milliseconds
  const currentTime = Date.now();
  const bufferTime = bufferMinutes * 60 * 1000; // Convert buffer to milliseconds

  return expirationTime - currentTime < bufferTime;
};

/**
 * Refresh access token using refresh token.
 * @returns Promise<{ access: string, refresh: string }> on success
 * @throws Error if refresh fails
 */
export const refreshAccessToken = async (): Promise<{ access: string; refresh: string }> => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  const response = await fetch(`${API_URL}/accounts/token/refresh/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh: refreshToken }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Token refresh failed' }));
    // If refresh token is invalid/expired, clear all tokens
    if (response.status === 401) {
      clearInvalidTokens();
    }
    throw new Error(errorData.detail || errorData.error || 'Token refresh failed');
  }

  const data = await response.json();
  
  // Update stored tokens
  if (data.access) {
    localStorage.setItem(ACCESS_TOKEN_KEY, data.access);
  }
  if (data.refresh) {
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh);
  }

  return {
    access: data.access,
    refresh: data.refresh || refreshToken, // Use new refresh token if provided, otherwise keep old one
  };
};

/**
 * Refresh token proactively if it's expiring soon.
 * @returns Promise<boolean> - true if token was refreshed, false otherwise
 */
export const refreshTokenIfNeeded = async (): Promise<boolean> => {
  if (!isTokenExpiredOrExpiringSoon()) {
    return false; // Token is still valid
  }

  try {
    await refreshAccessToken();
    return true; // Token was refreshed
  } catch (error) {
    // Refresh failed - token might be expired
    console.warn('Failed to refresh token:', error);
    return false;
  }
};



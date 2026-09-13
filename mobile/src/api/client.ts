import AsyncStorage from '@react-native-async-storage/async-storage';

export const PROD_API_URL = 'https://wealthsync-backend-5c21.onrender.com';
export const LOCAL_API_URL = 'http://192.168.1.7:4000';

class ApiClient {
  private customBaseUrl: string | null = null;

  async getBaseUrl(): Promise<string> {
    if (this.customBaseUrl) return this.customBaseUrl;
    const stored = await AsyncStorage.getItem('wealthsync_api_url');
    return stored || PROD_API_URL;
  }

  async setBaseUrl(url: string): Promise<void> {
    this.customBaseUrl = url;
    await AsyncStorage.setItem('wealthsync_api_url', url);
  }

  private async getToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('wealthsync_token');
    } catch {
      return null;
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const baseUrl = await this.getBaseUrl();
    const token = await this.getToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = 'An error occurred';
        try {
          const errData = await response.json();
          errorMessage = errData.error || errData.message || errorMessage;
        } catch {
          errorMessage = response.statusText || `Request failed with status ${response.status}`;
        }

        if (response.status === 401) {
          // Token expired or invalid
          await AsyncStorage.removeItem('wealthsync_token');
          await AsyncStorage.removeItem('wealthsync_user');
        }

        throw new Error(errorMessage);
      }

      // Handle 204 or empty response
      if (response.status === 204) {
        return {} as T;
      }

      return await response.json();
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Server took too long to respond. The cloud service may be waking up, please try again.');
      }
      if (err.message && err.message.includes('Network request failed')) {
        throw new Error('Cannot reach server. Check internet connection or backend status.');
      }
      throw err;
    }
  }

  get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  post<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  put<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient();

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
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;
    const isHeavyEndpoint = endpoint.includes('/scan-receipt');
    const timeoutDuration = isHeavyEndpoint ? 60000 : 35000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

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
          errorMessage =
            errData.message ||
            (errData.error && errData.error !== 'Bad Request' ? errData.error : '') ||
            errData.error ||
            errorMessage;
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
      const msg = (err.message || '').toLowerCase();
      if (err.name === 'AbortError' || msg.includes('aborterror') || msg.includes('timeout')) {
        const netErr = new Error('Server took too long to respond. The cloud service may be waking up, please try again.');
        (netErr as any).isNetworkError = true;
        throw netErr;
      }
      if (
        msg.includes('network request failed') ||
        msg.includes('fetch failed') ||
        msg.includes('unknownhostexception') ||
        msg.includes('unable to resolve host') ||
        msg.includes('failed to fetch') ||
        msg.includes('networkerror') ||
        msg.includes('enotfound') ||
        msg.includes('econnrefused') ||
        msg.includes('econnreset')
      ) {
        const netErr = new Error('Cannot reach server. Check internet connection or backend status.');
        (netErr as any).isNetworkError = true;
        throw netErr;
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

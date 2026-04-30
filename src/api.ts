import { auth } from './firebase';

const BASE_URL = '/api';

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  let token = null;

  // Try Firebase token first
  if (auth.currentUser) {
    token = await auth.currentUser.getIdToken();
  } 
  // Fallback to local token (Email/Password Auth)
  else {
    token = localStorage.getItem('budgetfy_token');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>)
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  // Handle 204 No Content or empty responses
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return null;
  }

  return response.json();
}

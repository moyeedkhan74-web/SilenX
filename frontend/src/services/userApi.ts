import { API_URL } from '../config/webrtc-config';

export const searchUsers = async (query: string, token: string) => {
  try {
    const response = await fetch(`${API_URL}/api/users/search?q=${encodeURIComponent(query)}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) throw new Error('Failed to search users');
    return await response.json();
  } catch (error) {
    console.warn('[UserApi] Search fallback:', error);
    return [];
  }
};

export const getUserProfile = async (userId: string, token: string) => {
  try {
    const response = await fetch(`${API_URL}/api/users/${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) throw new Error('Failed to fetch user profile');
    return await response.json();
  } catch (error) {
    console.warn('[UserApi] Profile fallback:', error);
    return null;
  }
};

export const updateUserProfile = async (userId: string, data: { [key: string]: any }, token: string) => {
  try {
    const response = await fetch(`${API_URL}/api/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update user profile');
    return await response.json();
  } catch (error) {
    console.warn('[UserApi] Update fallback:', error);
    return null;
  }
};
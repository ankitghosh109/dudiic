import { api } from '@/lib/axios';

export interface RegisterPayload {
  email: string;
  username?: string;
  password: string;
}

export interface RegisterResponse {
  message: string;
}

export async function registerUser(payload: RegisterPayload): Promise<RegisterResponse> {
  const { data } = await api.post<RegisterResponse>('/register', payload);

  return data;
}

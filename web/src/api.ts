const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  bootstrap: () => request<{ organization: any }>('/bootstrap'),

  queues: (orgId: string) => request<any[]>(`/organizations/${orgId}/queues`),
  createQueue: (orgId: string, data: any) =>
    request(`/organizations/${orgId}/queues`, { method: 'POST', body: JSON.stringify(data) }),

  agents: (orgId: string) => request<any[]>(`/organizations/${orgId}/agents`),
  createAgent: (orgId: string, data: any) =>
    request(`/organizations/${orgId}/agents`, { method: 'POST', body: JSON.stringify(data) }),
  updateAgent: (id: string, data: any) =>
    request(`/agents/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  conversations: (orgId: string, params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<any[]>(`/organizations/${orgId}/conversations${qs ? `?${qs}` : ''}`);
  },
  conversation: (id: string) => request<any>(`/conversations/${id}`),
  reply: (id: string, text: string) =>
    request(`/conversations/${id}/reply`, { method: 'POST', body: JSON.stringify({ text }) }),
  takeover: (id: string) => request(`/conversations/${id}/takeover`, { method: 'POST', body: '{}' }),
  release: (id: string) => request(`/conversations/${id}/release`, { method: 'POST', body: '{}' }),
  resolve: (id: string) => request(`/conversations/${id}/resolve`, { method: 'POST', body: '{}' }),
  summarize: (id: string) =>
    request<{ summary: string }>(`/conversations/${id}/summarize`, { method: 'POST', body: '{}' }),
  addTag: (id: string, name: string) =>
    request(`/conversations/${id}/tags`, { method: 'POST', body: JSON.stringify({ name }) }),

  nps: (orgId: string) => request<any>(`/organizations/${orgId}/nps`),

  simulate: (from: string, text: string, name?: string) =>
    request('/dev/simulate-inbound', { method: 'POST', body: JSON.stringify({ from, text, name }) }),
};

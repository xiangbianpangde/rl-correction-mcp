/**
 * API 封装模块
 * 统一管理所有后端 API 调用，集成加载指示器和错误处理
 */

import loader from './loader.js';
import { showToast } from './toast.js';

/** API 基础 URL */
export const API_BASE = '';

/**
 * 带加载指示器的 fetch 封装
 * @param {string} endpoint - API 端点（不含 /api 前缀）
 * @param {RequestInit & { body?: any }} options - fetch 选项，body 会自动 JSON 序列化
 * @returns {Promise<any>} 解析后的 JSON 响应
 */
export async function api(endpoint, options = {}) {
  const url = `${API_BASE}/api${endpoint}`;
  loader.show();

  try {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: '未知错误' }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }
    return response.json();
  } catch (error) {
    // 统一错误提示
    showToast(error.message || '网络请求失败', 'error');
    throw error;
  } finally {
    loader.hide();
  }
}

/**
 * API 服务对象 - 所有后端接口方法
 */
export const apiService = {
  getStats: () => api('/stats'),
  listRecords: (params) => api(`/records?${new URLSearchParams(params)}`),
  getRecord: (id) => api(`/records/${id}`),
  addCorrection: (data) => api('/corrections', { method: 'POST', body: data }),
  addRule: (data) => api('/rules', { method: 'POST', body: data }),
  updateCorrection: (id, data) => api(`/records/${id}`, { method: 'PUT', body: data }),
  updateRule: (id, data) => api(`/rules/${id}`, { method: 'PUT', body: data }),
  deleteRecord: (id) => api(`/records/${id}`, { method: 'DELETE' }),
  search: (data) => api('/search', { method: 'POST', body: data }),
  // 三链专用 API
  reviewRecord: (id, data) => api(`/records/${id}/review`, { method: 'POST', body: data }),
  updateLogicChain: (id, data) => api(`/records/${id}/logic-chain`, { method: 'PUT', body: data }),
};

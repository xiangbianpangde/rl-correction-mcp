import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

const API_BASE = '/api';

async function api(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: '未知错误' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

// 兼容新旧数据格式
function normalizeRecord(record) {
  // 新格式已有 input_chain/output_chain
  if (record.input_chain) return record;
  
  // 旧格式转换
  return {
    ...record,
    input_chain: {
      raw_input: record.scenario || record.title || '',
      extracted_context: '',
    },
    output_chain: {
      wrong_output: record.preview?.split('错误输出: ')[1]?.split('\n')[0] || '',
      correct_output: record.preview?.split('正确输出: ')[1]?.split('\n')[0] || '',
      quality_score: record.quality_score || 50,
      rule_content: '',
      rule_type: '',
    },
    logic_chain: {
      wrong_reason: '',
      correct_reason: '',
      wrong_cot: record.metadata?.chain_of_thought || '',
      correct_cot: record.metadata?.correct_chain_of_thought || '',
    },
    metadata: {
      priority: record.priority || 'P1',
      quality_score: record.quality_score || 50,
      review_status: record.review_status || 'pending',
      tags: record.metadata?.tags || record.tags || '',
      created_at: record.metadata?.created_at || record.created_at || '',
    },
  };
}

export const useCorrectionsStore = defineStore('corrections', () => {
  // State
  const corrections = ref([]);
  const rules = ref([]);
  const stats = ref(null);
  const loading = ref(false);
  const currentPage = ref(1);
  const pageSize = ref(20);
  const total = ref(0);
  const calls = ref([]);
  const callStats = ref(null);

  // Getters
  const correctionCount = computed(() => corrections.value.length);
  const ruleCount = computed(() => rules.value.length);

  // Actions
  async function fetchStats() {
    loading.value = true;
    try {
      stats.value = await api('/stats');
    } finally {
      loading.value = false;
    }
  }

  async function fetchCorrections(page = 1) {
    loading.value = true;
    try {
      const offset = (page - 1) * pageSize.value;
      const data = await api(`/records?limit=${pageSize.value}&offset=${offset}`);
      corrections.value = data.records
        .filter(r => r.type === 'correction_pair')
        .map(normalizeRecord);
      total.value = data.total;
      currentPage.value = page;
    } finally {
      loading.value = false;
    }
  }

  async function fetchRules(page = 1) {
    loading.value = true;
    try {
      const offset = (page - 1) * pageSize.value;
      const data = await api(`/records?limit=${pageSize.value}&offset=${offset}`);
      rules.value = data.records
        .filter(r => r.type === 'behavior_rule')
        .map(normalizeRecord);
      total.value = data.total;
      currentPage.value = page;
    } finally {
      loading.value = false;
    }
  }

  async function fetchCalls() {
    loading.value = true;
    try {
      const data = await api('/calls?limit=50');
      calls.value = data.calls || [];
    } finally {
      loading.value = false;
    }
  }

  async function fetchCallStats() {
    try {
      callStats.value = await api('/calls/stats');
    } catch (e) {
      console.error('Failed to fetch call stats:', e);
    }
  }

  async function addCorrection(data) {
    // 转换为旧格式
    const payload = {
      scenario: data.raw_input,
      wrong_output: data.wrong_output,
      correct_output: data.correct_output,
      priority: data.priority,
      tags: Array.isArray(data.tags) ? data.tags.join(',') : data.tags,
      chain_of_thought: data.wrong_reason,
      correct_chain_of_thought: data.correct_reason,
    };
    return api('/corrections', { method: 'POST', body: payload });
  }

  async function addRule(data) {
    const payload = {
      trigger_condition: data.trigger_condition || data.raw_input,
      rule_content: data.rule_content || data.correct_output,
      rule_type: data.rule_type,
      priority: data.priority,
      tags: Array.isArray(data.tags) ? data.tags.join(',') : data.tags,
    };
    return api('/rules', { method: 'POST', body: payload });
  }

  async function deleteRecord(id) {
    return api(`/records/${id}`, { method: 'DELETE' });
  }

  async function search(query, topK = 5, type = null) {
    const body = { query, top_k: topK };
    if (type) body.type = type;
    return api('/search', { method: 'POST', body });
  }

  return {
    corrections,
    rules,
    stats,
    loading,
    currentPage,
    pageSize,
    total,
    calls,
    callStats,
    correctionCount,
    ruleCount,
    fetchStats,
    fetchCorrections,
    fetchRules,
    fetchCalls,
    fetchCallStats,
    addCorrection,
    addRule,
    deleteRecord,
    search,
  };
});

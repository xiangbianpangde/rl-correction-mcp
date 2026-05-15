import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useCorrectionsStore } from '../web/src/stores/corrections';

// Mock fetch
global.fetch = async (url) => {
  const endpoint = url.split('/api')[1];

  if (endpoint === '/stats') {
    return {
      ok: true,
      json: async () => ({
        total_records: 10,
        correction_pairs: 7,
        behavior_rules: 3,
        rule_type_breakdown: { must: 2, should: 1 },
        all_tags: ['test', 'bug', 'enhancement'],
      }),
    };
  }

  if (endpoint.startsWith('/records')) {
    return {
      ok: true,
      json: async () => ({
        records: [
          {
            id: '1',
            type: 'correction_pair',
            scenario: 'Test scenario',
            wrong_output: 'Wrong output',
            correct_output: 'Correct output',
            priority: 'P1',
            quality_score: 80,
            preview: '错误输出: Wrong output\n正确输出: Correct output',
          },
          {
            id: '2',
            type: 'behavior_rule',
            scenario: 'Test rule',
            rule_content: 'Test rule content',
            priority: 'P2',
          },
        ],
        total: 2,
      }),
    };
  }

  return {
    ok: true,
    json: async () => ({ id: 'new-id', success: true }),
  };
};

describe('Corrections Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('should fetch stats', async () => {
    const store = useCorrectionsStore();
    expect(store.stats).toBe(null);

    await store.fetchStats();

    expect(store.stats).toEqual({
      total_records: 10,
      correction_pairs: 7,
      behavior_rules: 3,
      rule_type_breakdown: { must: 2, should: 1 },
      all_tags: ['test', 'bug', 'enhancement'],
    });
  });

  it('should fetch corrections with normalized data', async () => {
    const store = useCorrectionsStore();

    await store.fetchCorrections();

    // 验证过滤和规范化
    expect(store.corrections.length).toBe(1);
    expect(store.corrections[0].id).toBe('1');
    expect(store.corrections[0].input_chain.raw_input).toBe('Test scenario');
    expect(store.corrections[0].metadata.priority).toBe('P1');
  });

  it('should handle loading state', async () => {
    const store = useCorrectionsStore();
    expect(store.loading).toBe(false);

    await store.fetchStats();

    expect(store.loading).toBe(false);
  });

  it('should fetch rules separately', async () => {
    const store = useCorrectionsStore();

    await store.fetchRules();

    // 验证只获取 behavior_rule
    expect(store.rules.length).toBe(1);
    expect(store.rules[0].id).toBe('2');
  });
});

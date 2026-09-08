import assert from 'node:assert/strict';

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export const withClasswordRpcFixture = async (run: () => Promise<void>): Promise<void> => {
  const fixtureFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (!String(url).endsWith('/rpc/classword_command_v2')) return fixtureFetch(url, init);
    const body: unknown = JSON.parse(String(init?.body));
    assert.ok(record(body) && record(body.p_payload));
    assert.equal(body.p_protocol_version, 2);
    assert.equal(typeof body.p_request_id, 'string');
    const payload = body.p_payload;
    const base = String(url).replace('/rpc/classword_command_v2', '');
    const invoke = (path: string, method: string, value?: unknown, prefer?: string) => fixtureFetch(`${base}/${path}`, {
      method, headers: prefer ? { Prefer: prefer } : {}, ...(value === undefined ? {} : { body: JSON.stringify(value) }),
    });
    if (body.p_action === 'save_entry') {
      const response = await invoke('classword_entries', payload.entryId ? 'PATCH' : 'POST', {
        round_date: payload.dateKey, student_number: body.p_actor, initial: payload.initial, word: payload.word,
      });
      if (!response.ok) return response;
      const rows: unknown = await response.json();
      assert.ok(Array.isArray(rows) && record(rows[0]));
      const rewardResponse = await invoke('rpc/claim_weekly_mission_reward_v2', 'POST', {
        p_student_number: body.p_actor, p_mission_type: 'classword_word_entry', p_week_key: payload.dateKey, p_source_event_id: rows[0].id, p_protocol_version: 2,
      });
      if (!rewardResponse.ok) return rewardResponse;
      return Response.json({ entry: rows[0], reward: await rewardResponse.json() });
    }
    if (body.p_action === 'complete_quiz') {
      const response = await invoke('classword_quiz_completions', 'POST', { quiz_date: payload.dateKey, question_id: payload.questionId, student_number: body.p_actor });
      if (!response.ok) return response;
      const rows: unknown = await (await invoke('classword_quiz_completions','GET')).json();
      assert.ok(Array.isArray(rows));
      const rewardResponse = await invoke('rpc/claim_weekly_mission_reward_v2', 'POST', {
        p_student_number: body.p_actor, p_mission_type: 'classword_quiz_correct', p_week_key: payload.dateKey, p_source_event_id: payload.questionId, p_protocol_version: 2,
      });
      if (!rewardResponse.ok) return rewardResponse;
      return Response.json({ completion: rows[0], reward: await rewardResponse.json() });
    }
    if (body.p_action === 'save_topic') return invoke('classword_rounds?on_conflict=round_date', 'POST', { round_date: payload.dateKey, topic: payload.topic });
    if (body.p_action === 'save_quiz') return invoke('classword_quizzes', 'POST', payload);
    if (body.p_action === 'delete_quiz') return invoke('classword_quizzes', 'DELETE');
    if (body.p_action === 'prune') return invoke(`classword_entries?round_date=lt.${payload.dateKey}`, 'DELETE');
    if (body.p_action === 'delete_date_entries') return invoke(`classword_entries?round_date=eq.${payload.dateKey}`, 'DELETE');
    if (body.p_action === 'delete_entry') {
      const response = await invoke(`classword_entries?id=eq.${payload.entryId}${body.p_actor === 0 ? '' : `&student_number=eq.${body.p_actor}&round_date=eq.${payload.dateKey}`}`, 'DELETE', undefined, 'return=representation');
      if (!response.ok) return response;
      return Response.json({ deleted: true });
    }
    throw new Error('Unexpected command fixture');
  };
  try { await run(); } finally { globalThis.fetch = fixtureFetch; }
};

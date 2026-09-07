import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import { normalizeCurrencyBalances, normalizeCurrencyHistory } from './currency.js';
import { createStudentSettingsUpdate } from './studentSettingsUpdate.js';

test('학생 저장 요청은 기본값으로 채운 타인 데이터와 교사 필드를 제외하고 캐시에는 조회값을 보존한다', () => {
  const current = {
    currencyBalances: { 7: 135 }, currencyHistory: { 7: [] },
    studentPets: { 7: { name: '내 펫' } },
    auctionItems: [{ id: 'item-a', startPrice: 10 }],
    auctionAwards: null, studentEconomy: { 7: { deposit: 30 } },
  };
  const before = structuredClone(current);
  const prepared = createStudentSettingsUpdate(current, {
    ...current, version: 1, auctionAwards: {}, auctionItems: [],
    studentEconomy: { 7: { deposit: 999 } },
    currencyBalances: { ...normalizeCurrencyBalances(current.currencyBalances), 7: 155 },
    currencyHistory: normalizeCurrencyHistory(current.currencyHistory),
    studentPets: { 7: { name: '새 이름' }, 8: { name: '기본값' } },
    studentEmotionHistory: { 7: [], 8: [] },
  }, 7);
  assert.deepEqual(prepared.patch, {
    currencyBalances: { 7: 155 },
    studentPets: { 7: { name: '새 이름' } }, studentEmotionHistory: { 7: [] },
  });
  assert.deepEqual(prepared.value, { ...current, ...prepared.patch });
  assert.deepEqual(current, before);
});

test('전체 스냅샷에서도 다른 학생의 원본과 정규화할 수 없는 과거 게임 기록을 보존한다', () => {
  const current = {
    currencyBalances: { 7: 135, 8: 145 }, currencyHistory: { 8: [{ legacy: true }] },
    studentSudoku: { '7:old': { cells: [1] }, '8:old': { legacy: true } },
    studentNumberBaseball: { '8:old': { legacy: true } },
  };
  const prepared = createStudentSettingsUpdate(current, {
    currencyBalances: { 7: 140, 8: 100 }, currencyHistory: { 7: [], 8: [] },
    studentSudoku: { '7:new': { cells: [2] }, '8:old': { cells: [] }, '17:new': {} },
    studentNumberBaseball: { '7:new': { attempts: [] } },
  }, 7);
  assert.deepEqual(prepared.patch.currencyBalances, { 7: 140 });
  assert.deepEqual(prepared.value.currencyBalances, { 7: 140, 8: 145 });
  assert.deepEqual(prepared.value.currencyHistory, { 7: [], 8: [{ legacy: true }] });
  assert.deepEqual(prepared.patch.studentSudoku, { ...current.studentSudoku, '7:new': { cells: [2] } });
  assert.deepEqual(prepared.patch.studentNumberBaseball, { ...current.studentNumberBaseball, '7:new': { attempts: [] } });
});

test('잘못된 학생 번호나 저장 객체는 요청 생성 단계에서 거절한다', () => {
  for (const studentNumber of [0, 24, 7.5, NaN, Infinity]) {
    assert.throws(() => createStudentSettingsUpdate({}, {}, studentNumber), /INVALID_STUDENT_NUMBER/);
  }
  for (const value of [null, undefined, [], 'invalid']) {
    assert.throws(() => createStudentSettingsUpdate({}, value, 7), /INVALID_STUDENT_SETTINGS_UPDATE/);
  }
});

test('학생 코드와 공용 헬퍼는 전체 설정 저장 함수를 직접 가져오지 않는다', async () => {
  const root = new URL('../', import.meta.url);
  const paths = await readdir(root, { recursive: true });
  for (const path of paths.filter((path) => /\.(?:ts|tsx)$/.test(path) && !path.endsWith('.test.ts') && path !== 'pages/TimerPage.tsx')) {
    const source = ts.createSourceFile(path, await readFile(new URL(path, root), 'utf8'), ts.ScriptTarget.Latest, true);
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)
        || !/\/supabaseSettings(?:\.[jt]s)?$/.test(statement.moduleSpecifier.text)) continue;
      const bindings = statement.importClause?.namedBindings;
      assert.ok(!bindings || ts.isNamedImports(bindings), `${path}: namespace import 대신 명시적인 학생 저장 API를 사용하세요.`);
      if (bindings && ts.isNamedImports(bindings)) {
        for (const specifier of bindings.elements) {
          assert.ok(!['saveSharedSettings', 'updateSharedSettings'].includes((specifier.propertyName ?? specifier.name).text),
            `${path}: updateStudentSharedSettings(studentNumber, updater)를 사용하세요.`);
        }
      }
    }
  }
});


test('변경하지 않은 대용량 기록은 재전송하지 않고 실제 바뀐 게임 필드만 전송한다', () => {
  const current = {
    studentLife: { letters: Array.from({ length: 300 }, (_, id) => ({ id, body: '기존 기록'.repeat(100) })) },
    studentNumberBaseball: { '7:week': { attempts: [] }, '8:week': { attempts: ['123'] } },
    studentSudoku: { '8:week': { cells: Array(81).fill(0) } },
    currencyHistory: { 7: Array.from({ length: 300 }, (_, id) => ({ id, amount: 1 })) },
    currencyBalances: { 7: 100 },
  };
  const next = { ...structuredClone(current), studentNumberBaseball: { ...current.studentNumberBaseball, '7:week': { attempts: ['456'] } } };
  const result = createStudentSettingsUpdate(current, next, 7);
  assert.deepEqual(Object.keys(result.patch), ['studentNumberBaseball']);
  assert.deepEqual(result.value, next);
  assert.deepEqual(createStudentSettingsUpdate(current, structuredClone(current), 7).patch, {});
  assert.ok(JSON.stringify(result.patch).length < JSON.stringify(next).length / 100);
});

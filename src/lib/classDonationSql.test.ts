import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('class donation RPC deducts currency immediately while preserving auction reservations', async () => {
  const sql = await readFile(new URL('../../supabase/app_settings.sql', import.meta.url), 'utf8');
  const donationSql = sql.slice(sql.indexOf('create or replace function donate_to_class_goal'));

  assert.match(donationSql, /for update;/i);
  assert.match(donationSql, /CLASS_DONATION_EXCEEDS_REMAINING/);
  assert.match(donationSql, /INSUFFICIENT_AVAILABLE_CURRENCY/);
  assert.match(donationSql, /auctionBids/);
  assert.match(donationSql, /p_request_id/);
  assert.match(sql, /create table if not exists class_donation_requests/i);
  assert.match(donationSql, /select result into v_result\s+from class_donation_requests/i);
  assert.match(donationSql, /insert into class_donation_requests/i);
  assert.match(
    donationSql,
    /jsonb_set\(v_value, array\['currencyBalances', v_student_key\], to_jsonb\(v_balance - p_amount\), true\)/,
  );
  assert.match(donationSql, /'delta', -p_amount/);
  assert.ok(donationSql.indexOf('for update;') < donationSql.indexOf("set value = v_value"));
  assert.ok(
    donationSql.indexOf("array['currencyBalances', v_student_key]") < donationSql.indexOf("set value = v_value"),
  );
  assert.match(donationSql, /grant execute on function donate_to_class_goal\(integer, integer, text\) to anon/);
});

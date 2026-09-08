# Browser storage/sharing audit
Exact SHA: 98c14b58f53dc98dfe63089b2095fe25342c879d
Verdict: PASS for tested storage flows.
Build: current SHA Vite production build, synthetic VITE_SUPABASE_URL/ANON_KEY, API routes actual source + PostgreSQL harness.
Isolation: newly created storage_http_test_readiness_20260908_ui database; student host127.0.0.1 and teacher localhost at3041 separate cookies/localStorage. No production students or data.
Actual CUA Playwright actions:
1. Select17 student, initial balance100.
2. Emotion 감사하다; fill both fields, click기록하기, observe confirmed record, dismiss확인, home105.
3. Student mailbox compose 공유 저장 검증, send. Already-open teacher settings/편지 obtains New1 automatically; open17 conversation and see exact synthetic content.
4. Teacher reply 교사 답장 검증; student already-open inbox obtains New1 automatically; open and see exact reply, read marker saved.
5. Enable maintenance only on synthetic DB. Student compose 점검 중 초안 보존; send yields explicit maintenance status and commonalert, form preserved, no success.
6. Navigate/reload same mailbox, exact title/body remain. SQL confirms blocked letter0, balance105, reconciliation[].
7. Disable synthetic maintenance. Manual보내기 sends once; SQL retry_letter_count1, balance105, new_ledger_rows1, reconciliation[].
8. Reload /; overview retains105 and감사하다. Screenshot/DOM personally observed. No automatic extra reward.
The home mailbox pointer click once selected the nearby draggable character in the current viewport; keyboard Enter opened mailbox normally. No storage failure resulted; this UI hit area observation is outside the central storage pass and is not a reproduced data loss issue.
Evidence: browser-maintenance.json, browser-after-retry.json, ui-build.log. Synthetic test server stopped at cleanup; original user server untouched.

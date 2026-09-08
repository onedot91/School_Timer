# Quiz reward review ledger

| Lane | SHA | Verdict | Report |
|---|---|---|---|
| goal | `b733abd1aa3a73728c79453cd7206d5d303cd6e5` | FAIL | quiz-goal.md |
| code | `b733abd1aa3a73728c79453cd7206d5d303cd6e5` | FAIL | quiz-code.md |
| security | `b733abd1aa3a73728c79453cd7206d5d303cd6e5` | PASS | quiz-security.md |
| context | `b733abd1aa3a73728c79453cd7206d5d303cd6e5` | CONDITIONAL | quiz-context.md |
| qa | `b733abd1aa3a73728c79453cd7206d5d303cd6e5` | PASS (client runtime; not browser UI) | quiz-qa.md |

Aggregate: FAIL. Confirmed edge defects; no source modifications or production mutations. Root SQL runtime audit at same SHA reproduced one award for 24 requests and cap completion without claim.

# Independent root RED

Command: `node --import tsx .omo/evidence/canvas-library/task-5-root-driver.mjs`
Exit1, actual source placement acb47e0935e2542ea0d861be6ceee45da2d3ec088695c79b79a506f849c5a08b.

Synthetic records have duplicate id `same-id`: student1 unplaced; student2 already placed at63. Student1 selects existing `same-id` for slot3. Result incorrectly clears student2 librarySlot63. Assertion `duplicate ID must not modify foreign record` failed at root driver line99.

Diagnosis: ID-wide map changes both records; slot normalization removes the later duplicate slot, losing foreign existing placement. Fix requested: reject ambiguous IDs or mutate only exact selected own record, preserving all foreign metadata/slot. No production data used.

Earlier seven scenarios passed including700-history preservation,100 sequential actual placements, replay, generic empty-row guard, malformed inputs. Earlier receipt renamed `task-5-root-pre-duplicate.json` and is NOT final approval. Driver must pass all strengthened cases before task completion. No resources created; process exited.

## Follow-up
Root driver passed strengthened eight groups at07:14:07 after ambiguous IDs reject403. Placement hash289a5effb65d13f2dd7d73067398524ced006a0b7d54c2694c6e3799733fb9a9. Root npm test548/548 and build exit0, but lint75018 exited2 with union narrowing errors in new module (parsed result and closure bookId). Sent exact diagnostics to worker; approval remains pending clean lint/current-source recheck. Additional economy-active stale slot merge scenario requested before final source freeze.

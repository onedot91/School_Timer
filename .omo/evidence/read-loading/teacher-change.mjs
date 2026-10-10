import { createRequire } from 'node:module';
const { Client } = createRequire(import.meta.url)('/private/tmp/school-timer-concurrency-20261006/runtime/node_modules/pg/lib/index.js');
const client = new Client({host:'127.0.0.1',port:55447,user:'postgres',database:'storage_http_test_read_browser_20261010'});
await client.connect();
await client.query("update storage_resources set value=jsonb_set(value,'{data}',to_jsonb($1::text)),revision=revision+1,updated_at='2000-01-01' where resource_key='/scheduleNotice'",['차등 조회 두 번째 검증']);
await client.end();

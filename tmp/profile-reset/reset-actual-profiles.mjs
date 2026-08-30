import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

const origin = 'https://school-timer-five.vercel.app';
const registrationKey = process.env.DEVICE_REGISTRATION_KEY;

if (!registrationKey) {
  throw new Error('DEVICE_REGISTRATION_KEY_REQUIRED');
}

const registration = await fetch(`${origin}/api/device-session`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Origin: origin,
  },
  body: JSON.stringify({ entryNumber: 0, registrationKey }),
});
if (!registration.ok) throw new Error(`TEACHER_REGISTRATION_HTTP_${registration.status}`);

const cookie = registration.headers.get('set-cookie')?.split(';', 1)[0];
if (!cookie) throw new Error('TEACHER_SESSION_COOKIE_MISSING');

const loadResponse = await fetch(`${origin}/api/shared-settings?full=1`, {
  headers: { Cookie: cookie },
});
if (!loadResponse.ok) throw new Error(`SHARED_SETTINGS_READ_HTTP_${loadResponse.status}`);
const row = await loadResponse.json();
const value = row?.value && typeof row.value === 'object' ? row.value : {};
const studentLife = value.studentLife && typeof value.studentLife === 'object' ? value.studentLife : {};
const assignments = studentLife.failureProfileAssignments && typeof studentLife.failureProfileAssignments === 'object'
  ? studentLife.failureProfileAssignments
  : {};
const clearedValue = {
  ...value,
  studentLife: { ...studentLife, failureProfileAssignments: {} },
};
const stableNonProfileValue = JSON.stringify(clearedValue);
const nonProfileHash = createHash('sha256').update(stableNonProfileValue).digest('hex');
const timestamp = new Date().toISOString().replaceAll(':', '-');
const backupDirectory = new URL('./backups/', import.meta.url);
await mkdir(backupDirectory, { recursive: true });
const backupFile = new URL(`actual-profile-assignments-${timestamp}.json`, backupDirectory);
await writeFile(backupFile, JSON.stringify({
  sourceUpdatedAt: row?.updated_at ?? null,
  profileAssignments: assignments,
  nonProfileHash,
}, null, 2), { mode: 0o600 });

const saveResponse = await fetch(`${origin}/api/shared-settings`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    Cookie: cookie,
    Origin: origin,
  },
  body: JSON.stringify({ value: clearedValue, expectedUpdatedAt: row?.updated_at ?? null }),
});
if (!saveResponse.ok) throw new Error(`SHARED_SETTINGS_WRITE_HTTP_${saveResponse.status}`);

const verifyResponse = await fetch(`${origin}/api/shared-settings?full=1`, {
  headers: { Cookie: cookie },
});
if (!verifyResponse.ok) throw new Error(`SHARED_SETTINGS_VERIFY_HTTP_${verifyResponse.status}`);
const verifiedRow = await verifyResponse.json();
const verifiedValue = verifiedRow?.value && typeof verifiedRow.value === 'object' ? verifiedRow.value : {};
const verifiedStudentLife = verifiedValue.studentLife && typeof verifiedValue.studentLife === 'object'
  ? verifiedValue.studentLife
  : {};
const remainingProfiles = Object.keys(
  verifiedStudentLife.failureProfileAssignments && typeof verifiedStudentLife.failureProfileAssignments === 'object'
    ? verifiedStudentLife.failureProfileAssignments
    : {},
).length;
const verifiedComparable = JSON.stringify({
  ...verifiedValue,
  studentLife: { ...verifiedStudentLife, failureProfileAssignments: {} },
});
const verifiedNonProfileHash = createHash('sha256').update(verifiedComparable).digest('hex');

console.log(JSON.stringify({
  backupFile: backupFile.pathname,
  clearedProfileCount: Object.keys(assignments).length,
  remainingProfiles,
  nonProfileDataUnchanged: verifiedNonProfileHash === nonProfileHash,
}));

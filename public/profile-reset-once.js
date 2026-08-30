(() => {
  const targets = [
    {
      key: 'school-timer-student-pets-v1',
      getAssignments: (value) => value?.studentLife?.failureProfileAssignments,
      clear: (value) => ({
        ...value,
        studentLife: { ...value?.studentLife, failureProfileAssignments: {} },
      }),
    },
    {
      key: 'school-timer-student-life',
      getAssignments: (value) => value?.failureProfileAssignments,
      clear: (value) => ({ ...value, failureProfileAssignments: {} }),
    },
    {
      key: 'school-timer-student-settings-snapshot-v2',
      getAssignments: (value) => value?.value?.studentLife?.failureProfileAssignments,
      clear: (value) => ({
        ...value,
        value: {
          ...value?.value,
          studentLife: { ...value?.value?.studentLife, failureProfileAssignments: {} },
        },
      }),
    },
  ];

  const result = document.querySelector('#result');
  document.querySelector('#reset')?.addEventListener('click', () => {
    const backupKey = `school-timer-profile-reset-backup-${new Date().toISOString()}`;
    const backup = {};
    const counts = {};

    for (const target of targets) {
      const raw = localStorage.getItem(target.key);
      if (raw === null) continue;
      const parsed = JSON.parse(raw);
      const assignments = target.getAssignments(parsed);
      backup[target.key] = assignments && typeof assignments === 'object' ? assignments : {};
      counts[target.key] = Object.keys(backup[target.key]).length;
      localStorage.setItem(target.key, JSON.stringify(target.clear(parsed)));
    }

    localStorage.setItem(backupKey, JSON.stringify(backup));
    const remaining = targets.reduce((sum, target) => {
      const raw = localStorage.getItem(target.key);
      if (raw === null) return sum;
      const assignments = target.getAssignments(JSON.parse(raw));
      return sum + Object.keys(assignments && typeof assignments === 'object' ? assignments : {}).length;
    }, 0);
    result.textContent = JSON.stringify({ backupKey, clearedCounts: counts, remainingProfiles: remaining }, null, 2);
  });
})();

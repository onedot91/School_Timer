(() => {
  const records = window.schoolStartupDiagnostics?.read() || [];
  const json = JSON.stringify(records, null, 2);
  document.getElementById('status').textContent = records.length ? `${records.length}개의 기록이 있어요.` : '저장된 접속 오류가 없어요.';
  document.getElementById('records').textContent = records.length ? json : '';
  const button = document.getElementById('copy');
  button.disabled = !records.length;
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(json);
      document.getElementById('status').textContent = '진단 기록을 복사했어요.';
    } catch {
      document.getElementById('status').textContent = '아래 기록을 선택해서 복사해 주세요.';
    }
  });
})();

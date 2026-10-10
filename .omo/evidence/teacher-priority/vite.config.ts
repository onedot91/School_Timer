import { defineConfig } from 'vite';
import base from '../../../vite.config';

export default defineConfig(async env => {
  const config = await base(env);
  return { ...config, plugins: [...(config.plugins ?? []), {
    name: 'synthetic-teacher-read-probe', enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('/src/pages/TimerPage.tsx')) return;
      return code.replace('    const syncSharedSettingsFromRemote = async () => {', `
    const syncSharedSettingsFromRemote = async () => {
      console.info('QA_TEACHER_READ_GUARD', JSON.stringify({
        hydrated: sharedSettingsHydratedRef.current,
        error: Boolean(teacherSettingsErrorRef.current), saving: teacherSettingsSavingRef.current,
        dirty: createTeacherSettingsChanges(teacherSettingsBaseRef.current, latestTeacherSnapshotRef.current).map(change => change.field),
        checking: isChecking, award: awardPresentationRef.current !== null, pending: isSharedSettingsSavePendingRef.current,
        weekly: hasUnsavedWeeklySubjectsRef.current, catalog: hasUnsavedSubjectCatalogRef.current,
        auction: hasUnsavedAuctionItemsRef.current, notice: isEditingNoticeRef.current,
        editingCatalog: isEditingSubjectCatalogRef.current, editingAuction: isEditingAuctionItemRef.current,
        bookstore: isEditingBookstoreRef.current,
      }));`);
    },
  }] };
});

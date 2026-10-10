import { build } from 'vite';
await build({build:{outDir:'.omo/evidence/read-loading/diagnostic-dist'},plugins:[{
  name:'isolated-poll-guard-observation',enforce:'pre',
  transform(code,id){
    if(!id.endsWith('/src/pages/TimerPage.tsx'))return;
    const marker='const syncSharedSettingsFromRemote = async () => {';
    if(!code.includes(marker))throw new Error('FIXTURE_MARKER_MISSING');
    return code.replace(marker,marker+`console.info('FIXTURE_TEACHER_POLL_GUARDS', JSON.stringify({
      visible: document.visibilityState,online:navigator.onLine, backoff:Date.now()<nextReadAt,
      hydrated:sharedSettingsHydratedRef.current,error:!!teacherSettingsErrorRef.current,saving:teacherSettingsSavingRef.current,
      dirty:createTeacherSettingsChanges(teacherSettingsBaseRef.current,latestTeacherSnapshotRef.current).map(change=>change.field),
      checking:isChecking,award:awardPresentationRef.current!==null,pending:isSharedSettingsSavePendingRef.current,
      subjects:hasUnsavedWeeklySubjectsRef.current,catalog:hasUnsavedSubjectCatalogRef.current,auction:hasUnsavedAuctionItemsRef.current,
      noticeEdit:isEditingNoticeRef.current,catalogEdit:isEditingSubjectCatalogRef.current,auctionEdit:isEditingAuctionItemRef.current,bookstoreEdit:isEditingBookstoreRef.current,
      changesCapability:canLoadTeacherSettingsChanges()
    }));`);
  }
}]});

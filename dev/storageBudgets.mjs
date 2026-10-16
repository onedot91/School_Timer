export const verifyClassroomTimings = (samples, { atomicBids = true } = {}) => {
  if (!Array.isArray(samples) || samples.length < 47) throw new Error('STORAGE_LOAD_SAMPLES_REQUIRED');
  for (const action of ['teacher.settings.patch', 'student.auction.bid', 'student.failure.create']) {
    const times = samples.filter(sample => sample.action === action).map(sample => sample.ms).sort((left, right) => left - right);
    const expected = action.startsWith('teacher.') ? 1 : 23;
    if (times.length !== expected || times.some(ms => !Number.isFinite(ms) || ms < 0)) throw new Error('STORAGE_LOAD_SAMPLES_REQUIRED');
    const budget = action === 'student.auction.bid' && !atomicBids ? 12_000 : 2_000;
    if (times[Math.ceil((times.length - 1) * .95)] > budget || times.at(-1) > 15_000) {
      throw new Error(`STORAGE_LOAD_TIME_BUDGET: ${action}`);
    }
  }
};

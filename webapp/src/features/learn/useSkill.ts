/** The signed-in person's trading level: the quiz result, else their welcome answer, else null. */
import { useAuth } from '../../lib/auth';
import { useUserDoc } from '../../data/userDoc';
import { levelFromExperience, type Level } from './quiz';

export function useSkill(): { level: Level | null; quizTaken: boolean; learnDone: string[]; learnPassed: Record<string, number>; learnRetryAt: Record<string, number>; loaded: boolean } {
  const { user, isReal } = useAuth();
  const me = useUserDoc(isReal && user ? user.uid : null);
  if (me.status !== 'ready') return { level: null, quizTaken: false, learnDone: [], learnPassed: {}, learnRetryAt: {}, loaded: me.status === 'missing' };
  return { level: me.data.skill?.level ?? levelFromExperience(me.data.experience), quizTaken: !!me.data.skill, learnDone: me.data.learnDone, learnPassed: me.data.learnPassed, learnRetryAt: me.data.learnRetryAt, loaded: true };
}

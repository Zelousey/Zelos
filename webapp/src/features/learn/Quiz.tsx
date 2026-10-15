/**
 * The quiz itself, one question at a time (embedded in the welcome screens and on /quiz).
 * Knowledge checks show the right answer and why after you pick. Skippable at any point.
 */
import { useId, useState } from 'react';
import { t, type MessageKey } from '../../lib/i18n';
import { Button, useToast } from '../../ui';
import type { Experience } from '../../data/userDoc';
import { CHECKS, QUESTIONS, saveQuiz, type Answers, type Goal, type Skill } from './quiz';
import s from './Learn.module.css';

export function Quiz({ uid, onDone, onSkip }: { uid: string; onDone: (skill: Skill) => void; onSkip?: () => void }) {
  const toast = useToast();
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Answers>({ experience: null, goal: null, checks: CHECKS.map(() => null) });
  const [busy, setBusy] = useState(false);
  const name = useId();
  const q = QUESTIONS[i]!;
  const ci = CHECKS.indexOf(q);
  const picked = q.kind === 'experience' ? answers.experience : q.kind === 'goal' ? answers.goal : answers.checks[ci] != null ? q.choices[answers.checks[ci]!]!.id : null;
  const revealed = q.kind === 'check' && answers.checks[ci] != null;
  const last = i === QUESTIONS.length - 1;

  function pick(idx: number) {
    const id = q.choices[idx]!.id;
    if (q.kind === 'experience') setAnswers({ ...answers, experience: id as Experience });
    else if (q.kind === 'goal') setAnswers({ ...answers, goal: id as Goal });
    else if (!revealed) setAnswers({ ...answers, checks: answers.checks.map((v, k) => (k === ci ? idx : v)) });
  }
  async function next() {
    if (!last) return setI(i + 1);
    setBusy(true);
    try {
      onDone(await saveQuiz(uid, answers));
    } catch {
      toast.show(t('qz.failed'), 'error');
      setBusy(false);
    }
  }

  return (
    <div className={s.quiz}>
      <div className={s.quizTop}>
        <span className={s.kicker}>{t('qz.progress', { n: i + 1, of: QUESTIONS.length })}</span>
        {onSkip && (
          <button type="button" className={s.skip} onClick={onSkip}>
            {t('qz.skip')}
          </button>
        )}
      </div>
      <div className={s.bar} aria-hidden="true">
        <i style={{ width: `${((i + (picked ? 1 : 0)) / QUESTIONS.length) * 100}%` }} />
      </div>
      <fieldset className={s.question} key={q.id}>
        <legend className={s.qTitle}>{q.title}</legend>
        {q.choices.map((c, idx) => {
          const right = revealed && idx === q.correct;
          const wrong = revealed && answers.checks[ci] === idx && idx !== q.correct;
          return (
            <label key={c.id} className={[s.answer, picked === c.id && s.answerOn, right && s.answerRight, wrong && s.answerWrong].filter(Boolean).join(' ')}>
              <input type="radio" name={name} value={c.id} checked={picked === c.id} disabled={revealed && picked !== c.id} onChange={() => pick(idx)} />
              <span>{c.label}</span>
              {right && <b className={s.mark}>{t('qz.right')}</b>}
            </label>
          );
        })}
      </fieldset>
      {revealed && (
        <p className={s.explain} role="status">
          <b>{answers.checks[ci] === q.correct ? t('qz.nice') : t('qz.notQuite')}</b> {q.explain}
        </p>
      )}
      <Button variant="primary" size="lg" block disabled={!picked || busy} onClick={() => void next()}>
        {last ? t('qz.finish') : t('qz.next')}
      </Button>
    </div>
  );
}

const LEVEL_KEY = { beginner: 'qz.level.beginner', learning: 'qz.level.learning', experienced: 'qz.level.experienced' } as const satisfies Record<string, MessageKey>;
export const levelLabel = (l: keyof typeof LEVEL_KEY) => t(LEVEL_KEY[l]);

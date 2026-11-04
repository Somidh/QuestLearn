import { motion } from 'motion/react';
import { useState, type FormEvent } from 'react';
import { useGame } from '../../store/game';

export function GoalSign() {
  const { submitGoal, submitting, error } = useGame();
  const [goal, setGoal] = useState('');

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (goal.trim()) void submitGoal(goal.trim());
  }

  return (
    <motion.div
      className="absolute top-[9%] left-[46%] w-[min(600px,48vw)] origin-bottom"
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ rotate: 8, y: 620, opacity: 0, transition: { duration: 0.5, ease: 'easeIn' } }}
      transition={{ type: 'spring', stiffness: 120, damping: 16 }}
    >
      <form
        onSubmit={onSubmit}
        className="relative z-10 rounded-[22px] border-[5px] border-paper bg-sign px-9 pt-7 pb-8 shadow-[0_0_60px_rgba(46,230,166,0.18)]"
      >
        <h1 className="font-display text-7xl leading-none font-semibold text-paper">Where to?</h1>
        <p className="mt-3 text-lg leading-snug text-paper/85">
          Type anything you want to learn. Your tutors will map the road, and reroute it when you
          get stuck.
        </p>

        <label className="sr-only" htmlFor="goal">
          What you want to learn
        </label>
        <div className="mt-6 flex gap-3">
          <input
            id="goal"
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            maxLength={160}
            autoFocus
            autoComplete="off"
            placeholder="system design"
            className="min-w-0 flex-1 rounded-xl bg-paper px-4 py-3 text-xl text-dusk placeholder:text-dusk/45"
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-glow px-5 py-3 font-display text-xl font-medium whitespace-nowrap text-dusk transition-transform hover:-translate-y-0.5 disabled:hover:translate-y-0"
          >
            {submitting ? 'Starting...' : 'Build my road'}
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-dusk/60 px-3 py-2 text-paper">
            {error}
          </p>
        )}
      </form>

      <div aria-hidden className="mx-auto flex w-[62%] justify-between">
        <span className="h-[34vh] w-3.5 bg-gradient-to-b from-[#8d84b8] to-[#3b2c78]" />
        <span className="h-[34vh] w-3.5 bg-gradient-to-b from-[#8d84b8] to-[#3b2c78]" />
      </div>
    </motion.div>
  );
}

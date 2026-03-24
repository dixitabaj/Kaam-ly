import React, { useState, useEffect } from 'react';
import './FeedbackNudge.css';

export default function FeedbackNudge({ message = "Does this look right to you?", onCorrect, onWrong }) {
  const [state, setState] = useState('idle');

  useEffect(() => {
    if (state !== 'idle') return;
    const timer = setTimeout(() => setState('done'), 6000);
    return () => clearTimeout(timer);
  }, [state]);

  if (state === 'done') return null;

  if (state === 'wrong') return (
    <div className="feedback-nudge">
      <div className="feedback-nudge__header">
        <div className="feedback-nudge__dot" />
        <span className="feedback-nudge__title">Help us improve</span>
      </div>
      <span className="feedback-nudge__message">What should it have been?</span>
      <input
        className="feedback-nudge__input"
        type="text"
        placeholder="e.g. Plumbing"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.target.value.trim()) {
            onWrong?.(e.target.value.trim());
            setState('done');
          }
        }}
        autoFocus
      />
      <button
        className="feedback-nudge__cancel"
        onClick={() => setState('idle')}
      >
        Cancel
      </button>
    </div>
  );

  return (
    <div className="feedback-nudge">
      <div className="feedback-nudge__header">
        <span className="feedback-nudge__title">Image detected</span>
      </div>
      <span className="feedback-nudge__message">{message}</span>
      <div className="feedback-nudge__buttons">
        <button
          className="feedback-nudge__btn feedback-nudge__btn--yes"
          onClick={() => { onCorrect?.(); setState('done'); }}
        >
           Correct
        </button>
        <button
          className="feedback-nudge__btn feedback-nudge__btn--no"
          onClick={() => setState('wrong')}
        >
           Wrong
        </button>
      </div>
    </div>
  );
}
import { useState } from 'react';
import { CheckCircle2, CircleHelp } from 'lucide-react';
import { api } from '../utils/api';

export default function TopicSelfAssessment({ topic, onPassed }) {
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async event => {
    event.preventDefault();
    if (!answer || submitting) return;
    setSubmitting(true);
    setError('');
    setFeedback('');
    try {
      const result = await api(`/topics/${topic._id}/self-assessment`, {
        method: 'POST',
        body: JSON.stringify({ answer }),
      });
      setFeedback(result.message);
      if (result.passed) onPassed();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!topic.selfAssessmentPrompt) {
    return <section id="topic-self-assessment" className="error-card" aria-live="polite">The faculty member has not added this topic’s True/False self-assessment yet.</section>;
  }

  if (topic.selfAssessmentPassed) {
    return <section id="topic-self-assessment" className="success-card flex items-center gap-3" aria-live="polite"><CheckCircle2 size={20}/><span>You passed the self-assessment. The topic quiz is unlocked.</span></section>;
  }

  return (
    <section id="topic-self-assessment" className="report-card space-y-4" aria-labelledby="self-assessment-title">
      <div>
        <span className="eyebrow text-tup-crimson"><CircleHelp size={14} className="mr-1 inline"/>Check your understanding</span>
        <h2 id="self-assessment-title" className="section-title">True or False?</h2>
        <p className="mt-2 text-slate-700">{topic.selfAssessmentPrompt}</p>
      </div>
      <form className="space-y-3" onSubmit={submit}>
        <fieldset className="flex flex-wrap gap-3">
          <legend className="sr-only">Choose True or False</legend>
          {['True', 'False'].map(option => (
            <label key={option} className={`answer-option mt-0 ${answer === option ? 'selected' : ''}`}>
              <input type="radio" name={`self-assessment-${topic._id}`} value={option} checked={answer === option} onChange={() => setAnswer(option)}/>
              <span>{option}</span>
            </label>
          ))}
        </fieldset>
        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
        {feedback && <p className="text-sm font-semibold text-tup-crimson" aria-live="polite">{feedback}</p>}
        <button className="btn-primary" type="submit" disabled={!answer || submitting}>{submitting ? 'Checking…' : 'Check answer'}</button>
      </form>
    </section>
  );
}

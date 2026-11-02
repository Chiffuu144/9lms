import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { BookOpen, Plus, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';

const initialForm = { subjectCode: '', subjectName: '', term: '1st Sem', yearLevel: '1st Year' };

export default function Dashboard() {
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();
  const [subjects, setSubjects] = useState([]);
  const [available, setAvailable] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    api('/subjects').then(data => setSubjects(data.subjects || [])).catch(requestError => setError(requestError.message));
    if (user.role === 'student') {
      api('/subjects/all').then(data => setAvailable(data.subjects || [])).catch(requestError => setError(requestError.message));
    }
  }, [user.role]);
  useEffect(() => { load(); }, [load]);

  const enrolledIds = useMemo(() => new Set(subjects.map(subject => String(subject._id))), [subjects]);
  const availableSubjects = available.filter(subject => !enrolledIds.has(String(subject._id)));
  const cardListVariants = reduceMotion ? undefined : {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1], staggerChildren: 0.08 } },
  };

  const createSubject = async event => {
    event.preventDefault();
    setCreating(true);
    setMessage('');
    setError('');
    try {
      await api('/subjects', { method: 'POST', body: JSON.stringify(form) });
      setForm(initialForm);
      setMessage('Subject created successfully.');
      load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCreating(false);
    }
  };
  const enroll = async id => {
    setError('');
    setMessage('');
    try {
      await api(`/subjects/${id}/enroll`, { method: 'POST' });
      setMessage('Successfully enrolled.');
      load();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <main className="page-shell space-y-8">
      <header className="hero-card"><span className="eyebrow">{user.role === 'faculty' ? 'Faculty workspace' : 'Primary learner workspace'}</span><h1>Welcome, {user.fullName}</h1><p>{user.role === 'faculty' ? 'Create and manage your TUP learning subjects.' : 'Choose a subject to begin your guided learning roadmap.'}</p></header>
      {(message || error) && <div className={error ? 'error-card' : 'success-card'} role={error ? 'alert' : 'status'}>{error || message}</div>}
      {user.role === 'faculty' && <section className="glass-card p-6">
        <div className="mb-5 flex items-center gap-3"><span className="feature-icon"><Plus size={19}/></span><div><span className="eyebrow text-tup-crimson">Faculty tools</span><h2 className="section-title">Create a subject</h2></div></div>
        <form onSubmit={createSubject} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <input className="field" placeholder="Subject code" value={form.subjectCode} onChange={event => setForm({ ...form, subjectCode: event.target.value })} required/>
          <input className="field lg:col-span-2" placeholder="Subject name" value={form.subjectName} onChange={event => setForm({ ...form, subjectName: event.target.value })} required/>
          <select className="field" value={form.term} onChange={event => setForm({ ...form, term: event.target.value })}><option>1st Sem</option><option>2nd Sem</option><option>Summer</option></select>
          <select className="field" value={form.yearLevel} onChange={event => setForm({ ...form, yearLevel: event.target.value })}><option>1st Year</option><option>2nd Year</option><option>3rd Year</option><option>4th Year</option><option>Graduate</option></select>
          <motion.button whileTap={reduceMotion ? undefined : { scale: 0.97 }} disabled={creating} className="btn-primary justify-center sm:col-span-2 lg:col-span-1">{creating ? 'Creating...' : 'Create subject'}</motion.button>
        </form>
      </section>}
      {user.role === 'student' && <section>
        <div className="mb-4 flex items-end justify-between gap-3"><div><span className="eyebrow text-tup-crimson">Course catalog</span><h2 className="section-title">{subjects.length ? 'Find more subjects' : 'Find a subject'}</h2><p className="mt-1 text-sm text-slate-600">You can enroll in multiple subjects. Your enrolled subjects remain available on your dashboard.</p></div><BookOpen className="text-tup-gold" size={28}/></div>
        <motion.div variants={cardListVariants} initial={reduceMotion ? false : 'hidden'} animate={reduceMotion ? false : 'visible'} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {availableSubjects.map(subject => <motion.article key={subject._id} variants={reduceMotion ? undefined : { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }} whileHover={reduceMotion ? undefined : { y: -4, scale: 1.01 }} transition={{ duration: 0.18, ease: 'easeOut' }} className="subject-card"><span className="subject-code">{subject.subjectCode}</span><h3>{subject.subjectName}</h3><p>{subject.term} · {subject.yearLevel}</p><motion.button whileTap={reduceMotion ? undefined : { scale: 0.97 }} onClick={() => enroll(subject._id)} className="btn-primary mt-4 w-full justify-center"><UserPlus size={16}/> Enroll now</motion.button></motion.article>)}
          {!availableSubjects.length && <div className="empty-card md:col-span-2 lg:col-span-3">No new subjects are available right now.</div>}
        </motion.div>
      </section>}
      <section>
        <div className="mb-4 flex items-end justify-between gap-3"><div><span className="eyebrow text-tup-crimson">Your learning</span><h2 className="section-title">{user.role === 'faculty' ? 'Your subjects' : 'Enrolled subjects'}</h2></div><span className="status-pill">{subjects.length} subject{subjects.length !== 1 ? 's' : ''}</span></div>
        {subjects.length ? <motion.div variants={cardListVariants} initial={reduceMotion ? false : 'hidden'} animate={reduceMotion ? false : 'visible'} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {subjects.map(subject => <motion.div key={subject._id} variants={reduceMotion ? undefined : { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }} whileHover={reduceMotion ? undefined : { y: -4, scale: 1.01 }} transition={{ duration: 0.18, ease: 'easeOut' }}><Link className="subject-card group block" to={`/subjects/${subject._id}`}><span className="subject-code">{subject.subjectCode}</span><h3>{subject.subjectName}</h3><p>{subject.term} · {subject.yearLevel}</p><span className="topic-link">Open learning roadmap →</span></Link></motion.div>)}
        </motion.div> : <div className="empty-card">No subjects assigned yet. {user.role === 'student' ? 'Choose a subject above to get started.' : 'Create your first subject above.'}</div>}
      </section>
    </main>
  );
}

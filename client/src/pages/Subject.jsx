import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BarChart3, CheckCircle2, ChevronRight, FileText, Lock, Search, Settings, Sparkles, Users } from 'lucide-react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import ScrollReveal from '../components/ScrollReveal';

const defaultTopicTitles = ['Foundations', 'Core Concepts', 'Applied Practice', 'Systems Thinking', 'Advanced Topics', 'Capstone Review'];

export default function Subject() {
  const { id } = useParams();
  const { user } = useAuth();
  const [subject, setSubject] = useState(null);
  const [topics, setTopics] = useState([]);
  const [scores, setScores] = useState([]);
  const [assets, setAssets] = useState([]);
  const [students, setStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const facultyMode = user?.role === 'faculty';
    const subjectRequests = [
      api(`/subjects/${id}`),
      api(`/topics?subjectId=${id}`),
      api(`/scores?subjectId=${id}`),
      api(`/topic-assets?subjectId=${id}`),
      facultyMode ? api(`/subjects/${id}/students`) : Promise.resolve({ students: [] }),
    ];
    Promise.all(subjectRequests)
      .then(([subjectData, topicData, scoreData, assetData, studentData]) => {
        if (!active) return;
        setSubject(subjectData.subject);
        setTopics(topicData.topics || []);
        setScores(scoreData.scores || []);
        setAssets(assetData.assets || []);
        setStudents(studentData.students || []);
      })
      .catch(requestError => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, user?.role]);

  const roadmap = useMemo(() => {
    const count = Math.max(6, ...topics.map(topic => Number(topic.topicNumber) || 0));
    const passed = new Set(scores.filter(score => score.passed).map(score => Number(score.topicNumber)));
    const attempted = new Set(scores.map(score => Number(score.topicNumber)));
    return Array.from({ length: count }, (_, index) => {
      const number = index + 1;
      const studentView = user?.role === 'student';
      return {
        number,
        topic: topics.find(item => Number(item.topicNumber) === number),
        complete: studentView && passed.has(number),
        inProgress: studentView && attempted.has(number) && !passed.has(number),
        unlocked: user?.role === 'faculty' || number === 1 || passed.has(number - 1),
      };
    });
  }, [topics, scores, user?.role]);

  if (loading) return <main className="page-shell"><div className="skeleton h-10 w-2/3"/><div className="skeleton mt-6 h-64"/></main>;
  if (error) return <main className="page-shell"><div className="error-card" role="alert">{error}</div></main>;
  if (!subject) return null;

  const isFaculty = user?.role === 'faculty';
  const visibleStudents = students.filter(student => {
    const query = studentSearch.trim().toLowerCase();
    return !query || [student.fullName, student.studentId, student.email, student.yearLevel, student.section].some(value => String(value || '').toLowerCase().includes(query));
  });
  return (
    <main className="page-shell space-y-8">
      <header className="hero-card">
        <div><span className="eyebrow">{isFaculty ? 'Faculty topic library' : 'Learning pathway'}</span><h1>{subject.subjectCode}<span className="text-tup-gold"> / </span>{subject.subjectName}</h1><p>{subject.term} · {subject.yearLevel} · {isFaculty ? `${roadmap.length} topics available for review and management.` : `${roadmap.length}-topic guided progression.`}</p></div>
        <div className="hero-badge"><Sparkles size={18}/> TUP Learning Hub</div>
      </header>
      {isFaculty && <div className="flex flex-wrap gap-3"><Link to={`/subjects/${id}/manage`} className="btn-primary"><Settings size={16}/> Manage content</Link><Link to={`/subjects/${id}/reports`} className="btn-secondary"><BarChart3 size={16}/> View reports</Link></div>}
      {isFaculty && <section className="report-card space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><span className="eyebrow text-tup-crimson">Class roster</span><h2 className="section-title flex items-center gap-2"><Users size={21}/> Enrolled students</h2></div>
          <span className="status-pill">{students.length} student{students.length === 1 ? '' : 's'}</span>
        </div>
        {students.length > 0 && <label className="relative block max-w-md"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input className="field pl-10" type="search" value={studentSearch} onChange={event => setStudentSearch(event.target.value)} placeholder="Search name, student ID, year, or section" aria-label="Search enrolled students"/></label>}
        {visibleStudents.length ? <div className="overflow-x-auto"><table className="report-table"><thead><tr><th>Student</th><th>Student ID</th><th>Year level</th><th>Section</th><th>Email</th></tr></thead><tbody>
          {visibleStudents.map(student => <tr key={student._id}><td className="font-semibold">{student.fullName}</td><td>{student.studentId || '—'}</td><td>{student.yearLevel || '—'}</td><td>{student.section || '—'}</td><td>{student.email}</td></tr>)}
        </tbody></table></div> : <div className="empty-card py-8">{students.length ? 'No enrolled students match your search.' : 'No students have enrolled in this subject yet.'}</div>}
      </section>}
      <section className="glass-card p-5 sm:p-7">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><span className="eyebrow">{isFaculty ? 'Topic library' : 'Your roadmap'}</span><h2 className="section-title">{isFaculty ? `Review Topics 1–${roadmap.length} anytime` : 'Progress one milestone at a time'}</h2></div><span className="status-pill">{isFaculty ? `${roadmap.length}/${roadmap.length} available` : `${roadmap.filter(item => item.complete).length}/${roadmap.length} completed`}</span></div>
        <div className="roadmap">
          {roadmap.map(({ number, topic, complete, inProgress, unlocked }, index) => {
            const fileCount = assets.filter(asset => asset.path.toLowerCase().includes(`g${number}`) || asset.path.toLowerCase().includes(`topic-${number}`)).length;
            const title = topic?.title || defaultTopicTitles[index] || `Topic ${number}`;
            const href = isFaculty ? `/subjects/${id}/topic/${number}/edit` : `/subjects/${id}/topic/${number}/view`;
            return (
              <ScrollReveal className="roadmap-item" index={index} key={number}>
                <div className={`roadmap-node ${complete ? 'is-complete' : ''} ${unlocked ? 'is-unlocked' : ''}`} aria-label={complete ? 'Completed' : inProgress ? 'In progress' : unlocked ? 'Unlocked' : 'Locked'}>
                  {complete ? <CheckCircle2 size={20}/> : !unlocked ? <Lock size={16}/> : <span>{number}</span>}
                </div>
                {index < roadmap.length - 1 && <div className={`roadmap-line ${complete ? 'is-complete' : ''}`}/>}
                <div className="roadmap-copy">
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Topic {number} · {complete ? 'Completed' : inProgress ? 'In progress' : unlocked ? 'Ready' : 'Locked'}</span>
                  <h3>{title}</h3><p>{topic?.description || (topic ? 'Lesson content is being prepared.' : 'Faculty has not published this topic yet.')}</p>
                  {fileCount > 0 && <span className="asset-hint"><FileText size={13}/>{fileCount} material{fileCount > 1 ? 's' : ''}</span>}
                  {unlocked ? <Link className="topic-link" to={href}>{isFaculty ? 'Edit topic' : complete ? 'Review topic' : 'Open topic'}<ChevronRight size={16}/></Link> : <span className="locked-copy">Pass Topic {number - 1} with 75% to unlock</span>}
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </section>
    </main>
  );
}

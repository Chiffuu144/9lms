import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Download, ExternalLink, FileText, Fullscreen, Image as ImageIcon, Presentation, ScrollText, TimerReset } from 'lucide-react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import InteractivePPT from '../components/InteractivePPT';
import TopicSelfAssessment from '../components/TopicSelfAssessment';
import slides from '../data/cybersecurityTopic';
import sanitizeHtml from '../utils/sanitizeHtml';

const apiOrigin = import.meta.env.VITE_API_URL || '';
const formatSize = bytes => bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export default function Topic() {
  const { id, topicNum } = useParams();
  const { user } = useAuth();
  const [topic, setTopic] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [assets, setAssets] = useState([]);
  const [complete, setComplete] = useState(false);
  const [tab, setTab] = useState('notes');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([
      api(`/topics/subject/${id}/topic/${topicNum}`),
      api(`/quizzes?subjectId=${id}`),
      api(`/topic-assets?subjectId=${id}&topicNum=${topicNum}`),
      api(`/topics/access?subjectId=${id}&topicNumber=${topicNum}`),
      api(`/scores?subjectId=${id}`),
    ]).then(([topicData, quizData, files, access, scoreData]) => {
      if (!access.allowed) throw new Error(access.reason);
      if (!active) return;
      const current = topicData.topic;
      setTopic(current);
      setQuiz(quizData.quizzes.find(item => String(item.topicId) === String(current._id)) || null);
      setAssets(files.assets || []);
      setComplete(scoreData.scores?.some(score => score.passed && Number(score.topicNumber) === Number(topicNum)));
    }).catch(requestError => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, topicNum]);

  const primary = useMemo(() => assets.find(asset => asset.extension === '.pdf') || assets[0], [assets]);
  const refreshQuiz = async () => {
    setTopic(current => ({ ...current, selfAssessmentPassed: true }));
    try {
      const data = await api(`/quizzes?subjectId=${id}`);
      setQuiz(data.quizzes.find(item => String(item.topicId) === String(topic._id)) || null);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  if (loading) return <main className="page-shell"><div className="skeleton h-10 w-2/3"/><div className="skeleton mt-6 h-64"/></main>;
  if (error) return <main className="page-shell page-enter"><div className="error-card" role="alert">{error}<Link className="topic-link" to={`/subjects/${id}`}>Return to roadmap</Link></div></main>;
  if (!topic) return null;

  const assetUrl = file => `${apiOrigin}${file.url}`;
  const tabs = [['notes', 'Notes', ScrollText], ['materials', 'Materials', FileText], ['quiz', 'Quiz', Presentation]];
  return (
    <main className="page-shell topic-page">
      <Link to={`/subjects/${id}`} className="back-link">← Back to roadmap</Link>
      <header className="hero-card topic-hero topic-hero-modern"><div><span className="eyebrow">Topic {topicNum} · Lesson studio</span><h1>{topic.title}</h1><p>{topic.description}</p></div><div className="topic-meta"><span><TimerReset size={16}/> Quiz up to 20 min</span><span><FileText size={16}/> {assets.length} assets</span>{complete && <span>✓ Verified complete</span>}</div></header>
      {Number(topicNum) === 2 && <section className="presentation-feature"><div className="section-heading"><div><span className="eyebrow">Interactive presentation</span><h2 className="section-title">Topic 2: Cybersecurity Management</h2></div><span className="text-sm text-slate-500">{slides.length} slides</span></div><InteractivePPT/></section>}
      <nav className="tab-bar modern-tab-bar" aria-label="Lesson sections">{tabs.map(([key, label, Icon]) => <button key={key} onClick={() => setTab(key)} className={tab === key ? 'active' : ''}><Icon size={17}/>{label}</button>)}</nav>
      <div>
        {tab === 'notes' && <>
          <article className="lesson-card prose modern-content-card" dangerouslySetInnerHTML={{ __html: sanitizeHtml(topic.richTextContent || '<p>Lesson notes for this topic are being prepared. Explore the available materials below.</p>') }}/>
          {topic.summary && <section className="summary-card modern-summary-card"><span className="eyebrow text-tup-crimson">Topic summary</span><p>{topic.summary}</p></section>}
          {user?.role === 'student' && <TopicSelfAssessment topic={topic} onPassed={refreshQuiz}/>}
          {user?.role === 'student' && <section className="report-card flex flex-wrap items-center justify-between gap-4" aria-label="Continue to topic quiz">
            <div><span className="eyebrow text-tup-crimson">Ready for the knowledge check?</span><h2 className="section-title">Done reviewing?</h2><p className="mt-1 text-sm text-slate-600">{topic.selfAssessmentPassed ? quiz ? 'Continue to the topic quiz when you’re ready.' : 'The quiz has not been published yet.' : 'Pass the True/False check above to unlock the quiz.'}</p></div>
            {topic.selfAssessmentPassed && quiz
              ? <Link className="btn-primary" to={`/subjects/${id}/topic/${topicNum}/quiz`}>Take the quiz <ExternalLink size={16}/></Link>
              : <button className="btn-secondary" type="button" disabled={!topic.selfAssessmentPrompt || topic.selfAssessmentPassed} onClick={() => document.getElementById('topic-self-assessment')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>{topic.selfAssessmentPassed ? 'Quiz coming soon' : 'Go to self-assessment'}</button>}
          </section>}
        </>}
        {tab === 'materials' && <section className="space-y-5"><div className="section-heading"><div><span className="eyebrow">Course materials</span><h2 className="section-title">Learn at your own pace</h2></div><span className="text-sm text-slate-500">{assets.length} file{assets.length !== 1 ? 's' : ''}</span></div>{primary?.extension === '.pdf' && <div className="pdf-frame modern-pdf-frame"><div className="flex items-center justify-between border-b bg-slate-50 p-3"><span className="flex items-center gap-2 font-semibold"><FileText size={17} className="text-tup-crimson"/>{primary.name}</span><a href={assetUrl(primary)} target="_blank" rel="noreferrer" className="icon-button" title="Open full screen"><Fullscreen size={17}/></a></div><iframe title={`${topic.title} PDF viewer`} src={assetUrl(primary)} className="h-[min(70vh,720px)] w-full"/></div>}{assets.length === 0 && <div className="empty-card">No files have been added to this topic yet.</div>}<div className="grid gap-3 sm:grid-cols-2">{assets.map(asset => <a key={asset.path} href={assetUrl(asset)} download className="asset-card"><span className="asset-icon">{asset.extension === '.pptx' ? <Presentation size={21}/> : asset.extension === '.pdf' ? <FileText size={21}/> : <ImageIcon size={21}/>}</span><span className="min-w-0 flex-1"><b className="block truncate">{asset.name}</b><small>{asset.extension.replace('.', '').toUpperCase()} · {formatSize(asset.size)}</small></span><Download size={17}/></a>)}</div></section>}
        {tab === 'quiz' && <section className="quiz-card modern-content-card">{user?.role === 'student' && !topic.selfAssessmentPassed ? <><span className="eyebrow">Quiz prerequisite</span><h2 className="section-title">Complete the topic check first</h2><p>Answer the True/False self-assessment in the Notes tab to unlock this quiz.</p><button className="btn-primary mt-5" onClick={() => setTab('notes')}>Go to lesson notes</button></> : quiz ? <><span className="eyebrow">Knowledge check</span><h2 className="section-title">{quiz.title}</h2><p>{quiz.questionCount || quiz.questions?.length || 0} questions · {Math.round((quiz.timeLimit || 600) / 60)} minutes · Passing score 75%</p>{user?.role === 'student' && <Link className="btn-primary mt-5" to={`/subjects/${id}/topic/${topicNum}/quiz`}>Start quiz <ExternalLink size={16}/></Link>}</> : <div className="empty-copy">The quiz for this topic is not available yet.</div>}</section>}
      </div>
    </main>
  );
}

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Download, FileText, Maximize2, Presentation } from 'lucide-react';
import { api } from '../utils/api';
import InteractivePPT from '../components/InteractivePPT';
import PptxPreview from '../components/PptxPreview';
import TopicSelfAssessment from '../components/TopicSelfAssessment';
import sanitizeHtml from '../utils/sanitizeHtml';

const apiOrigin = import.meta.env.VITE_API_URL || '';
const formatSize = bytes => bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
const resolveAssetUrl = url => /^https?:\/\//i.test(url) ? url : `${apiOrigin}${url}`;

export default function StudentTopicView() {
  const { id, topicNum } = useParams();
  const [topic, setTopic] = useState(null);
  const [assets, setAssets] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setTopic(null);
    setError('');
    setLoading(true);
    Promise.all([
      api(`/topics/subject/${id}/topic/${topicNum}`),
      api(`/topic-assets?subjectId=${id}&topicNum=${topicNum}`),
    ])
      .then(([{ topic: data }, assetData]) => {
        if (!active) return;
        setTopic(data);
        setAssets(assetData.assets || []);
      })
      .catch(requestError => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, topicNum]);

  if (loading) return <main className="page-shell"><div className="skeleton h-64"/></main>;
  if (error) return <main className="page-shell"><div className="error-card" role="alert">{error}<Link className="topic-link" to={`/subjects/${id}`}>Return to roadmap</Link></div></main>;
  if (!topic) return null;

  const slides = (topic.customSlides || []).map((slide, index) => ({
    id: slide.slideNumber || index + 1,
    section: `Topic ${topicNum}`,
    title: slide.title || `Slide ${index + 1}`,
    subtitle: slide.content,
    bullets: slide.bullets || [],
    image: slide.imageUrl || null,
  }));
  const fileUrl = `${import.meta.env.VITE_API_URL || ''}/api/topics/${topic._id}/file`;
  const materials = [
    ...(topic.uploadedFileUrl ? [{
      name: topic.uploadedFileName || 'Topic presentation',
      extension: (topic.uploadedFileName || '').toLowerCase().match(/\.[^.]+$/)?.[0] || '',
      url: fileUrl,
      size: null,
    }] : []),
    ...assets,
  ];

  return (
    <main className="page-shell space-y-6">
      <Link to={`/subjects/${id}`} className="back-link">← Back to roadmap</Link>
      <header className="hero-card topic-hero">
        <div><span className="eyebrow">Topic {topicNum} · Student view</span><h1>{topic.title}</h1><p>{topic.description}</p></div>
        {topic.isVerifiedComplete && <span className="verified-badge"><CheckCircle2 size={16}/> VERIFIED COMPLETE [TRUE]</span>}
      </header>
      <section className="report-card space-y-5">
        <div className="section-heading"><div><span className="eyebrow">Course materials</span><h2 className="section-title">Files uploaded by faculty</h2></div><span className="status-pill">{materials.length} file{materials.length === 1 ? '' : 's'}</span></div>
        {materials.length ? <div className="space-y-4">
          {materials.map((file, index) => {
            const pdf = file.extension === '.pdf';
            const pptx = file.extension === '.pptx';
            const legacyPowerPoint = file.extension === '.ppt';
            return <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white" key={`${file.url}-${index}`}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50 p-3">
                <span className="min-w-0 flex-1 truncate font-semibold"><FileText size={17} className="mr-2 inline text-tup-crimson"/>{file.name}</span>
                <div className="flex items-center gap-2">
                  <a href={resolveAssetUrl(file.url)} download={file.name} className="btn-secondary"><Download size={15}/>Download</a>
                  {topic.uploadedFileUrl && file.url === fileUrl && <a href={fileUrl} target="_blank" rel="noreferrer" className="icon-button" title="Open presentation"><Maximize2 size={17}/></a>}
                </div>
              </div>
              {pdf && <iframe title={file.name} src={resolveAssetUrl(file.url)} className="h-[min(70vh,720px)] w-full"/>}
              {pptx && <PptxPreview url={file.url} name={file.name}/>}
              {legacyPowerPoint && <p className="flex items-center gap-2 p-4 text-sm text-slate-600"><Presentation size={17}/>This older .ppt file format cannot be previewed in the browser. Download it to view the slides.</p>}
              <p className="border-t bg-slate-50 px-3 py-2 text-xs text-slate-500">{file.extension.replace('.', '').toUpperCase() || 'FILE'}{file.size ? ` · ${formatSize(file.size)}` : ''}</p>
            </article>;
          })}
        </div> : <div className="empty-card">No files have been uploaded for this topic yet.</div>}
      </section>
      {slides.length > 0 && <section><div className="section-heading"><div><span className="eyebrow">Custom presentation</span><h2 className="section-title">Slide lesson</h2></div></div><InteractivePPT slideData={slides}/></section>}
      <article className="lesson-card prose" dangerouslySetInnerHTML={{ __html: sanitizeHtml(topic.richTextContent || topic.lessonContent || '<p>No lesson notes have been published yet.</p>') }}/>
      {(topic.summary || topic.summaryCard) && <section className="summary-card"><span className="eyebrow text-tup-crimson">Topic summary</span><p>{topic.summary || topic.summaryCard}</p></section>}
      <TopicSelfAssessment topic={topic} onPassed={() => setTopic(current => ({ ...current, selfAssessmentPassed: true }))}/>
      {topic.selfAssessmentPassed && topic.quizAvailable && <section className="report-card flex flex-wrap items-center justify-between gap-4">
        <div><span className="eyebrow text-tup-crimson">Ready for the knowledge check?</span><h2 className="section-title">Done reviewing?</h2><p className="mt-1 text-sm text-slate-600">Your self-assessment is complete. Take the quiz when you’re ready.</p></div>
        <Link className="btn-primary" to={`/subjects/${id}/topic/${topicNum}/quiz`}>Take the quiz</Link>
      </section>}
      {topic.selfAssessmentPassed && !topic.quizAvailable && <div className="empty-copy">The faculty member has not published this topic’s quiz yet.</div>}
    </main>
  );
}

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, FileText, GripVertical, Image, Plus, Save, Trash2, Upload } from 'lucide-react';
import { api } from '../utils/api';
import { useToast } from '../context/ToastContext';

const emptySlide = number => ({
  slideNumber: number,
  title: '',
  content: '',
  bullets: [''],
  imageUrl: '',
});

const emptyTopic = (subjectId, topicNumber) => ({
  subjectId,
  topicNumber: Number(topicNumber),
  title: `Topic ${topicNumber}`,
  description: '',
  richTextContent: '',
  uploadedFileUrl: '',
  uploadedFileName: '',
  customSlides: [],
  summary: '',
  isVerifiedComplete: false,
});

const normalizeTopic = (data, subjectId, topicNumber) => ({
  ...emptyTopic(subjectId, topicNumber),
  ...data,
  richTextContent: data.richTextContent || data.lessonContent || '',
  summary: data.summary || data.summaryCard || '',
  customSlides: data.customSlides?.length
    ? data.customSlides
    : (data.slides || []).map((slide, index) => ({
        ...slide,
        slideNumber: index + 1,
        bullets: slide.bullets || [],
      })),
});

export default function FacultyTopicEditor() {
  const { id, topicNum } = useParams();
  const { notify } = useToast();
  const [topic, setTopic] = useState(emptyTopic(id, topicNum));
  const [selectedSlide, setSelectedSlide] = useState(0);
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api(`/topics/subject/${id}/topic/${topicNum}`)
      .then(({ topic: data }) => {
        const normalized = normalizeTopic(data, id, topicNum);
        setTopic(normalized);
        setSelectedSlide(0);
      })
      .catch(err => {
        if (!err.message.toLowerCase().includes('not found')) setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [id, topicNum]);

  const update = (key, value) => setTopic(current => ({ ...current, [key]: value }));
  const updateSlide = (key, value) => {
    setTopic(current => ({
      ...current,
      customSlides: current.customSlides.map((slide, index) =>
        index === selectedSlide ? { ...slide, [key]: value } : slide
      ),
    }));
  };
  const addSlide = () => {
    setTopic(current => ({
      ...current,
      customSlides: [...current.customSlides, emptySlide(current.customSlides.length + 1)],
    }));
    setSelectedSlide(topic.customSlides.length);
  };
  const removeSlide = index => {
    const slides = topic.customSlides
      .filter((_, slideIndex) => slideIndex !== index)
      .map((slide, slideIndex) => ({ ...slide, slideNumber: slideIndex + 1 }));
    setTopic(current => ({ ...current, customSlides: slides }));
    setSelectedSlide(Math.max(0, Math.min(index, slides.length - 1)));
  };
  const save = async event => {
    event.preventDefault();
    setMessage('');
    setError('');
    try {
      let current = topic;
      if (!current._id) {
        const created = await api('/topics', {
          method: 'POST',
          body: JSON.stringify({
            subjectId: id,
            topicNumber: Number(topicNum),
            title: topic.title,
            description: topic.description,
          }),
        });
        current = { ...topic, ...created.topic };
        setTopic(current);
      }
      const result = await api(`/topics/${current._id}`, {
        method: 'PUT',
        body: JSON.stringify(current),
      });
      setTopic(result.topic);
      if (file) {
        const form = new FormData();
        form.append('file', file);
        const uploaded = await api(`/topics/${current._id}/upload`, { method: 'POST', body: form });
        setTopic(uploaded.topic);
        setFile(null);
      }
      setMessage('');
      notify('Topic content saved successfully. Refreshing...');
      window.setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      setError(err.message);
      notify(err.message, 'error');
    }
  };

  if (loading) return <main className="page-shell"><div className="skeleton h-64" /></main>;
  const slide = topic.customSlides[selectedSlide];

  return (
    <main className="page-shell space-y-6">
      <Link to={`/subjects/${id}/manage`} className="back-link">← Back to content management</Link>
      <header className="hero-card">
        <span className="eyebrow">Faculty topic editor · Topic {topicNum}</span>
        <h1>{topic.title}</h1>
        <p>Create the lesson content and presentation in one workspace.</p>
        {topic.isVerifiedComplete && <span className="verified-badge"><CheckCircle2 size={16} /> STATUS: VERIFIED COMPLETE [TRUE]</span>}
      </header>
      {(message || error) && <div className={error ? 'error-card' : 'success-card'}>{error || message}</div>}

      <form onSubmit={save} className="space-y-6">
        <section className="report-card space-y-4">
          <span className="eyebrow">Topic identity</span>
          <h2 className="section-title">Basic details</h2>
          <input className="field" value={topic.title} onChange={event => update('title', event.target.value)} placeholder="Topic title" required />
          <input className="field" value={topic.description} onChange={event => update('description', event.target.value)} placeholder="Short description" />
        </section>

        <section className="report-card space-y-4">
          <span className="eyebrow">Insert text</span>
          <h2 className="section-title">Lesson notes</h2>
          <textarea className="field min-h-64" value={topic.richTextContent} onChange={event => update('richTextContent', event.target.value)} placeholder="Type or paste lesson notes. HTML formatting is supported." />
        </section>

        <section className="report-card space-y-4">
          <span className="eyebrow">Upload presentation</span>
          <h2 className="section-title">PDF or PowerPoint</h2>
          <label className="upload-dropzone">
            <Upload size={24} />
            <span>{file ? file.name : topic.uploadedFileName || 'Choose a PDF, PPT, or PPTX file'}</span>
            <small>Drag and drop or browse from your computer</small>
            <input type="file" accept=".pdf,.ppt,.pptx,application/pdf" onChange={event => setFile(event.target.files?.[0] || null)} />
          </label>
          {topic.uploadedFileUrl && <div className="asset-card"><FileText size={20} /><span className="flex-1"><b>{topic.uploadedFileName}</b><small>Current presentation attached</small></span><a className="topic-link" href={topic.uploadedFileUrl} target="_blank" rel="noreferrer">Preview</a></div>}
        </section>

        <section className="report-card slide-workspace">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><span className="eyebrow">Make your own slides</span><h2 className="section-title">Custom slide builder</h2></div>
            <button type="button" className="btn-secondary" onClick={addSlide}><Plus size={16} /> Add slide</button>
          </div>
          <div className="slide-workspace-layout">
            <aside className="slide-thumbnails" aria-label="Presentation slides">
              {topic.customSlides.map((item, index) => (
                <button type="button" key={`${item.slideNumber}-${index}`} className={`slide-thumbnail ${index === selectedSlide ? 'selected' : ''}`} onClick={() => setSelectedSlide(index)}>
                  <span className="slide-thumbnail-number">Slide {index + 1}</span>
                  <strong>{item.title || 'Untitled slide'}</strong>
                  <small>{item.bullets?.filter(Boolean).length || 0} bullet points</small>
                </button>
              ))}
              {!topic.customSlides.length && <p className="empty-copy">Click “Add slide” to start your presentation.</p>}
            </aside>
            <div className="slide-editor-panel">
              {slide ? <>
                <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 font-bold"><GripVertical size={17} className="text-slate-400" /> Slide {selectedSlide + 1}</span><button type="button" className="text-red-600" onClick={() => removeSlide(selectedSlide)}><Trash2 size={16} /> Remove</button></div>
                <input className="field mt-4" value={slide.title} onChange={event => updateSlide('title', event.target.value)} placeholder="Slide title" />
                <textarea className="field mt-3 min-h-32" value={slide.content} onChange={event => updateSlide('content', event.target.value)} placeholder="Slide content" />
                <textarea className="field mt-3" value={slide.bullets.join(' | ')} onChange={event => updateSlide('bullets', event.target.value.split('|').map(item => item.trim()))} placeholder="Bullets separated with |" />
                <div className="relative mt-3"><Image size={16} className="pointer-events-none absolute left-3 top-3 text-slate-400" /><input className="field pl-10" value={slide.imageUrl} onChange={event => updateSlide('imageUrl', event.target.value)} placeholder="Optional image URL" /></div>
                <div className="slide-live-preview"><span>Live preview</span><h3>{slide.title || `Slide ${selectedSlide + 1}`}</h3><p>{slide.content || 'Your slide content will appear here.'}</p>{slide.bullets.filter(Boolean).map((bullet, index) => <div key={index}>• {bullet}</div>)}</div>
              </> : <div className="empty-card">Select a slide to edit, or add your first slide.</div>}
            </div>
          </div>
        </section>

        <section className="report-card space-y-4">
          <span className="eyebrow">Summary</span>
          <h2 className="section-title">Lesson takeaway</h2>
          <textarea className="field min-h-32" value={topic.summary} onChange={event => update('summary', event.target.value)} placeholder="Write the key takeaway for students." />
        </section>
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <label className="flex items-center gap-3 font-semibold text-slate-800"><input type="checkbox" checked={topic.isVerifiedComplete} onChange={event => update('isVerifiedComplete', event.target.checked)} /> Mark as verified complete [TRUE]</label>
          <button className="btn-primary"><Save size={17} /> Save topic content</button>
        </section>
      </form>
    </main>
  );
}

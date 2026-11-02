import {useEffect,useMemo,useState} from 'react';
import {Link,useNavigate,useParams} from 'react-router-dom';
import {Download,ExternalLink,FileText,Fullscreen,Image as ImageIcon,Presentation,ScrollText,TimerReset} from 'lucide-react';
import {api} from '../utils/api';
import InteractivePPT from '../components/InteractivePPT';
import slides from '../data/cybersecurityTopic';

const apiOrigin=import.meta.env.VITE_API_URL||'';
const formatSize=bytes=>bytes>1024*1024?`${(bytes/1024/1024).toFixed(1)} MB`:`${Math.max(1,Math.round(bytes/1024))} KB`;
const fallbackTopic=number=>({topicNumber:Number(number),title:Number(number)===2?'Managing Cybersecurity: Governance, Roles, and Structure':`Topic ${number}`,description:Number(number)===2?'Interactive cybersecurity presentation and learning materials.':'Topic materials and lesson content.',lessonContent:'',summaryCard:''});

export default function Topic(){
  const {id,topicNum}=useParams();
  const navigate=useNavigate();
  const [topic,setTopic]=useState(null);
  const [quiz,setQuiz]=useState(null);
  const [assets,setAssets]=useState([]);
  const [complete,setComplete]=useState(false);
  const [tab,setTab]=useState('notes');
  const [error,setError]=useState('');

  useEffect(()=>{let active=true;Promise.all([api(`/topics?subjectId=${id}`),api(`/quizzes?subjectId=${id}`),api(`/topic-assets?topicNum=${topicNum}`),api(`/topics/access?subjectId=${id}&topicNumber=${topicNum}`),api(`/scores?subjectId=${id}`)]).then(([topics,quizzes,files,access,scores])=>{if(!access.allowed)throw new Error(access.reason);if(!active)return;const current=topics.topics.find(item=>String(item.topicNumber)===topicNum)||fallbackTopic(topicNum);setTopic(current);setQuiz(quizzes.quizzes.find(item=>String(item.topicId)===String(current._id)));setAssets(files.assets);setComplete(scores.scores?.some(score=>score.passed&&Number(score.topicNumber)===Number(topicNum)));}).catch(err=>{if(active)setError(err.message);});return()=>{active=false;};},[id,topicNum]);
  const primary=useMemo(()=>assets.find(asset=>asset.extension==='.pdf')||assets[0],[assets]);
  if(error)return <main className="page-shell page-enter"><div className="error-card">{error}<Link className="topic-link" to={`/subjects/${id}`}>Return to roadmap</Link></div></main>;
  if(!topic)return <main className="page-shell"><div className="skeleton h-10 w-2/3"/><div className="skeleton h-64 mt-6"/></main>;
  const assetUrl=file=>`${apiOrigin}${file.url}`;
  const tabs=[['notes','Notes',ScrollText],['materials','Materials',FileText],['quiz','Quiz',Presentation]];

  return <main className="page-shell topic-page">
    <Link to={`/subjects/${id}`} className="back-link">← Back to roadmap</Link>
    <header className="hero-card topic-hero topic-hero-modern"><div><span className="eyebrow">Topic {topicNum} · Lesson studio</span><h1>{topic.title}</h1><p>{topic.description}</p></div><div className="topic-meta"><span><TimerReset size={16}/> 10 min quiz</span><span><FileText size={16}/> {assets.length} assets</span>{complete&&<span>✓ Verified complete</span>}</div></header>
    {topicNum==='2'&&<section className="presentation-feature"><div className="section-heading"><div><span className="eyebrow">Interactive presentation</span><h2 className="section-title">Topic 2: Cybersecurity Management</h2></div><span className="text-sm text-slate-500">{slides.length} slides</span></div><InteractivePPT/></section>}
    <nav className="tab-bar modern-tab-bar" aria-label="Lesson sections">{tabs.map(([key,label,Icon])=><button key={key} onClick={()=>setTab(key)} className={tab===key?'active':''}><Icon size={17}/>{label}</button>)}</nav>
    <div>
      {tab==='notes'&&<><article className="lesson-card prose modern-content-card" dangerouslySetInnerHTML={{__html:topic.lessonContent||`<p class="empty-copy">Lesson notes for this topic are being prepared. Explore the available materials below.</p>`}}/>{topic.summaryCard&&<section className="summary-card modern-summary-card"><span className="eyebrow text-tup-crimson">Topic summary</span><p>{topic.summaryCard}</p></section>}</>}
      {tab==='materials'&&<section className="space-y-5"><div className="section-heading"><div><span className="eyebrow">Course materials</span><h2 className="section-title">Learn at your own pace</h2></div><span className="text-sm text-slate-500">{assets.length} file{assets.length!==1?'s':''}</span></div>{primary?.extension==='.pdf'&&<div className="pdf-frame modern-pdf-frame"><div className="flex items-center justify-between border-b bg-slate-50 p-3"><span className="flex items-center gap-2 font-semibold"><FileText size={17} className="text-tup-crimson"/>{primary.name}</span><a href={assetUrl(primary)} target="_blank" rel="noreferrer" className="icon-button" title="Open full screen"><Fullscreen size={17}/></a></div><iframe title={`${topic.title} PDF viewer`} src={assetUrl(primary)} className="h-[min(70vh,720px)] w-full" /></div>}{assets.length===0&&<div className="empty-card">No files have been added to this topic yet.</div>}<div className="grid gap-3 sm:grid-cols-2">{assets.map(asset=><a key={asset.path} href={assetUrl(asset)} download className="asset-card"><span className="asset-icon">{asset.extension==='.pptx'?<Presentation size={21}/>:asset.extension==='.pdf'?<FileText size={21}/>:<ImageIcon size={21}/>}</span><span className="min-w-0 flex-1"><b className="block truncate">{asset.name}</b><small>{asset.extension.replace('.','').toUpperCase()} · {formatSize(asset.size)}</small></span><Download size={17}/></a>)}</div></section>}
      {tab==='quiz'&&<section className="quiz-card modern-content-card">{quiz?<><span className="eyebrow">Knowledge check</span><h2 className="section-title">{quiz.title}</h2><p>{quiz.questionCount||quiz.questions?.length||0} questions · {Math.round((quiz.timeLimit||600)/60)} minutes · Passing score {quiz.passingScore||75}%</p><button className="btn-primary mt-5" onClick={()=>navigate(`/subjects/${id}/topic/${topicNum}/quiz`)}>Start quiz <ExternalLink size={16}/></button></>:<div className="empty-copy">The quiz for this topic is not available yet.</div>}</section>}
    </div>
  </main>;
}

import {Link} from 'react-router-dom';
import {useEffect,useMemo,useState} from 'react';
import {BookOpen,ChevronRight,Check,Clock3,Download,FileSpreadsheet,FileText,GraduationCap,LayoutDashboard,Lock,LogOut,Menu,Printer,Search,Target,Trophy,UserRound,X} from 'lucide-react';
import {useAuth} from '../context/AuthContext';
import {api,exportRowsToCsv} from '../utils/api';
import * as XLSX from 'xlsx';
import {jsPDF} from 'jspdf';
import StatsCard from '../components/StatsCard';
import ProfileAvatar from '../components/ProfileAvatar';

const topicLabels=['Foundations','Core Concepts','Applied Practice','Systems Thinking','Advanced Topics','Capstone Review'];

export default function StudentDashboard(){
  const {user,logout}=useAuth();
  const [subjects,setSubjects]=useState([]);
  const [selectedId,setSelectedId]=useState('');
  const [topics,setTopics]=useState([]);
  const [scores,setScores]=useState([]);
  const [mobileOpen,setMobileOpen]=useState(false);
  const [error,setError]=useState('');

  useEffect(()=>{api('/subjects').then(data=>{setSubjects(data.subjects||[]);setSelectedId(current=>current||data.subjects?.[0]?._id||'');}).catch(err=>setError(err.message));},[]);
  useEffect(()=>{if(!selectedId)return;Promise.all([api(`/topics?subjectId=${selectedId}`),api(`/scores?subjectId=${selectedId}`)]).then(([topicData,scoreData])=>{setTopics(topicData.topics||[]);setScores(scoreData.scores||[]);}).catch(err=>setError(err.message));},[selectedId]);

  const subject=subjects.find(item=>String(item._id)===String(selectedId));
  const passed=useMemo(()=>new Set(scores.filter(score=>score.passed).map(score=>Number(score.topicNumber))),[scores]);
  const topicCount=Math.max(6,...topics.map(topic=>Number(topic.topicNumber)||0));
  const activeTopic=useMemo(()=>{const next=Array.from({length:topicCount},(_,index)=>index+1).find(number=>!passed.has(number));return next||topicCount;},[passed,topicCount]);
  const activeTopicData=topics.find(topic=>Number(topic.topicNumber)===activeTopic);
  const completedCount=Math.min(passed.size,topicCount);
  const bestScores=new Map();
  scores.forEach(score=>{const number=Number(score.topicNumber);const current=bestScores.get(number);if(!current||Number(score.percentage)>Number(current.percentage))bestScores.set(number,score);});
  const bestScoreList=[...bestScores.values()];
  const average=bestScoreList.length?Math.round(bestScoreList.reduce((total,score)=>total+Number(score.percentage||0),0)/bestScoreList.length):0;
  const scoreRows=Array.from({length:topicCount},(_,index)=>{const number=index+1;const score=bestScores.get(number);return {Topic:`Topic ${number}`,Score:score?`${score.percentage}%`:'',Status:score?(score.passed?'PASSED':'FAILED'):'INCOMPLETE'};});
  const progressPercent=Math.round((completedCount/topicCount)*100);
  const pathComplete=topicCount>0&&completedCount===topicCount;
  const exportXlsx=()=>{const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(scoreRows),'My Scores');XLSX.writeFile(book,'group9-my-scores.xlsx');};
  const exportPdf=()=>{const doc=new jsPDF();doc.text(`${subject?.subjectName||'GROUP9'} — My Scores`,14,15);scoreRows.forEach((row,index)=>doc.text(`${row.Topic} | ${row.Score||'—'} | ${row.Status}`,14,28+index*7));doc.save('group9-my-scores.pdf');};
  const closeMobile=()=>setMobileOpen(false);

  const sidebar=<aside className={`student-sidebar ${mobileOpen?'is-open':''}`}>
    <div className="student-sidebar-head"><Link to="/student/dashboard" className="student-brand" onClick={closeMobile}><span className="student-brand-mark"><GraduationCap size={19}/></span><span><b>GROUP9</b><small>TUP LMS</small></span></Link><button className="student-sidebar-close" onClick={closeMobile} aria-label="Close navigation"><X size={18}/></button></div>
    <nav className="student-sidebar-nav" aria-label="Student navigation">
      <span className="student-nav-label">Workspace</span>
      <Link className="student-side-link active" to="/student/dashboard" onClick={closeMobile}><LayoutDashboard size={17}/>Dashboard</Link>
      <Link className="student-side-link" to="/subjects" onClick={closeMobile}><BookOpen size={17}/>Browse subjects</Link>
      <Link className="student-side-link" to={subject?`/subjects/${subject._id}`:'/subjects'} onClick={closeMobile}><BookOpen size={17}/>Topic roadmap</Link>
      <Link className="student-side-link" to="/profile" onClick={closeMobile}><UserRound size={17}/>Profile settings</Link>
    </nav>
    <div className="student-side-subjects"><span className="student-nav-label">My subjects</span>{subjects.length?subjects.map(item=><button className={`student-subject-link ${String(item._id)===String(selectedId)?'active':''}`} key={item._id} onClick={()=>{setSelectedId(item._id);closeMobile();}}><span className="student-subject-dot"/><span>{item.subjectCode}</span><ChevronRight size={14}/></button>):<span className="text-xs text-slate-400">No enrolled subjects</span>}</div>
    <div className="student-sidebar-foot"><div className="student-mini-profile"><ProfileAvatar user={user} className="student-mini-avatar"/><span><b>{user?.fullName||'Primary learner'}</b><small>{user?.studentId||'Learner account'}</small></span></div><button className="student-logout" onClick={async()=>{await logout();}} aria-label="Sign out"><LogOut size={16}/></button></div>
  </aside>;

  return <div className="student-app">
    {sidebar}
    {mobileOpen&&<button className="student-sidebar-scrim" onClick={closeMobile} aria-label="Close navigation"/>}
    <main className="student-main">
      <header className="student-topbar"><button className="student-mobile-menu" onClick={()=>setMobileOpen(true)} aria-label="Open navigation"><Menu size={20}/></button><div className="student-search"><Search size={17}/><input aria-label="Search learning content" placeholder="Search your learning..." /><kbd>⌘ K</kbd></div><div className="student-topbar-profile"><ProfileAvatar user={user} className="student-avatar"/><span><b>{user?.fullName||'Primary learner'}</b><small>{user?.studentId||'Learner'}</small></span></div></header>
      <div className="student-canvas">
        {error&&<div className="error-card">{error}</div>}
        {!subjects.length?<div className="student-empty-state"><BookOpen size={28}/><h1>No enrolled subjects yet</h1><p>Enroll in a subject to start your guided learning path.</p><Link className="btn-primary" to="/subjects">Browse subjects</Link></div>:
          <div className="student-dashboard-grid">
            <section className="student-welcome-card">
              <div><span className="student-overline">Good day, {user?.fullName?.split(' ')[0]||'student'}</span><h1>Keep your learning<br/><em>in motion.</em></h1><p>{subject?.subjectName||'Your TUP learning space'} is ready when you are.</p><div className="student-subject-meta"><span>{subject?.subjectCode}</span><span>{subject?.term}</span><span>{subject?.yearLevel}</span></div><div className="mt-5 flex flex-wrap gap-3"><Link className="student-light-button" to={`/subjects/${selectedId}/topic/${activeTopic}/view`}>Continue Topic <ChevronRight size={16}/></Link><Link className="student-light-button" to="/subjects"><BookOpen size={16}/> Browse more subjects</Link></div></div><div className="student-welcome-orb"><GraduationCap size={48}/><span>Topic {activeTopic}</span></div>
            </section>
            <StatsCard title="Learning progress" value={`${progressPercent}%`} change={`${completedCount} of ${topicCount} topics completed`} icon={Target} progress={progressPercent}/>
            <StatsCard title="Quiz readiness" value={`${average}%`} change={scores.length?'Average across your attempts':'Complete your first quiz to build your score'} icon={Clock3} gradient="dark"><Link to={`/subjects/${selectedId}/topic/${activeTopic}/view`} className="student-inline-link">Open current topic <ChevronRight size={15}/></Link></StatsCard>
            <section className="student-roadmap-card"><div className="student-section-head"><div><span className="student-overline muted">Your pathway</span><h2>Topic roadmap</h2></div><Link to={`/subjects/${selectedId}`} className="student-text-link">View all <ChevronRight size={15}/></Link></div><div className="student-stepper">{Array.from({length:topicCount},(_,index)=>{const number=index+1;const complete=passed.has(number);const unlocked=number===1||passed.has(number-1);const available=topics.some(item=>Number(item.topicNumber)===number);return <div className="student-step-wrap" key={number}><Link to={unlocked&&available?`/subjects/${selectedId}/topic/${number}/view`:'#'} className={`student-step ${complete?'complete':''} ${number===activeTopic&&!complete?'current':''} ${!unlocked||!available?'locked':''}`} onClick={event=>{if(!unlocked||!available)event.preventDefault();}} aria-label={`Topic ${number}${complete?' completed':!unlocked?' locked':!available?' not published':''}`}>{complete?<Check size={15}/>:unlocked&&available?<span>{number}</span>:<Lock size={13}/>}<small>Topic {number}</small></Link>{number<topicCount&&<span className={`student-step-line ${complete?'complete':''}`}/>}</div>;})}</div><div className="student-roadmap-note"><span className="student-current-dot"/><span>{activeTopicData?.title||topicLabels[activeTopic-1]||`Topic ${activeTopic}`}</span><b>{completedCount}/{topicCount} complete</b></div></section>
            <section className="student-reader-card"><div className="student-section-head"><div><span className="student-overline muted">Now learning</span><h2>{activeTopicData?.title||`Topic ${activeTopic}: ${topicLabels[activeTopic-1]||'Learning topic'}`}</h2></div><span className="student-verified"><Check size={13}/> {passed.has(activeTopic)?'Verified complete':'In progress'}</span></div><div className="student-reader-body"><div className="student-reader-icon"><FileText size={22}/></div><div><h3>Open your lesson reader</h3><p>Review notes, uploaded materials, and interactive slides before taking the quiz.</p>{activeTopicData?<Link className="student-text-link" to={`/subjects/${selectedId}/topic/${activeTopic}/view`}>Open lesson <ChevronRight size={15}/></Link>:<span className="text-sm text-slate-500">This topic has not been published yet.</span>}</div></div></section>
            <section className="student-score-card"><div className="student-section-head"><div><span className="student-overline muted">Your results</span><h2>Score summary</h2></div><Trophy size={20} className="text-tup-gold"/></div><div className="student-score-summary"><strong>{average}%</strong><span>Best score average</span><i className={pathComplete?'passed':''}>{pathComplete?'COMPLETED':'IN PROGRESS'}</i></div><div className="student-score-list">{scoreRows.map(row=><div key={row.Topic}><span>{row.Topic}</span><b>{row.Score||'—'}</b></div>)}</div><div className="student-export-toolbar"><button onClick={()=>window.print()} aria-label="Print score summary"><Printer size={14}/></button><button onClick={exportPdf} aria-label="Download PDF score summary"><FileText size={14}/></button><button onClick={exportXlsx} aria-label="Export spreadsheet score summary"><FileSpreadsheet size={14}/></button><button onClick={()=>exportRowsToCsv(scoreRows,'group9-my-scores.csv')} aria-label="Download CSV score summary"><Download size={14}/></button><Link className="student-text-link" to={subject?`/subjects/${subject._id}`:'/subjects'}>View details <ChevronRight size={15}/></Link></div></section>
          </div>}
      </div>
    </main>
  </div>;
}

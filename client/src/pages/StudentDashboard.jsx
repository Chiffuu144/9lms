import {Link} from 'react-router-dom';
import {useEffect,useMemo,useState} from 'react';
import {BookOpen,ChevronRight,Check,Clock3,Download,FileSpreadsheet,FileText,GraduationCap,LayoutDashboard,Lock,LogOut,Menu,Printer,Search,Target,Trophy,UserRound,X} from 'lucide-react';
import {useAuth} from '../context/AuthContext';
import {api,exportRowsToCsv} from '../utils/api';
import * as XLSX from 'xlsx';
import {jsPDF} from 'jspdf';
import StatsCard from '../components/StatsCard';

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
  const activeTopic=useMemo(()=>{const next=Array.from({length:6},(_,index)=>index+1).find(number=>!passed.has(number));return next||6;},[passed]);
  const activeTopicData=topics.find(topic=>Number(topic.topicNumber)===activeTopic);
  const completedCount=Math.min(passed.size,6);
  const average=scores.length?Math.round(scores.reduce((total,score)=>total+Number(score.percentage||0),0)/scores.length):0;
  const scoreRows=Array.from({length:6},(_,index)=>{const number=index+1;const score=scores.filter(item=>Number(item.topicNumber)===number).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))[0];return {Topic:`Topic ${number}`,Score:score?`${score.percentage}%`:'',Status:score?(score.passed?'PASSED':'INCOMPLETE'):'INCOMPLETE'};});
  const exportXlsx=()=>{const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(scoreRows),'My Scores');XLSX.writeFile(book,'group9-my-scores.xlsx');};
  const exportPdf=()=>{const doc=new jsPDF();doc.text(`${subject?.subjectName||'GROUP9'} — My Scores`,14,15);scoreRows.forEach((row,index)=>doc.text(`${row.Topic} | ${row.Score||'—'} | ${row.Status}`,14,28+index*7));doc.save('group9-my-scores.pdf');};
  const closeMobile=()=>setMobileOpen(false);

  const sidebar=<aside className={`student-sidebar ${mobileOpen?'is-open':''}`}>
    <div className="student-sidebar-head"><Link to="/student/dashboard" className="student-brand" onClick={closeMobile}><span className="student-brand-mark"><GraduationCap size={19}/></span><span><b>GROUP9</b><small>TUP LMS</small></span></Link><button className="student-sidebar-close" onClick={closeMobile} aria-label="Close navigation"><X size={18}/></button></div>
    <nav className="student-sidebar-nav" aria-label="Student navigation">
      <span className="student-nav-label">Workspace</span>
      <Link className="student-side-link active" to="/student/dashboard" onClick={closeMobile}><LayoutDashboard size={17}/>Dashboard</Link>
      <Link className="student-side-link" to={subject?`/subjects/${subject._id}`:'/subjects'} onClick={closeMobile}><BookOpen size={17}/>Topic roadmap</Link>
      <Link className="student-side-link" to="/profile" onClick={closeMobile}><UserRound size={17}/>Profile settings</Link>
    </nav>
    <div className="student-side-subjects"><span className="student-nav-label">My subjects</span>{subjects.length?subjects.map(item=><button className={`student-subject-link ${String(item._id)===String(selectedId)?'active':''}`} key={item._id} onClick={()=>{setSelectedId(item._id);closeMobile();}}><span className="student-subject-dot"/><span>{item.subjectCode}</span><ChevronRight size={14}/></button>):<span className="text-xs text-slate-400">No enrolled subjects</span>}</div>
    <div className="student-sidebar-foot"><div className="student-mini-profile"><span className="student-mini-avatar">{user?.fullName?.charAt(0)||'S'}</span><span><b>{user?.fullName||'Student'}</b><small>{user?.studentId||'Student account'}</small></span></div><button className="student-logout" onClick={async()=>{await logout();}} aria-label="Sign out"><LogOut size={16}/></button></div>
  </aside>;

  return <div className="student-app">
    {sidebar}
    {mobileOpen&&<button className="student-sidebar-scrim" onClick={closeMobile} aria-label="Close navigation"/>}
    <main className="student-main">
      <header className="student-topbar"><button className="student-mobile-menu" onClick={()=>setMobileOpen(true)} aria-label="Open navigation"><Menu size={20}/></button><div className="student-search"><Search size={17}/><input aria-label="Search learning content" placeholder="Search your learning..." /><kbd>⌘ K</kbd></div><div className="student-topbar-profile"><span className="student-avatar">{user?.fullName?.charAt(0)||'S'}</span><span><b>{user?.fullName||'Student'}</b><small>{user?.studentId||'Student'}</small></span></div></header>
      <div className="student-canvas">
        {error&&<div className="error-card">{error}</div>}
        {!subjects.length?<div className="student-empty-state"><BookOpen size={28}/><h1>No enrolled subjects yet</h1><p>Enroll in a subject to start your guided six-topic learning path.</p><Link className="btn-primary" to="/subjects">Browse subjects</Link></div>:
          <div className="student-dashboard-grid">
            <section className="student-welcome-card">
              <div><span className="student-overline">Good day, {user?.fullName?.split(' ')[0]||'student'}</span><h1>Keep your learning<br/><em>in motion.</em></h1><p>{subject?.subjectName||'Your TUP learning space'} is ready when you are.</p><div className="student-subject-meta"><span>{subject?.subjectCode}</span><span>{subject?.term}</span><span>{subject?.yearLevel}</span></div><Link className="student-light-button" to={`/subjects/${selectedId}/topic/${activeTopic}/view`}>Continue Topic <ChevronRight size={16}/></Link></div><div className="student-welcome-orb"><GraduationCap size={48}/><span>Topic {activeTopic}</span></div>
            </section>
            <StatsCard title="Learning progress" value={`${Math.round((completedCount/6)*100)}%`} change={`${completedCount} of 6 topics completed`} icon={Target} progress={(completedCount/6)*100}/>
            <StatsCard title="Quiz readiness" value={`${average}%`} change={scores.length?'Average across your attempts':'Complete your first quiz to build your score'} icon={Clock3} gradient="dark"><Link to={`/subjects/${selectedId}/topic/${activeTopic}/quiz`} className="student-inline-link">Open quiz <ChevronRight size={15}/></Link></StatsCard>
            <section className="student-roadmap-card"><div className="student-section-head"><div><span className="student-overline muted">Your pathway</span><h2>Topic roadmap</h2></div><Link to={`/subjects/${selectedId}`} className="student-text-link">View all <ChevronRight size={15}/></Link></div><div className="student-stepper">{Array.from({length:6},(_,index)=>{const number=index+1;const complete=passed.has(number);const unlocked=number===1||passed.has(number-1);return <div className="student-step-wrap" key={number}><Link to={unlocked?`/subjects/${selectedId}/topic/${number}/view`:'#'} className={`student-step ${complete?'complete':''} ${number===activeTopic&&!complete?'current':''} ${!unlocked?'locked':''}`} onClick={event=>{if(!unlocked)event.preventDefault();}}>{complete?<Check size={15}/>:unlocked?<span>{number}</span>:<Lock size={13}/>}<small>Topic {number}</small></Link>{number<6&&<span className={`student-step-line ${complete?'complete':''}`}/>}</div>;})}</div><div className="student-roadmap-note"><span className="student-current-dot"/><span>{activeTopicData?.title||topicLabels[activeTopic-1]}</span><b>{completedCount}/6 complete</b></div></section>
            <section className="student-reader-card"><div className="student-section-head"><div><span className="student-overline muted">Now learning</span><h2>{activeTopicData?.title||`Topic ${activeTopic}: ${topicLabels[activeTopic-1]}`}</h2></div><span className="student-verified"><Check size={13}/> {passed.has(activeTopic)?'Verified complete':'In progress'}</span></div><div className="student-reader-body"><div className="student-reader-icon"><FileText size={22}/></div><div><h3>Open your lesson reader</h3><p>Review notes, uploaded materials, and interactive slides before taking the quiz.</p><Link className="student-text-link" to={`/subjects/${selectedId}/topic/${activeTopic}/view`}>Open lesson <ChevronRight size={15}/></Link></div></div></section>
            <section className="student-score-card"><div className="student-section-head"><div><span className="student-overline muted">Your results</span><h2>Score summary</h2></div><Trophy size={20} className="text-tup-gold"/></div><div className="student-score-summary"><strong>{average}%</strong><span>Average score</span><i className={average>=75?'passed':''}>{average>=75?'PASSED':'INCOMPLETE'}</i></div><div className="student-score-list">{scoreRows.map(row=><div key={row.Topic}><span>{row.Topic}</span><b>{row.Score||'—'}</b></div>)}</div><div className="student-export-toolbar"><button onClick={()=>window.print()} aria-label="Print score summary"><Printer size={14}/></button><button onClick={exportPdf} aria-label="Download PDF score summary"><FileText size={14}/></button><button onClick={exportXlsx} aria-label="Export spreadsheet score summary"><FileSpreadsheet size={14}/></button><button onClick={()=>exportRowsToCsv(scoreRows,'group9-my-scores.csv')} aria-label="Download CSV score summary"><Download size={14}/></button><Link className="student-text-link" to={subject?`/subjects/${subject._id}`:'/subjects'}>View details <ChevronRight size={15}/></Link></div></section>
          </div>}
      </div>
    </main>
  </div>;
}

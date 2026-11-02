import {Link} from 'react-router-dom';
import {useCallback,useEffect,useState} from 'react';
import {motion} from 'framer-motion';
import {BarChart3,BookOpen,ChevronRight,FilePlus2,GraduationCap,LayoutDashboard,LogOut,Menu,Plus,Settings2,UserRound,X} from 'lucide-react';
import {useAuth} from '../context/AuthContext';
import {api} from '../utils/api';
import {useToast} from '../context/ToastContext';

const initialForm={subjectCode:'',subjectName:'',term:'1st Sem',yearLevel:'1st Year'};

export default function FacultyDashboard(){
  const {user,logout}=useAuth(); const {notify}=useToast();
  const [subjects,setSubjects]=useState([]);
  const [form,setForm]=useState(initialForm);
  const [mobileOpen,setMobileOpen]=useState(false);
  const [error,setError]=useState('');
  const [creating,setCreating]=useState(false);
  const load=useCallback(()=>api('/subjects').then(data=>setSubjects(data.subjects||[])).catch(err=>setError(err.message)),[]);
  useEffect(()=>{load();},[load]);
  const createSubject=async event=>{event.preventDefault();setCreating(true);setError('');try{await api('/subjects',{method:'POST',body:JSON.stringify(form)});setForm(initialForm);notify('Subject created successfully. Refreshing...');window.setTimeout(()=>window.location.reload(),800);}catch(err){setError(err.message);notify(err.message,'error');}finally{setCreating(false);}};
  const closeMobile=()=>setMobileOpen(false);
  const sidebar=<aside className={`faculty-sidebar ${mobileOpen?'is-open':''}`}>
    <div className="faculty-sidebar-head"><Link to="/faculty/dashboard" className="faculty-brand" onClick={closeMobile}><span className="faculty-brand-mark"><GraduationCap size={19}/></span><span><b>GROUP9</b><small>TUP Faculty Hub</small></span></Link><button className="faculty-sidebar-close" onClick={closeMobile} aria-label="Close navigation"><X size={18}/></button></div>
    <nav className="faculty-sidebar-nav" aria-label="Faculty navigation"><span className="faculty-nav-label">Workspace</span><Link className="faculty-side-link active" to="/faculty/dashboard" onClick={closeMobile}><LayoutDashboard size={17}/>Dashboard</Link><Link className="faculty-side-link" to="/subjects" onClick={closeMobile}><BookOpen size={17}/>My subjects</Link><Link className="faculty-side-link" to="/profile" onClick={closeMobile}><UserRound size={17}/>Profile settings</Link></nav>
    <div className="faculty-sidebar-foot"><div className="faculty-mini-profile"><span className="faculty-mini-avatar">{user?.fullName?.charAt(0)||'F'}</span><span><b>{user?.fullName||'Faculty'}</b><small>{user?.facultyId||'Faculty account'}</small></span></div><button className="faculty-logout" onClick={async()=>{await logout();}} aria-label="Sign out"><LogOut size={16}/></button></div>
  </aside>;
  return <div className="faculty-app">{sidebar}{mobileOpen&&<button className="faculty-sidebar-scrim" onClick={closeMobile} aria-label="Close navigation"/>}<main className="faculty-main">
    <header className="faculty-topbar"><button className="faculty-mobile-menu" onClick={()=>setMobileOpen(true)} aria-label="Open navigation"><Menu size={20}/></button><div className="faculty-topbar-copy"><span>Faculty workspace</span><b>Manage your learning environment</b></div><div className="faculty-topbar-profile"><span className="faculty-avatar">{user?.fullName?.charAt(0)||'F'}</span><span><b>{user?.fullName||'Faculty'}</b><small>{user?.department||'TUP Faculty'}</small></span></div></header>
    <div className="faculty-canvas"><motion.div className="faculty-dashboard-grid" initial={{opacity:0}} animate={{opacity:1}} transition={{duration:.2,ease:[.23,1,.32,1]}}>
      <section className="faculty-welcome-card"><div><span className="faculty-overline">Faculty workspace</span><h1>Shape better<br/><em>learning spaces.</em></h1><p>Create subjects, organize topic content, and follow student progress from one focused workspace.</p><div className="faculty-welcome-stats"><span><b>{subjects.length}</b> subjects</span><span><b>6</b> topics per subject</span></div></div><div className="faculty-welcome-art"><GraduationCap size={42}/><span>Teach with clarity</span></div></section>
      <section className="faculty-stat-card"><span className="faculty-card-icon"><BookOpen size={17}/></span><small>Active subjects</small><strong>{subjects.length}</strong><p>Subject spaces you manage</p></section>
      <section className="faculty-stat-card dark"><span className="faculty-card-icon gold"><BarChart3 size={17}/></span><small>Content workflow</small><strong>6 topics</strong><p>Build a complete learning path</p></section>
      <section className="faculty-create-card"><div className="faculty-section-head"><div><span className="faculty-overline muted">Faculty tools</span><h2>Create a subject</h2></div><span className="faculty-card-icon small"><Plus size={17}/></span></div><form onSubmit={createSubject} className="faculty-create-form"><input className="field" placeholder="Subject code" value={form.subjectCode} onChange={event=>setForm({...form,subjectCode:event.target.value})} required/><input className="field faculty-subject-name" placeholder="Subject name" value={form.subjectName} onChange={event=>setForm({...form,subjectName:event.target.value})} required/><select className="field" value={form.term} onChange={event=>setForm({...form,term:event.target.value})}><option>1st Sem</option><option>2nd Sem</option></select><select className="field" value={form.yearLevel} onChange={event=>setForm({...form,yearLevel:event.target.value})}><option>1st Year</option><option>2nd Year</option><option>3rd Year</option><option>4th Year</option></select><button className="btn-primary faculty-create-button" disabled={creating}><FilePlus2 size={16}/>{creating?'Creating...':'Create subject'}</button></form></section>
      {error&&<div className="error-card">{error}</div>}
      <section className="faculty-subjects-card"><div className="faculty-section-head"><div><span className="faculty-overline muted">Your workspace</span><h2>Managed subjects</h2></div><span className="faculty-count-pill">{subjects.length} subject{subjects.length!==1?'s':''}</span></div>{subjects.length?<div className="faculty-subject-grid">{subjects.map(subject=><article className="faculty-subject-card" key={subject._id}><div className="faculty-subject-card-top"><span className="subject-code">{subject.subjectCode}</span><span className="faculty-subject-status">Active</span></div><h3>{subject.subjectName}</h3><p>{subject.term} · {subject.yearLevel}</p><div className="faculty-subject-actions"><Link to={`/subjects/${subject._id}`} className="faculty-action-link"><BookOpen size={15}/> Roadmap</Link><Link to={`/subjects/${subject._id}/manage`} className="faculty-action-link"><Settings2 size={15}/> Manage</Link><Link to={`/subjects/${subject._id}/reports`} className="faculty-action-link"><BarChart3 size={15}/> Reports</Link><ChevronRight size={16} className="ml-auto text-slate-300"/></div></article>)}</div>:<div className="faculty-empty"><BookOpen size={24}/><p>Create your first subject to begin building topics.</p></div>}</section>
    </motion.div></div>
  </main></div>;
}

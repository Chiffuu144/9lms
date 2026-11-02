import {useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {ArrowRight,GraduationCap,ShieldCheck,Sparkles} from 'lucide-react';
import {api} from '../utils/api';
import {useAuth} from '../context/AuthContext';

function Field({label,required=true,...props}){return <label className="auth-field-label">{label}<input {...props} className="auth-field" required={required}/></label>;}

export function Login(){
  const {login}=useAuth(); const nav=useNavigate(); const [form,setForm]=useState({email:'',password:''}); const [error,setError]=useState('');
  return <AuthCard eyebrow="Welcome back" title={<>Ready to keep<br/><em>learning?</em></>} subtitle="Sign in to continue your TUP learning journey.">
    <form className="auth-form" onSubmit={async event=>{event.preventDefault();setError('');try{const user=await login(form.email,form.password);nav(user.role==='student'?'/student/dashboard':'/faculty/dashboard');}catch(err){setError(err.message);}}}>
      <Field label="Email address" type="email" value={form.email} onChange={event=>setForm({...form,email:event.target.value})}/>
      <Field label="Password" type="password" value={form.password} onChange={event=>setForm({...form,password:event.target.value})}/>
      {error&&<p className="auth-error">{error}</p>}
      <button className="auth-submit" type="submit">Sign in <ArrowRight size={17}/></button>
    </form>
    <p className="auth-switch">New to GROUP9? <Link to="/register">Create an account</Link></p>
  </AuthCard>;
}

export function Register(){
  const nav=useNavigate(); const [form,setForm]=useState({role:'student'}); const [image,setImage]=useState(null); const [error,setError]=useState('');
  const set=(key,value)=>setForm({...form,[key]:value});
  const submit=async event=>{event.preventDefault();setError('');try{const body=new FormData();Object.entries(form).forEach(([key,value])=>body.append(key,value||''));if(image)body.append('profileImage',image);await api('/auth/register',{method:'POST',body});nav('/login');}catch(err){setError(err.message);}};
  return <AuthCard eyebrow="Join the community" title={<>Build your next<br/><em>chapter.</em></>} subtitle="Create your account and start learning with GROUP9.">
    <form className="auth-form register-form" onSubmit={submit}>
      <div className="auth-role-toggle"><button type="button" className={form.role==='student'?'active':''} onClick={()=>set('role','student')}>Student</button><button type="button" className={form.role==='faculty'?'active':''} onClick={()=>set('role','faculty')}>Faculty</button></div>
      <Field label="Full name" value={form.fullName||''} onChange={event=>set('fullName',event.target.value)}/>
      <Field label="Email address" type="email" value={form.email||''} onChange={event=>set('email',event.target.value)}/>
      <Field label="Password" type="password" value={form.password||''} onChange={event=>set('password',event.target.value)}/>
      {form.role==='student'?<div className="auth-two-fields"><Field label="Year level" value={form.yearLevel||''} onChange={event=>set('yearLevel',event.target.value)}/><Field label="Section" value={form.section||''} onChange={event=>set('section',event.target.value)}/></div>:<Field label="Department" value={form.department||''} onChange={event=>set('department',event.target.value)}/>}
      <Field label="Profile image (optional)" type="file" accept="image/*" required={false} onChange={event=>setImage(event.target.files?.[0]||null)}/>
      {error&&<p className="auth-error">{error}</p>}
      <button className="auth-submit" type="submit">Create account <ArrowRight size={17}/></button>
    </form>
    <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
  </AuthCard>;
}

function AuthCard({eyebrow,title,subtitle,children}){
  return <main className="auth-page"><section className="auth-shell">
    <div className="auth-visual"><div className="auth-visual-top"><span className="auth-logo"><GraduationCap size={19}/></span><b>GROUP9</b></div><div className="auth-visual-copy"><span className="auth-overline"><Sparkles size={13}/> TUP learning hub</span><h2>Learn with purpose.<br/><em>Grow with confidence.</em></h2><p>A focused space for lessons, practice, and progress—made for TUP students.</p></div><div className="auth-visual-art"><img src={`${import.meta.env.BASE_URL}student-learning.svg`} alt="Student learning illustration"/><span className="auth-float-card"><ShieldCheck size={16}/> Your progress, protected</span></div><div className="auth-visual-footer"><span>01</span><i/><span>06 topics · one learning journey</span></div></div>
    <div className="auth-form-panel"><div className="auth-form-heading"><span className="auth-overline dark">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div>{children}</div>
  </section></main>;
}

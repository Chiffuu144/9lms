import {Link,useLocation,useNavigate} from 'react-router-dom'; import {BookOpen,GraduationCap,LayoutDashboard,LogOut,UserRound} from 'lucide-react'; import {useAuth} from '../context/AuthContext';

export default function Navbar(){
  const {user,logout}=useAuth();
  const navigate=useNavigate();
  const location=useLocation();
  if(location.pathname==='/student/dashboard'||location.pathname==='/faculty/dashboard')return null;
  const dashboardPath=user?(user.role==='student'?'/student/dashboard':'/faculty/dashboard'):'/';
  const isActive=(path)=>location.pathname===path||location.pathname.startsWith(`${path}/`);

  return <nav className="nav-shell print-hidden" aria-label="Primary navigation">
    <div className="nav-inner">
      <Link to={dashboardPath} className="brand-lockup" aria-label="GROUP9 home">
        <span className="brand-mark"><GraduationCap size={21}/></span>
        <span className="brand-copy"><b>GROUP9</b><small>TUP Learning &amp; Assessment</small></span>
      </Link>
      {user&&<div className="nav-actions">
        <Link to={dashboardPath} className={`nav-link${isActive(dashboardPath)?' active':''}`}><LayoutDashboard size={17}/><span>Dashboard</span></Link>
        <Link to="/subjects" className={`nav-link${isActive('/subjects')?' active':''}`}><BookOpen size={17}/><span>Subjects</span></Link>
        <Link to="/profile" className={`nav-link${isActive('/profile')?' active':''}`}><UserRound size={17}/><span>Profile</span></Link>
        <button onClick={async()=>{await logout();navigate('/login');}} className="nav-signout"><LogOut size={16}/><span>Sign out</span></button>
      </div>}
    </div>
  </nav>;
}

import { Link } from 'react-router-dom';
import { ArrowRight, Award, BarChart3, BookOpen, Clock, GraduationCap, Shield, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const features = [
  ['Sequential Topic Learning', 'Progressive roadmaps with clear unlocked and locked states.', BookOpen],
  ['Timed Quiz Engine', 'Ten-minute default quizzes, configurable up to 20 minutes.', Clock],
  ['Grade Reporting & Export', 'Score tables and PDF, Excel, CSV, or print reporting.', BarChart3],
  ['Role-Based Access', 'Separate faculty and primary learner portals.', Shield],
  ['Smart Progression', 'A 75% passing threshold unlocks the next topic.', Award],
  ['TUP Integrated', 'Designed for TUP learners and faculty.', GraduationCap],
];

export default function Home() {
  const { user } = useAuth();
  const dashboard = user ? (user.role === 'student' ? '/student/dashboard' : '/faculty/dashboard') : '/login';
  return (
    <main className="home-page">
      <section className="home-hero">
        <div className="home-hero-orbit orbit-one"/><div className="home-hero-orbit orbit-two"/>
        <div className="home-hero-content">
          <span className="home-kicker"><Sparkles size={14}/> TUP learning hub · built for progress</span>
          <div className="home-mark"><GraduationCap size={34}/></div>
          <p className="home-index">LEARNING JOURNEY</p>
          <h1>Learn with<br/><em>purpose.</em></h1>
          <p className="home-lede">A focused learning and assessment space for Technological University of the Philippines learners and faculty.</p>
          <div className="home-actions"><Link className="btn-gold" to={dashboard}>{user ? 'Open dashboard' : 'Start learning'} <ArrowRight size={18}/></Link>{!user && <Link className="home-outline-button" to="/register">Create account</Link>}</div>
          <div className="home-proof"><span><strong>75%</strong> unlock threshold</span><span><strong>10 min</strong> default quiz</span><span><strong>20 min</strong> maximum timer</span></div>
        </div>
        <div className="home-hero-panel">
          <div className="home-panel-top"><span>GROUP9 / SYSTEM</span><span className="home-live-dot">LIVE</span></div>
          <div className="home-progress-card"><div className="home-progress-ring"><span>01</span></div><div><small>YOUR PATHWAY</small><strong>Build knowledge<br/>one topic at a time.</strong></div></div>
          <div className="home-mini-roadmap" aria-label="Sample six-step topic sequence">{[1, 2, 3, 4, 5, 6].map((number, index) => <span className={index === 0 ? 'active' : ''} key={number}>{number}</span>)}</div>
          <p className="home-panel-note">Sequential lessons, meaningful practice, measurable growth.</p>
        </div>
      </section>
      <section className="home-features">
        <div className="home-section-intro"><span className="home-kicker dark">Everything in one place</span><h2>A calmer way to<br/><em>keep progressing.</em></h2><p>Designed around the real rhythm of learning: understand, practice, verify, then move forward.</p></div>
        <div className="home-feature-grid">{features.map(([title, description, Icon], index) => <article className="home-feature-card" key={title}><span className="home-feature-number">0{index + 1}</span><div className="home-feature-icon"><Icon size={20}/></div><h3>{title}</h3><p>{description}</p></article>)}</div>
      </section>
    </main>
  );
}

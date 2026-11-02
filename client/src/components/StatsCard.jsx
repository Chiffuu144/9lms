import {motion,useReducedMotion} from 'framer-motion';

export default function StatsCard({title,value,change,icon:Icon,gradient='',progress,children}){
  const isDark=gradient.includes('dark');
  const reduceMotion=useReducedMotion();

  return <motion.div
    whileHover={reduceMotion?undefined:{y:-5}}
    transition={{duration:0.2,ease:'easeOut'}}
    className={`student-stat-card glass-card bg-white/80 backdrop-blur-md shadow-lg cursor-pointer ${gradient}`}
  >
    <span className={`student-card-icon ${isDark?'light':'gold'}`}>{Icon&&<Icon size={17}/>}</span>
    <div><small>{title}</small><strong>{value}</strong></div>
    {typeof progress==='number'&&<div className="student-progress-track"><span style={{width:`${progress}%`}}/></div>}
    <p>{change}</p>
    {children}
  </motion.div>;
}

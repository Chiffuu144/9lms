import {AnimatePresence,motion,useReducedMotion} from 'framer-motion';
import {useLocation} from 'react-router-dom';
import Navbar from './Navbar';
import ScrollReveal from './ScrollReveal';

const pageVariants={
  initial:{opacity:0,y:16},
  animate:{opacity:1,y:0,transition:{duration:0.28,ease:[0.16,1,0.3,1]}},
  exit:{opacity:0,y:-8,transition:{duration:0.18,ease:'easeIn'}}
};

export default function LMSLayout({children}){
  const location=useLocation();
  const reduceMotion=useReducedMotion();
  const variants=reduceMotion?{
    initial:{opacity:0},
    animate:{opacity:1,transition:{duration:0.2,ease:'easeOut'}},
    exit:{opacity:0,transition:{duration:0.15,ease:'easeOut'}}
  }:pageVariants;

  return <div className="min-h-screen flex flex-col bg-[#FAF9F6]">
    <Navbar/>
    <main className="relative flex-1 overflow-hidden">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname}
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="w-full"
          style={{willChange:'transform,opacity'}}
        >
          <ScrollReveal>{children}</ScrollReveal>
        </motion.div>
      </AnimatePresence>
    </main>
  </div>;
}

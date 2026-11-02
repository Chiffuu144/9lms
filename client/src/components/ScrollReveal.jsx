import {useEffect,useRef,useState} from 'react';

export default function ScrollReveal({children,className='',index=0}){
  const elementRef=useRef(null);
  const [isVisible,setIsVisible]=useState(false);

  useEffect(()=>{
    const element=elementRef.current;
    if(!element)return;

    const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(reduceMotion||!('IntersectionObserver' in window)){
      setIsVisible(true);
      return;
    }

    const observer=new IntersectionObserver(([entry])=>{
      if(entry.isIntersecting){
        setIsVisible(true);
        observer.disconnect();
      }
    },{threshold:0.1});

    observer.observe(element);
    return()=>observer.disconnect();
  },[]);

  return <div
    ref={elementRef}
    className={`scroll-reveal ${isVisible?'active':''} ${className}`.trim()}
    style={{'--i':index}}
  >
    {children}
  </div>;
}

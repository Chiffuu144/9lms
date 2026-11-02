import {createContext,useCallback,useContext,useEffect,useRef,useState} from 'react';
import {CheckCircle2,Info,X, XCircle} from 'lucide-react';

const ToastContext=createContext(null);

export function ToastProvider({children}){
  const [toasts,setToasts]=useState([]);
  const timers=useRef(new Map());
  const dismiss=useCallback(id=>{setToasts(current=>current.filter(toast=>toast.id!==id));const timer=timers.current.get(id);if(timer)clearTimeout(timer);timers.current.delete(id);},[]);
  const notify=useCallback((message,type='success')=>{const id=Date.now()+Math.random();setToasts(current=>[...current,{id,message,type}].slice(-4));timers.current.set(id,setTimeout(()=>dismiss(id),4200));},[dismiss]);
  useEffect(()=>()=>timers.current.forEach(timer=>clearTimeout(timer)),[]);
  return <ToastContext.Provider value={{notify,dismiss}}>{children}<div className="toast-region" aria-live="polite" aria-atomic="true">{toasts.map(toast=><Toast key={toast.id} toast={toast} onDismiss={()=>dismiss(toast.id)}/>)}</div></ToastContext.Provider>;
}

function Toast({toast,onDismiss}){
  const Icon=toast.type==='error'?XCircle:toast.type==='info'?Info:CheckCircle2;
  return <div className={`toast toast-${toast.type}`} role={toast.type==='error'?'alert':'status'}><Icon size={18}/><span>{toast.message}</span><button onClick={onDismiss} aria-label="Dismiss notification"><X size={15}/></button></div>;
}

export const useToast=()=>useContext(ToastContext);

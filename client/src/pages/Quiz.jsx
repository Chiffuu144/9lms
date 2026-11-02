import {motion,useReducedMotion} from 'framer-motion';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Link,useNavigate,useParams} from 'react-router-dom';
import {AlertCircle,CheckCircle2,Send} from 'lucide-react';
import {api} from '../utils/api';

export default function Quiz(){
  const{id,topicNum}=useParams();
  const navigate=useNavigate();
  const reduceMotion=useReducedMotion();
  const[quiz,setQuiz]=useState(null);
  const[topic,setTopic]=useState(null);
  const[answers,setAnswers]=useState({});
  const[seconds,setSeconds]=useState(0);
  const[result,setResult]=useState(null);
  const[error,setError]=useState('');
  const[loading,setLoading]=useState(true);
  const[submitting,setSubmitting]=useState(false);
  const answersRef=useRef({});
  const secondsRef=useRef(0);
  const durationRef=useRef(0);
  const submittedRef=useRef(false);
  answersRef.current=answers;

  useEffect(()=>{
    let active=true;
    setLoading(true);
    setQuiz(null);
    setTopic(null);
    setAnswers({});
    setResult(null);
    setError('');
    submittedRef.current=false;

    Promise.all([api(`/topics?subjectId=${id}`),api(`/quizzes?subjectId=${id}`)])
      .then(([topics,quizzes])=>{
        if(!active)return;
        const current=topics.topics.find(item=>String(item.topicNumber)===topicNum);
        if(!current){
          setError('This topic is not available yet.');
          return;
        }
        const currentQuiz=quizzes.quizzes.find(item=>String(item.topicId)===String(current._id));
        if(!currentQuiz){
          setError('A quiz has not been published for this topic yet.');
          return;
        }
        const duration=Math.max(1,Number(currentQuiz.timeLimit)||600);
        durationRef.current=duration;
        secondsRef.current=duration;
        setSeconds(duration);
        setTopic(current);
        setQuiz(currentQuiz);
      })
      .catch(err=>{if(active)setError(err.message);})
      .finally(()=>{if(active)setLoading(false);});

    return()=>{active=false;};
  },[id,topicNum]);

  const submit=useCallback(async()=>{
    if(!quiz||!topic||submittedRef.current)return;
    submittedRef.current=true;
    setSubmitting(true);
    try{
      const data=await api('/scores',{
        method:'POST',
        body:JSON.stringify({
          quizId:quiz._id,
          answers:answersRef.current,
          timeTaken:durationRef.current-secondsRef.current
        })
      });
      setResult(data.score);
    }catch(err){
      submittedRef.current=false;
      setError(err.message);
    }finally{
      setSubmitting(false);
    }
  },[quiz,topic]);

  useEffect(()=>{
    if(!quiz||result||error)return undefined;
    const timer=setInterval(()=>{
      const next=Math.max(secondsRef.current-1,0);
      secondsRef.current=next;
      setSeconds(next);
      if(next===0){
        clearInterval(timer);
        submit();
      }
    },1000);
    return()=>clearInterval(timer);
  },[quiz,result,error,submit]);

  const formatted=useMemo(()=>`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`,[seconds]);
  const answerOption=(question,choice)=><motion.label
    whileHover={reduceMotion?undefined:{y:-2}}
    whileTap={reduceMotion?undefined:{scale:0.99}}
    transition={{duration:0.16,ease:'easeOut'}}
    className={`answer-option ${answers[question._id]===choice?'selected':''}`}
    key={choice}
  >
    <input
      type="radio"
      name={question._id}
      value={choice}
      checked={answers[question._id]===choice}
      onChange={event=>setAnswers(current=>({...current,[question._id]:event.target.value}))}
    />
    <span>{choice}</span>
    {answers[question._id]===choice&&<motion.span
      initial={{scale:0,opacity:0}}
      animate={{scale:1,opacity:1}}
      transition={{type:'spring',duration:0.35,bounce:0.2}}
      className="answer-check"
      aria-hidden="true"
    ><CheckCircle2 size={16}/></motion.span>}
  </motion.label>;

  if(loading)return <main className="page-shell"><div className="skeleton h-10 w-2/3"/><div className="skeleton h-64 mt-6"/></main>;
  if(error)return <main className="page-shell"><div className="error-card flex flex-col items-center justify-center gap-3"><AlertCircle size={18}/><span>{error}</span><Link className="topic-link" to={`/subjects/${id}`}>Return to roadmap</Link></div></main>;
  if(result)return <main className="page-shell"><section className={`result-card ${result.passed?'passed':'failed'}`}>
    {result.passed?<CheckCircle2 size={48}/>:<AlertCircle size={48}/>}
    <span className="eyebrow text-current">Topic {topicNum} result</span>
    <h1>{result.percentage}%</h1>
    <p>{result.message}</p>
    <div className="flex flex-wrap justify-center gap-3 mt-6">
      <motion.button whileTap={reduceMotion?undefined:{scale:0.97}} className="btn-primary" onClick={()=>navigate(`/subjects/${id}/topic/${topicNum}/view`)}>Review topic</motion.button>
      {!result.passed&&<motion.button whileTap={reduceMotion?undefined:{scale:0.97}} className="btn-secondary" onClick={()=>window.location.reload()}>Retry quiz</motion.button>}
    </div>
  </section></main>;

  const progress=(seconds/durationRef.current)*100;
  return <main className="page-shell">
    <header className="hero-card mb-6"><div className="flex flex-wrap items-center justify-between gap-6">
      <div><span className="eyebrow">Knowledge check · Topic {topicNum}</span><h1>{quiz.title}</h1><p>{quiz.questions?.length||quiz.questionCount} questions · Passing score {quiz.passingScore??75}%</p></div>
      <div className="flex items-center gap-3"><div className="quiz-timer-ring" style={{'--timer-progress':`${progress}%`}}><span>{formatted}</span></div><span className="hidden text-sm text-white/70 sm:block">Time remaining</span></div>
    </div></header>
    <form className="space-y-5" onSubmit={event=>{event.preventDefault();submit();}}>
      {quiz.questions?.map((question,index)=><fieldset className="quiz-question" key={question._id}>
        <legend><span className="question-number">{index+1}</span>{question.questionText}</legend>
        {question.type==='multiple_choice'&&question.choices?.map(choice=>answerOption(question,choice))}
        {question.type==='true_false'&&['True','False'].map(choice=>answerOption(question,choice))}
        {question.type==='identification'&&<input className="field mt-4" placeholder="Type your answer" value={answers[question._id]||''} onChange={event=>setAnswers(current=>({...current,[question._id]:event.target.value}))}/>}
      </fieldset>)}
      <motion.button whileTap={reduceMotion?undefined:{scale:0.97}} className="btn-primary w-full justify-center" type="submit" disabled={submitting}>
        <Send size={17}/>{submitting?'Submitting...':'Submit quiz'}
      </motion.button>
    </form>
  </main>;
}

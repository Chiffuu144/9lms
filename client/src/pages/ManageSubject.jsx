import {useCallback,useEffect,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {api} from '../utils/api';
import {useToast} from '../context/ToastContext';

const blankQuestion=()=>({type:'multiple_choice',questionText:'',choices:['',''],correctAnswer:'',points:1});
const blankQuiz=topicId=>({topicId,subjectId:'',title:'',timeLimit:600,passingScore:75,questions:[blankQuestion()]});

export default function ManageSubject(){
  const{id}=useParams();
  const{notify}=useToast();
  const[topics,setTopics]=useState([]);
  const[quizzes,setQuizzes]=useState([]);
  const[quiz,setQuiz]=useState(blankQuiz(''));
  const[error,setError]=useState('');
  const[loading,setLoading]=useState(true);
  const[savingTopic,setSavingTopic]=useState(false);
  const[savingQuiz,setSavingQuiz]=useState(false);
  const[topic,setTopic]=useState({subjectId:id,topicNumber:1,title:'',description:'',lessonContent:'',summaryCard:''});

  const load=useCallback(async()=>{
    setLoading(true);
    setError('');
    try{
      const[data,quizData]=await Promise.all([api(`/topics?subjectId=${id}`),api(`/quizzes?subjectId=${id}`)]);
      const loadedTopics=data.topics||[];
      const loadedQuizzes=quizData.quizzes||[];
      setTopics(loadedTopics);
      setQuizzes(loadedQuizzes);
      const firstTopic=loadedTopics[0];
      const firstQuiz=loadedQuizzes.find(item=>String(item.topicId)===String(firstTopic?._id));
      setQuiz(firstQuiz?{...firstQuiz,subjectId:id}:blankQuiz(firstTopic?._id||''));
    }catch(err){
      setError(err.message);
    }finally{
      setLoading(false);
    }
  },[id]);

  useEffect(()=>{load();},[load]);

  const saveTopic=async event=>{
    event.preventDefault();
    setSavingTopic(true);
    setError('');
    try{
      await api('/topics',{method:'POST',body:JSON.stringify({...topic,subjectId:id})});
      notify('Topic saved successfully.');
      await load();
    }catch(err){
      setError(err.message);
      notify(err.message,'error');
    }finally{
      setSavingTopic(false);
    }
  };

  const selectTopic=topicId=>{
    const matchingQuiz=quizzes.find(item=>String(item.topicId)===String(topicId));
    setQuiz(matchingQuiz?{...matchingQuiz,subjectId:id}:blankQuiz(topicId));
  };

  const saveQuiz=async event=>{
    event.preventDefault();
    setSavingQuiz(true);
    setError('');
    try{
      const payload={
        ...quiz,
        subjectId:id,
        timeLimit:Number(quiz.timeLimit),
        passingScore:Number(quiz.passingScore),
        questions:quiz.questions.map(question=>({
          ...question,
          points:Number(question.points)||1,
          choices:question.type==='multiple_choice'?question.choices.map(choice=>choice.trim()):[]
        }))
      };
      const endpoint=quiz._id?`/quizzes/${quiz._id}`:'/quizzes';
      const data=await api(endpoint,{method:quiz._id?'PUT':'POST',body:JSON.stringify(payload)});
      const savedQuiz={...data.quiz,subjectId:id};
      setQuiz(savedQuiz);
      setQuizzes(current=>[...current.filter(item=>String(item._id)!==String(savedQuiz._id)&&String(item.topicId)!==String(savedQuiz.topicId)),savedQuiz]);
      setTopics(current=>current.map(item=>String(item._id)===String(savedQuiz.topicId)?{...item,quiz:savedQuiz}:item));
      notify('Quiz saved successfully.');
    }catch(err){
      setError(err.message);
      notify(err.message,'error');
    }finally{
      setSavingQuiz(false);
    }
  };

  const updateQuestion=(index,value)=>setQuiz(current=>({...current,questions:current.questions.map((question,questionIndex)=>questionIndex===index?{...question,...value}:question)}));
  const updateChoice=(questionIndex,choiceIndex,value)=>setQuiz(current=>({...current,questions:current.questions.map((question,index)=>index===questionIndex?{...question,choices:question.choices.map((choice,index2)=>index2===choiceIndex?value:choice)}:question)}));

  return <main className="page-shell space-y-7">
    <Link to={`/subjects/${id}`} className="back-link">← Back to subject</Link>
    <header className="hero-card"><span className="eyebrow">Faculty authoring studio</span><h1>Build learning materials</h1><p>Create the six topics and timed quizzes that power the student roadmap.</p></header>
    {error&&<div className="error-card">{error}</div>}
    <section className="report-card">
      <h2 className="section-title mb-5">Topic lesson</h2>
      <form onSubmit={saveTopic} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <input className="field" type="number" min="1" max="6" value={topic.topicNumber} onChange={event=>setTopic({...topic,topicNumber:Number(event.target.value)})} placeholder="Topic number" required/>
          <input className="field" value={topic.title} onChange={event=>setTopic({...topic,title:event.target.value})} placeholder="Topic title" required/>
        </div>
        <input className="field" value={topic.description} onChange={event=>setTopic({...topic,description:event.target.value})} placeholder="Short description" required/>
        <textarea className="field min-h-40" value={topic.lessonContent} onChange={event=>setTopic({...topic,lessonContent:event.target.value})} placeholder="Lesson notes (HTML supported)"/>
        <textarea className="field" value={topic.summaryCard} onChange={event=>setTopic({...topic,summaryCard:event.target.value})} placeholder="Summary / key takeaways"/>
        <button className="btn-primary w-fit" disabled={savingTopic}>{savingTopic?'Saving...':'Save topic'}</button>
      </form>
    </section>
    <section className="report-card">
      <h2 className="section-title mb-5">Quiz builder</h2>
      {loading?<div className="skeleton h-40"/>:<form onSubmit={saveQuiz} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold">Topic
            <select className="field" value={quiz.topicId} onChange={event=>selectTopic(event.target.value)} required>
              <option value="">Select topic</option>
              {topics.map(item=><option value={item._id} key={item._id}>Topic {item.topicNumber}: {item.title}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold">Quiz title
            <input className="field" value={quiz.title} onChange={event=>setQuiz({...quiz,title:event.target.value})} placeholder="Quiz title" required/>
          </label>
          <label className="grid gap-2 text-sm font-semibold">Time limit (minutes)
            <input className="field" type="number" min="1" max="180" value={Math.max(1,Math.ceil(Number(quiz.timeLimit||600)/60))} onChange={event=>setQuiz({...quiz,timeLimit:Number(event.target.value)*60})} required/>
          </label>
          <label className="grid gap-2 text-sm font-semibold">Passing score (%)
            <input className="field" type="number" min="1" max="100" value={quiz.passingScore} onChange={event=>setQuiz({...quiz,passingScore:Number(event.target.value)})} required/>
          </label>
        </div>
        {quiz.questions.map((question,index)=><div className="quiz-question" key={question._id||index}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <b>Question {index+1}</b>
            <select className="field max-w-48" value={question.type} onChange={event=>updateQuestion(index,{type:event.target.value,correctAnswer:event.target.value==='true_false'?'True':''})}>
              <option value="multiple_choice">Multiple choice</option><option value="true_false">True / False</option><option value="identification">Identification</option>
            </select>
          </div>
          <input className="field mt-4" value={question.questionText} onChange={event=>updateQuestion(index,{questionText:event.target.value})} placeholder="Question text" required/>
          {question.type==='multiple_choice'&&<div className="grid gap-2 sm:grid-cols-2 mt-3">
            {question.choices.map((choice,choiceIndex)=><input className="field" key={choiceIndex} value={choice} onChange={event=>updateChoice(index,choiceIndex,event.target.value)} placeholder={`Choice ${choiceIndex+1}`} required/>)}
          </div>}
          <label className="grid gap-2 text-sm font-semibold mt-3">Correct answer
            {question.type==='true_false'?<select className="field" value={question.correctAnswer} onChange={event=>updateQuestion(index,{correctAnswer:event.target.value})}><option value="True">True</option><option value="False">False</option></select>:<input className="field" value={question.correctAnswer} onChange={event=>updateQuestion(index,{correctAnswer:event.target.value})} placeholder="Enter correct answer" required/>}
          </label>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm font-semibold">Points
              <input className="field max-w-24" type="number" min="1" value={question.points||1} onChange={event=>updateQuestion(index,{points:Number(event.target.value)})} required/>
            </label>
            <button type="button" className="btn-secondary" disabled={quiz.questions.length===1} onClick={()=>setQuiz(current=>({...current,questions:current.questions.filter((_,questionIndex)=>questionIndex!==index)}))}>Remove question</button>
          </div>
        </div>)}
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn-secondary" disabled={quiz.questions.length>=20} onClick={()=>setQuiz(current=>({...current,questions:[...current.questions,blankQuestion()]}))}>Add question</button>
          <button className="btn-primary" disabled={savingQuiz||!topics.length}>{savingQuiz?'Saving...':quiz._id?'Update quiz':'Save quiz'}</button>
        </div>
      </form>}
    </section>
  </main>;
}

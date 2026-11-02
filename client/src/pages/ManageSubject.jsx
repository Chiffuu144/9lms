import {useCallback,useEffect,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {api} from '../utils/api';
import {useToast} from '../context/ToastContext';

const blankQuestion=()=>({type:'multiple_choice',questionText:'',choices:['',''],correctAnswer:'',points:1});
const blankQuiz=topicId=>({topicId,subjectId:'',title:'',timeLimit:600,passingScore:75,questions:[blankQuestion()]});
const normalizedType=value=>{const type=String(value||'').toLowerCase().replace(/[\s_-]+/g,'');return type==='truefalse'?'true_false':type==='identification'?'identification':type==='multiplechoice'?'multiple_choice':'';};
const parsePoints=value=>{if(value===undefined||value==='')return 1;const points=Number(value);if(!Number.isFinite(points)||points<=0)throw new Error('Question points must be greater than zero.');return points;};
const textFields=block=>Object.fromEntries(block.split(/\r?\n/).filter(Boolean).map(line=>{const separator=line.indexOf(':');if(separator<1)throw new Error('Text import fields must use Name: value format.');return[line.slice(0,separator).trim().toLowerCase().replace(/[\s_-]+/g,''),line.slice(separator+1).trim()];}));
const csvRows=text=>{
  const rows=[];let row=[];let cell='';let quoted=false;
  for(let index=0;index<text.length;index++){
    const character=text[index];
    if(character==='"'&&quoted&&text[index+1]==='"'){cell+='"';index++;}
    else if(character==='"')quoted=!quoted;
    else if(character===','&&!quoted){row.push(cell.trim());cell='';}
    else if((character==='\n'||character==='\r')&&!quoted){if(character==='\r'&&text[index+1]==='\n')index++;row.push(cell.trim());if(row.some(Boolean))rows.push(row);row=[];cell='';}
    else cell+=character;
  }
  if(quoted)throw new Error('The CSV file contains an unclosed quoted field.');
  row.push(cell.trim());if(row.some(Boolean))rows.push(row);
  return rows;
};
const normalizeImportQuizzes=(fileName,text)=>{
  if(fileName.toLowerCase().endsWith('.json')){
    const source=JSON.parse(text);
    const quizzes=Array.isArray(source)?source:source.quizzes;
    if(!Array.isArray(quizzes))throw new Error('JSON must contain a quizzes array.');
    return quizzes.map((quiz,index)=>{
      if(!quiz||typeof quiz!=='object')throw new Error(`Quiz ${index+1} must be an object.`);
      const timeLimit=quiz.timeLimit!==undefined?Number(quiz.timeLimit):quiz.timeLimitMinutes!==undefined?Number(quiz.timeLimitMinutes)*60:600;
      if(!Number.isInteger(timeLimit)||timeLimit<60||timeLimit>1200)throw new Error(`Quiz ${index+1} timeLimit must be between 60 and 1200 seconds.`);
      return {...quiz,timeLimit};
    });
  }
  if(/\.(txt|pdf|docx)$/i.test(fileName)){
    const blocks=text.trim().split(/\r?\n\s*\r?\n/).filter(Boolean);
    if(blocks.length<2)throw new Error('The document needs a quiz details block followed by at least one question block. Use the labeled format shown below.');
    const metadata=textFields(blocks[0]);
    const topicNumber=Number(metadata.topicnumber||metadata.topic);
    if(!Number.isInteger(topicNumber)||topicNumber<1)throw new Error('The document needs a valid topicNumber in the quiz details block.');
    const title=metadata.title||metadata.quiztitle||`Topic ${topicNumber} Quiz`;
    const minutes=metadata.timelimitminutes!==undefined?Number(metadata.timelimitminutes):metadata.timelimit!==undefined?Number(metadata.timelimit):10;
    if(!Number.isInteger(minutes)||minutes<1||minutes>20)throw new Error('Document timeLimitMinutes must be between 1 and 20.');
    const questions=blocks.slice(1).map((block,index)=>{
      const fields=textFields(block);
      const type=normalizedType(fields.type||fields.questiontype);
      const questionText=fields.questiontext||fields.question||'';
      const correctAnswer=fields.correctanswer||fields.answer||'';
      if(!type||!questionText||!correctAnswer)throw new Error(`Document question ${index+1} needs a supported type, questionText, and correctAnswer.`);
      return {type,questionText,correctAnswer,choices:type==='multiple_choice'?(fields.choices||fields.options||'').split('|').map(choice=>choice.trim()).filter(Boolean):[],points:parsePoints(fields.points)};
    });
    return [{topicNumber,title,timeLimit:minutes*60,questions}];
  }
  if(!fileName.toLowerCase().endsWith('.csv'))throw new Error('Choose a .json, .csv, .txt, .pdf, or .docx quiz file.');
  const rows=csvRows(text);
  if(rows.length<2)throw new Error('CSV must include a header and at least one question row.');
  const headers=rows[0].map(header=>header.toLowerCase().replace(/[\s_-]+/g,''));
  const indexOf=(...names)=>headers.findIndex(header=>names.includes(header));
  const get=(values,...names)=>{const index=indexOf(...names);return index<0?'':values[index]||'';};
  const groups=new Map();
  for(const values of rows.slice(1)){
    const topicNumber=Number(get(values,'topicnumber','topic'));
    if(!Number.isInteger(topicNumber)||topicNumber<1)throw new Error('Each CSV row needs a valid topicNumber.');
    const title=get(values,'title','quiztitle')||`Topic ${topicNumber} Quiz`;
    const timeLimitValue=get(values,'timelimitminutes');
    const timeLimit=timeLimitValue?Number(timeLimitValue)*60:600;
    if(!Number.isInteger(timeLimit)||timeLimit<60||timeLimit>1200)throw new Error(`CSV row for Topic ${topicNumber} needs a timeLimitMinutes value between 1 and 20.`);
    const quiz=groups.get(topicNumber)||{topicNumber,title,timeLimit,questions:[]};
    if(quiz.title!==title||quiz.timeLimit!==timeLimit)throw new Error(`CSV rows for Topic ${topicNumber} must use the same title and time limit.`);
    const type=normalizedType(get(values,'type','questiontype'));
    if(!type)throw new Error(`CSV row for Topic ${topicNumber} has an unsupported question type.`);
    const choices=get(values,'choices','options').split('|').map(choice=>choice.trim()).filter(Boolean);
    quiz.questions.push({
      type,
      questionText:get(values,'questiontext','question'),
      choices:type==='multiple_choice'?choices:[],
      correctAnswer:get(values,'correctanswer','answer'),
      points:parsePoints(get(values,'points')),
    });
    groups.set(topicNumber,quiz);
  }
  return [...groups.values()];
};
const extractDocumentText=async file=>{
  const fileName=file.name.toLowerCase();
  if(fileName.endsWith('.pdf')){
    const pdfjsLib=await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url).toString();
    const document=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
    try{
      const pages=[];
      for(let pageNumber=1;pageNumber<=document.numPages;pageNumber++){
        const page=await document.getPage(pageNumber);
        const content=await page.getTextContent();
        pages.push(content.items.map(item=>typeof item.str==='string'?`${item.str}${item.hasEOL?'\n':' '}`:'').join('').trim());
      }
      const text=pages.filter(Boolean).join('\n\n');
      if(!text)throw new Error('No selectable text was found in this PDF. Scanned/image-only PDFs are not supported; use a text-based PDF or .docx file.');
      return text;
    }finally{
      await document.destroy();
    }
  }
  if(fileName.endsWith('.docx')){
    const {default:mammoth}=await import('mammoth');
    const result=await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});
    if(!result.value.trim())throw new Error('No readable text was found in this Word document.');
    return result.value;
  }
  return file.text();
};

export default function ManageSubject(){
  const{id}=useParams();
  const{notify}=useToast();
  const[topics,setTopics]=useState([]);
  const[quizzes,setQuizzes]=useState([]);
  const[quiz,setQuiz]=useState(blankQuiz(''));
  const[error,setError]=useState('');
  const[importFile,setImportFile]=useState(null);
  const[importing,setImporting]=useState(false);
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
        passingScore:75,
        questions:quiz.questions.map(question=>({
          ...question,
          points:Number(question.points),
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
  const importQuizzes=async()=>{
    if(!importFile)return;
    setImporting(true);
    setError('');
    try{
      const quizzes=normalizeImportQuizzes(importFile.name,await extractDocumentText(importFile));
      const result=await api('/quizzes/import',{method:'POST',body:JSON.stringify({subjectId:id,quizzes})});
      setImportFile(null);
      await load();
      notify(`${result.imported} quiz${result.imported===1?'':'zes'} imported successfully.`);
    }catch(err){
      setError(err.message);
      notify(err.message,'error');
    }finally{
      setImporting(false);
    }
  };

  return <main className="page-shell space-y-7">
    <Link to={`/subjects/${id}`} className="back-link">← Back to subject</Link>
    <header className="hero-card"><span className="eyebrow">Faculty authoring studio</span><h1>Build learning materials</h1><p>Create topic lessons and timed quizzes that power the student roadmap.</p></header>
    {error&&<div className="error-card">{error}</div>}
    <section className="report-card">
      <h2 className="section-title mb-5">Topic lesson</h2>
      <form onSubmit={saveTopic} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <input className="field" type="number" min="1" value={topic.topicNumber} onChange={event=>setTopic({...topic,topicNumber:Number(event.target.value)})} placeholder="Topic number" required/>
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
          <label className="grid gap-2 text-sm font-semibold">Time limit (minutes, maximum 20)
            <input className="field" type="number" min="1" max="20" value={Math.max(1,Math.ceil(Number(quiz.timeLimit||600)/60))} onChange={event=>setQuiz({...quiz,timeLimit:Number(event.target.value)*60})} required/>
          </label>
          <div className="grid gap-2 text-sm font-semibold"><span>Passing score</span><div className="field bg-slate-50">75% (fixed)</div></div>
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
    <section className="report-card space-y-4">
      <div><h2 className="section-title">Import quizzes</h2><p className="mt-2 text-sm text-slate-600">Import JSON, CSV (one question per row), plain text, text-based PDF, or Word .docx files. PDF/Word files must use the labeled format below; scanned PDFs and legacy .doc files are not supported. CSV headers: topicNumber, title, timeLimitMinutes, type, questionText, choices (separate choices with |), correctAnswer, points.</p>
        <details className="mt-3 text-sm text-slate-600"><summary className="cursor-pointer font-semibold">Plain-text format example</summary><pre className="mt-2 overflow-x-auto rounded-xl bg-slate-50 p-3 text-xs">topicNumber: 1{'\n'}title: Topic 1 Quiz{'\n'}timeLimitMinutes: 10{'\n\n'}type: multiple_choice{'\n'}questionText: Example question?{'\n'}choices: Choice A | Choice B{'\n'}correctAnswer: Choice A{'\n'}points: 1</pre></details>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid flex-1 gap-2 text-sm font-semibold">Quiz file (.json, .csv, .txt, .pdf, or .docx)
          <input className="field" type="file" accept=".json,.csv,.txt,.pdf,.docx,application/json,text/csv,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={event=>setImportFile(event.target.files?.[0]||null)}/>
        </label>
        <button type="button" className="btn-primary" onClick={importQuizzes} disabled={!importFile||importing}>{importing?'Importing...':'Import quizzes'}</button>
      </div>
      {importFile&&<p className="text-sm text-slate-500">Selected: {importFile.name}</p>}
    </section>
  </main>;
}

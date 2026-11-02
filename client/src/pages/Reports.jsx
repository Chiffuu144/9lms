import {useEffect,useMemo,useState} from 'react';
import {useParams} from 'react-router-dom';
import {Download,FileSpreadsheet,FileText,Printer} from 'lucide-react';
import {api,exportRowsToCsv} from '../utils/api';
import * as XLSX from 'xlsx';
import {jsPDF} from 'jspdf';

const nameParts=name=>{
  const parts=(name||'').trim().split(/\s+/);
  return{first:parts.slice(0,-1).join(' ')||parts[0]||'',surname:parts.length>1?parts[parts.length-1]:parts[0]||''};
};

export default function Reports(){
  const{id}=useParams();
  const[subject,setSubject]=useState(null);
  const[scores,setScores]=useState([]);
  const[matrix,setMatrix]=useState([]);
  const[sort,setSort]=useState('surname');
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState('');

  useEffect(()=>{
    let active=true;
    setLoading(true);
    setError('');
    Promise.all([api(`/subjects/${id}`),api(`/scores?subjectId=${id}`),api(`/scores/matrix?subjectId=${id}`)])
      .then(([subjectData,scoreData,matrixData])=>{
        if(!active)return;
        setSubject(subjectData.subject);
        setScores(scoreData.scores||[]);
        setMatrix(matrixData.matrix||[]);
      })
      .catch(err=>{if(active)setError(err.message);})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[id]);

  const sorted=useMemo(()=>[...scores].sort((a,b)=>sort==='score'?b.percentage-a.percentage:nameParts(a.studentId?.fullName).surname.localeCompare(nameParts(b.studentId?.fullName).surname)),[scores,sort]);
  const rows=matrix.map(row=>{
    const name=nameParts(row.studentName);
    return{
      Surname:name.surname,
      'First Name':name.first,
      'Student ID':row.studentId,
      'Topic 1':row.scores[1]||'',
      'Topic 2':row.scores[2]||'',
      'Topic 3':row.scores[3]||'',
      'Topic 4':row.scores[4]||'',
      'Topic 5':row.scores[5]||'',
      'Topic 6':row.scores[6]||'',
      Overall:`${row.overall}%`,
      Status:row.status
    };
  });
  const xlsx=()=>{
    const book=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(rows),'Grade Matrix');
    XLSX.writeFile(book,'group9-grade-matrix.xlsx');
  };
  const pdf=()=>{
    const doc=new jsPDF();
    doc.text(`${subject?.subjectName||'GROUP9'} Grade Matrix`,14,15);
    rows.forEach((row,index)=>doc.text(`${row.Surname}, ${row['First Name']} | ${row.Overall} | ${row.Status}`,14,28+index*7));
    doc.save('group9-grade-matrix.pdf');
  };

  if(loading)return <main className="page-shell"><div className="skeleton h-10 w-2/3"/><div className="skeleton h-64 mt-6"/></main>;
  if(error)return <main className="page-shell"><div className="error-card">{error}</div></main>;

  return <main className="page-shell space-y-7">
    <header className="hero-card"><span className="eyebrow">Faculty reporting</span><h1>{subject?.subjectCode||'Subject'} grade reports</h1><p>Per-topic attempts and the master six-topic class matrix.</p></header>
    <section className="report-card">
      <div className="report-actions"><h2 className="section-title">Master grade matrix</h2><div className="flex flex-wrap gap-2">
        <button className="btn-secondary" onClick={()=>window.print()}><Printer size={16}/> Print</button>
        <button className="btn-secondary" onClick={pdf}><FileText size={16}/> PDF</button>
        <button className="btn-secondary" onClick={xlsx}><FileSpreadsheet size={16}/> XLSX</button>
        <button className="btn-secondary" onClick={()=>exportRowsToCsv(rows,'group9-grade-matrix.csv')}><Download size={16}/> CSV</button>
      </div></div>
      <div className="overflow-x-auto"><table className="report-table"><thead><tr><th>Surname</th><th>First name</th><th>ID</th>{[1,2,3,4,5,6].map(number=><th key={number}>Topic {number}</th>)}<th>Overall</th><th>Status</th></tr></thead><tbody>
        {rows.map(row=><tr key={row['Student ID']}><td>{row.Surname}</td><td>{row['First Name']}</td><td>{row['Student ID']}</td>{[1,2,3,4,5,6].map(number=><td key={number}>{row[`Topic ${number}`]||'—'}</td>)}<td>{row.Overall}</td><td><span className={row.Status==='PASSED'?'pass-pill':'pending-pill'}>{row.Status}</span></td></tr>)}
      </tbody></table>{!rows.length&&<div className="empty-card">No enrolled students yet.</div>}</div>
    </section>
    <section className="report-card">
      <div className="report-actions"><h2 className="section-title">Per-topic attempts</h2><select className="field max-w-xs" value={sort} onChange={event=>setSort(event.target.value)}><option value="surname">Sort by surname A–Z</option><option value="score">Sort by score highest first</option></select></div>
      <div className="overflow-x-auto"><table className="report-table"><thead><tr><th>Student</th><th>Topic</th><th>Score</th><th>Result</th><th>Attempt</th></tr></thead><tbody>
        {sorted.map(score=><tr key={score._id}><td>{score.studentId?.fullName}</td><td>{score.topicNumber}</td><td>{score.percentage}%</td><td>{score.passed?'PASSED':'FAILED'}</td><td>{score.attemptNumber}</td></tr>)}
      </tbody></table>{!sorted.length&&<div className="empty-card">No quiz attempts yet.</div>}</div>
    </section>
  </main>;
}

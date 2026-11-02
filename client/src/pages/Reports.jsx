import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download, FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { api, exportRowsToCsv } from '../utils/api';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

const nameParts = name => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  return { first: parts.slice(0, -1).join(' ') || parts[0] || '', surname: parts.length > 1 ? parts[parts.length - 1] : parts[0] || '' };
};
const savePdf = (title, rows, filename) => {
  const doc = new jsPDF('l', 'mm', 'a4');
  let y = 16;
  doc.setFontSize(13);
  doc.text(title, 14, y);
  y += 10;
  doc.setFontSize(8);
  for (const row of rows) {
    const lines = doc.splitTextToSize(row.join(' | '), 268);
    if (y + lines.length * 4 > 195) { doc.addPage(); y = 15; }
    doc.text(lines, 14, y);
    y += lines.length * 4 + 2;
  }
  doc.save(filename);
};

export default function Reports() {
  const { id } = useParams();
  const [subject, setSubject] = useState(null);
  const [topics, setTopics] = useState([]);
  const [scores, setScores] = useState([]);
  const [matrix, setMatrix] = useState([]);
  const [sort, setSort] = useState('surname');
  const [topicFilter, setTopicFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([api(`/subjects/${id}`), api(`/scores?subjectId=${id}`), api(`/scores/matrix?subjectId=${id}`)])
      .then(([subjectData, scoreData, matrixData]) => {
        if (!active) return;
        setSubject(subjectData.subject);
        setScores(scoreData.scores || []);
        setMatrix(matrixData.matrix || []);
        setTopics(matrixData.topics || []);
      })
      .catch(requestError => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  const matrixRows = useMemo(() => matrix.map(row => {
    const name = nameParts(row.studentName);
    return {
      Surname: name.surname,
      'First Name': name.first,
      'Student ID': row.studentId,
      ...Object.fromEntries(topics.map(topic => [`Topic ${topic.topicNumber}`, row.scores[topic.topicNumber] ?? ''])),
      Overall: `${row.overall}%`,
      Status: row.status,
    };
  }), [matrix, topics]);

  const attempts = useMemo(() => {
    const filtered = scores.filter(score => topicFilter === 'all' || Number(score.topicNumber) === Number(topicFilter));
    return filtered.sort((a, b) => {
      if (sort === 'score-desc') return b.percentage - a.percentage;
      if (sort === 'score-asc') return a.percentage - b.percentage;
      return nameParts(a.studentId?.fullName).surname.localeCompare(nameParts(b.studentId?.fullName).surname);
    });
  }, [scores, sort, topicFilter]);

  const attemptRows = useMemo(() => attempts.map(score => {
    const name = nameParts(score.studentId?.fullName);
    return {
      Surname: name.surname,
      'First Name': name.first,
      'Student ID': score.studentId?.studentId || '',
      Topic: score.topicNumber,
      Score: `${score.percentage}%`,
      Result: score.passed ? 'PASSED' : 'FAILED',
      Attempt: score.attemptNumber,
      Date: new Date(score.createdAt).toLocaleDateString(),
    };
  }), [attempts]);

  const topicNumbers = topics.map(topic => Number(topic.topicNumber));
  const matrixHeaders = ['Surname', 'First Name', 'Student ID', ...topicNumbers.map(number => `Topic ${number}`), 'Overall', 'Status'];
  const attemptsHeaders = ['Surname', 'First Name', 'Student ID', 'Topic', 'Score', 'Result', 'Attempt', 'Date'];
  const exportMatrixPdf = () => savePdf(
    `${subject?.subjectName || 'GROUP9'} Grade Matrix`,
    [matrixHeaders, ...matrixRows.map(row => matrixHeaders.map(header => row[header] ?? ''))],
    'group9-grade-matrix.pdf',
  );
  const exportAttemptsPdf = () => savePdf(
    `${subject?.subjectName || 'GROUP9'} Quiz Attempts`,
    [attemptsHeaders, ...attemptRows.map(row => attemptsHeaders.map(header => row[header] ?? ''))],
    'group9-topic-attempts.pdf',
  );
  const exportXlsx = () => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(matrixRows), 'Grade Matrix');
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(attemptRows), 'Quiz Attempts');
    XLSX.writeFile(book, 'group9-grade-reports.xlsx');
  };

  if (loading) return <main className="page-shell"><div className="skeleton h-10 w-2/3"/><div className="skeleton mt-6 h-64"/></main>;
  if (error) return <main className="page-shell"><div className="error-card" role="alert">{error}</div></main>;

  return (
    <main className="page-shell space-y-7">
      <header className="hero-card print-hidden"><span className="eyebrow">Faculty reporting</span><h1>{subject?.subjectCode || 'Subject'} grade reports</h1><p>Per-topic attempts and the master grade matrix across all published topics.</p></header>
      <section className="report-card">
        <div className="report-actions print-hidden"><h2 className="section-title">Master grade matrix</h2><div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => window.print()}><Printer size={16}/> Print</button>
          <button className="btn-secondary" onClick={exportMatrixPdf}><FileText size={16}/> Matrix PDF</button>
          <button className="btn-secondary" onClick={exportXlsx}><FileSpreadsheet size={16}/> XLSX</button>
          <button className="btn-secondary" onClick={() => exportRowsToCsv(matrixRows, 'group9-grade-matrix.csv', matrixHeaders)}><Download size={16}/> Matrix CSV</button>
        </div></div>
        <div className="overflow-x-auto"><table className="report-table"><thead><tr><th>Surname</th><th>First name</th><th>ID</th>{topicNumbers.map(number => <th key={number}>Topic {number}</th>)}<th>Overall</th><th>Status</th></tr></thead><tbody>
          {matrixRows.map(row => <tr key={row['Student ID']}><td>{row.Surname}</td><td>{row['First Name']}</td><td>{row['Student ID']}</td>{topicNumbers.map(number => <td key={number}>{row[`Topic ${number}`] || '—'}</td>)}<td>{row.Overall}</td><td><span className={row.Status === 'PASSED' ? 'pass-pill' : 'pending-pill'}>{row.Status}</span></td></tr>)}
        </tbody></table>{!matrixRows.length && <div className="empty-card">No enrolled students yet.</div>}</div>
      </section>
      <section className="report-card">
        <div className="report-actions print-hidden"><h2 className="section-title">Per-topic attempts</h2><div className="flex flex-wrap gap-2">
          <select className="field max-w-xs" value={topicFilter} onChange={event => setTopicFilter(event.target.value)} aria-label="Filter attempts by topic"><option value="all">All topics</option>{topicNumbers.map(number => <option value={number} key={number}>Topic {number}</option>)}</select>
          <select className="field max-w-xs" value={sort} onChange={event => setSort(event.target.value)} aria-label="Sort quiz attempts"><option value="surname">Surname A–Z</option><option value="score-desc">Score high-to-low</option><option value="score-asc">Score low-to-high</option></select>
          <button className="btn-secondary" onClick={() => window.print()}><Printer size={16}/> Print</button>
          <button className="btn-secondary" onClick={exportAttemptsPdf}><FileText size={16}/> Attempts PDF</button>
          <button className="btn-secondary" onClick={() => exportRowsToCsv(attemptRows, 'group9-topic-attempts.csv', attemptsHeaders)}><Download size={16}/> Attempts CSV</button>
        </div></div>
        <div className="overflow-x-auto"><table className="report-table"><thead><tr><th>Surname</th><th>First name</th><th>Student ID</th><th>Topic</th><th>Score</th><th>Result</th><th>Attempt</th><th>Date</th></tr></thead><tbody>
          {attemptRows.map((row, index) => <tr key={`${row['Student ID']}-${row.Topic}-${row.Attempt}-${index}`}><td>{row.Surname}</td><td>{row['First Name']}</td><td>{row['Student ID']}</td><td>{row.Topic}</td><td>{row.Score}</td><td>{row.Result}</td><td>{row.Attempt}</td><td>{row.Date}</td></tr>)}
        </tbody></table>{!attemptRows.length && <div className="empty-card">No quiz attempts for this selection yet.</div>}</div>
      </section>
    </main>
  );
}

"use client";
import { useEffect, useRef, useState } from 'react';
import { ChevronRight, FileText, X } from 'lucide-react';
import { answerLabel, responseDetail, resultsInfo, versionResults, type Detail, type ResultsInfo, type VersionResults } from '../lib/workspace';
import { QuestionTypeIcon } from './QuestionTypeIcon';
const time=(value:string)=>new Date(value).toLocaleString();

function ResponseDialog({formId,id,onClose}:{formId:string;id:string;onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [detail,setDetail]=useState<Detail|null>(null);const [error,setError]=useState('');const [reload,setReload]=useState(0);
  useEffect(()=>{dialog.current?.showModal();},[]);
  useEffect(()=>{let active=true;setError('');responseDetail(formId,id).then(value=>{if(active)setDetail(value);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[formId,id,reload]);
  return <dialog ref={dialog} className="response-dialog" aria-labelledby="response-heading" onCancel={onClose}>
    <header><h2 id="response-heading">Individual response</h2><button className="icon-button" aria-label="Close response" onClick={onClose}><X size={20}/></button></header>
    {error?<p role="alert">{error}<button className="secondary" onClick={()=>setReload(v=>v+1)}>Retry</button></p>:!detail?<p role="status">Loading response…</p>:<>
      <p>Submitted {time(detail.created_at)}</p><p className="version-id">Version: {detail.version_id}</p><h3>{detail.snapshot.title}</h3>
      <dl className="response-answers">{detail.snapshot.questions.map((q,index)=><div key={q.id}><dt><QuestionTypeIcon type={q.type}/><span>{index+1}. {q.prompt}</span></dt>{q.description&&<dd className="answer-description">{q.description}</dd>}<dd>{answerLabel(q,detail.answers)}</dd></div>)}</dl>
    </>}
  </dialog>;
}

export function Results({formId}:{formId:string}) {
  const [info,setInfo]=useState<ResultsInfo|null>(null);const [version,setVersion]=useState('');
  const [data,setData]=useState<VersionResults|null>(null);const [error,setError]=useState('');const [versionError,setVersionError]=useState('');
  const [reload,setReload]=useState(0);const [view,setView]=useState<'responses'|'summary'>('responses');const [selected,setSelected]=useState<string|null>(null);
  useEffect(()=>{let active=true;setError('');resultsInfo(formId).then(value=>{if(active){setInfo(value);setVersion(previous=>value.versions.some(v=>v.id===previous)?previous:value.versions.at(-1)?.id||'');}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[formId,reload]);
  useEffect(()=>{let active=true;setData(null);setVersionError('');if(version)versionResults(formId,version).then(value=>{if(active)setData(value);}).catch(e=>{if(active)setVersionError(e.message);});return()=>{active=false;};},[formId,version,reload]);
  const current=info?.versions.find(v=>v.id===version);
  return <main className="creator-page results-page">
    <header className="creator-header"><div className="results-breadcrumb"><a href="/"><FileText size={16}/>Forms</a><ChevronRight size={15}/><span>{info?.title||'Results'}</span></div><nav aria-label="Form navigation"><a href={'/?form='+formId}>Content</a><span aria-current="page">Results</span></nav></header>
    <div className="creator-tabs"><button className={view==='summary'?'active':''} aria-pressed={view==='summary'} onClick={()=>setView('summary')}>Response summary</button><button className={view==='responses'?'active':''} aria-pressed={view==='responses'} onClick={()=>setView('responses')}>Responses{data?' ['+data.submissions.length+']':''}</button></div>
    <section className="results-content">
      {error?<div className="error-banner" role="alert">{error}<button onClick={()=>setReload(v=>v+1)}>Retry</button></div>:!info?<p role="status">Loading results…</p>:<>
        <div className="results-toolbar"><label>Version <select value={version} disabled={!info.versions.length} onChange={e=>setVersion(e.target.value)} aria-label="Results version">
          {!info.versions.length&&<option value="">No published versions</option>}{info.versions.map(v=><option key={v.id} value={v.id}>Version {v.number} · {time(v.created_at)} · {v.response_count} {v.response_count===1?'response':'responses'}</option>)}
        </select></label><span>All versions: {info.response_count} {info.response_count===1?'response':'responses'}</span><button className="secondary" onClick={()=>setReload(v=>v+1)}>Refresh results</button></div>
        {!version?<div className="workspace-empty"><h2>No published versions yet</h2><p>Publish this form to start collecting responses.</p></div>:versionError?<div role="alert" className="error-banner">{versionError}<button onClick={()=>setReload(v=>v+1)}>Retry</button></div>:!data?<p role="status">Loading version results…</p>:<>
          <p className="version-caption">Version {current?.number} · {data.snapshot.title}<span className="version-id">{version}</span></p>
          {!data.submissions.length&&<p className="empty-results" role="status">No responses for this version yet.</p>}
          {view==='responses'?<div className="table-scroll" role="region" aria-label="Responses table, scroll horizontally for more questions" tabIndex={0}>
            <table className="responses-table"><thead><tr><th scope="col">Response time</th><th scope="col">Version</th>{data.snapshot.questions.map(q=><th scope="col" key={q.id}><span className="table-question"><QuestionTypeIcon type={q.type}/>{q.prompt}</span></th>)}</tr></thead>
              <tbody>{data.submissions.map(row=><tr key={row.id}><td><button className="response-link" onClick={()=>setSelected(row.id)} aria-label={'Open response '+row.id}>{time(row.created_at)}</button></td><td>Version {current?.number}</td>{data.snapshot.questions.map(q=><td key={q.id}>{answerLabel(q,row.answers)}</td>)}</tr>)}</tbody>
            </table>
          </div>:<div className="summary-list">{data.summaries.map((summary,index)=><article className="summary-card" key={summary.question.id}>
            <h2><QuestionTypeIcon type={summary.question.type}/><span>{index+1}. {summary.question.prompt}</span></h2><p>{summary.answered} out of {data.submissions.length} {data.submissions.length===1?'person':'people'} answered this question. {summary.unanswered} unanswered.</p>
            {summary.distribution?<ul className="distribution">{summary.distribution.map(item=><li key={String(item.value)}><span>{item.label}</span><meter min={0} max={Math.max(1,data.submissions.length)} value={item.count} aria-label={item.label+' count'}/><strong>{item.count}</strong></li>)}</ul>:<>
              {summary.question.type==='number'&&summary.answered>0&&<p>Minimum: {summary.minimum} · Maximum: {summary.maximum}</p>}
              {summary.values?.length?<ul className="text-responses">{summary.values.map((value,i)=><li key={i}>{String(value)}</li>)}</ul>:<p className="empty-hint">No answers yet.</p>}
            </>}
          </article>)}</div>}
        </>}
      </>}
    </section>
    {selected&&<ResponseDialog formId={formId} id={selected} onClose={()=>setSelected(null)}/>}
  </main>;
}

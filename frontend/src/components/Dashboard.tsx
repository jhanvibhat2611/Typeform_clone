"use client";
import { useEffect,useRef,useState } from 'react';
import { FileText, Plus, Copy, Pencil, Trash2, BarChart3, X, PanelsTopLeft, Users, Search } from 'lucide-react';
import { createForm, deleteForm, duplicateForm, forms, renameForm, type FormRow } from '../lib/workspace';
import { TitleDialog } from './TitleDialog';

function DeleteDialog({form,busy,error,onCancel,onConfirm}:{form:FormRow;busy:boolean;error:string;onCancel:()=>void;onConfirm:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{dialog.current?.showModal();},[]);
  return <dialog ref={dialog} className="confirm-dialog" aria-labelledby="delete-title" onCancel={e=>{e.preventDefault();if(!busy)onCancel();}}>
    <h2 id="delete-title">Delete “{form.title}”?</h2><p>This permanently deletes the form, every published version and all associated responses. Its public link will stop working.</p>
    {error&&<p className="field-error" role="alert">{error}</p>}
    <div className="confirm-actions"><button className="secondary" disabled={busy} onClick={onCancel}>Cancel</button><button className="danger" disabled={busy} onClick={onConfirm}>{busy?'Deleting…':'Delete form and responses'}</button></div>
  </dialog>;
}
export function Dashboard() {
  const [query,setQuery] = useState('');
  const [items,setItems]=useState<FormRow[]|null>(null);
  const [error,setError]=useState('');const [toast,setToast]=useState('');
  const [busy,setBusy]=useState(false);const [dialogError,setDialogError]=useState('');
  const [editing,setEditing]=useState<FormRow|'new'|null>(null);const [deleting,setDeleting]=useState<FormRow|null>(null);
  async function load(){setError('');try{setItems(await forms());}catch(e){setError((e as Error).message);}}
  useEffect(()=>{void load();},[]);
  async function saveTitle(title:string){
    if(Array.from(title).length>160||!title.trim()){setDialogError('Enter a nonblank title of at most 160 characters.');return;}
    setBusy(true);setDialogError('');
    try{
      if(editing==='new'){const created=await createForm(title);window.location.assign('/?form='+created.id);return;}
      if(editing){await renameForm(editing.id,title);setToast('Form renamed');setEditing(null);await load();}
    }catch(e){setDialogError((e as Error).message);}finally{setBusy(false);}
  }
  async function duplicate(form:FormRow){setBusy(true);setError('');try{await duplicateForm(form.id);setToast('Draft duplicated. The copy is unpublished and has no responses.');await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function remove(){if(!deleting)return;setBusy(true);setDialogError('');try{await deleteForm(deleting.id);setDeleting(null);setToast('Form and associated responses deleted');await load();}catch(e){setDialogError((e as Error).message);}finally{setBusy(false);}}
  return <main className="creator-page dashboard-page">
    <header className="creator-header"><a href="/" className="creator-brand"><PanelsTopLeft size={25}/>Typeform Builder</a><span className="shared-creator">Shared workspace</span></header>
    <div className="creator-tabs"><span className="active">Forms</span><button aria-disabled="true">Contacts <small>Coming Soon</small></button><button aria-disabled="true">Automations <small>Coming Soon</small></button></div>
    <div className="workspace-layout"><aside className="workspace-sidebar" aria-label="Workspace">
      <button className="primary" disabled={busy} onClick={()=>{setEditing('new');setDialogError('');}}><Plus size={18}/>Create form</button>
      <label className="workspace-search"><Search size={20}/><input aria-label="Search forms" placeholder="Search" value={query} onChange={event=>setQuery(event.target.value)}/></label>
      <div className="workspace-sidebar-title"><PanelsTopLeft size={20}/>Workspaces</div><a href="/" aria-current="page">My workspace</a>
      <p className="workspace-total">Responses collected <strong>{items?.reduce((total,form)=>total+form.response_count,0) ?? 'Loading'}</strong></p>
      <button className="workspace-placeholder" aria-disabled="true"><Users size={18}/>Invite members <small>Coming Soon</small></button>
    </aside>
    <section className="workspace-content"><div className="workspace-heading"><h1>My workspace</h1><span className="shared-creator">Shared creator</span></div>
      {error&&<div role="alert" className="error-banner">{error}<button className="text-button" onClick={load}>Retry</button></div>}
      {items===null&&!error&&<p role="status">Loading forms…</p>}
      {items?.length===0&&<div className="workspace-empty"><FileText size={32}/><h2>No forms yet</h2><p>Create a form to start collecting responses.</p></div>}
      {items && items.length > 0 && <div className="forms-list-heading"><span>Form</span><span>Status / Responses</span><span>Actions</span></div>}
      {items?.length!==0 && items?.filter(form=>form.title.toLowerCase().includes(query.toLowerCase())).length===0 && <p role="status">No forms match your search.</p>}
      <div className="forms-grid">{items?.filter(form=>form.title.toLowerCase().includes(query.toLowerCase())).map(form=><article className="form-card" key={form.id}>
        <a className="form-card-main" href={'/?form='+form.id}><FileText size={24}/><h2>{form.title}</h2></a>
        <div className="form-card-meta"><span className={'form-status '+form.status}>{form.status==='published'?'Published':'Draft'}</span><span>{form.response_count} {form.response_count===1?'response':'responses'}</span></div>
        <div className="form-card-actions"><a href={'/forms/'+form.id+'/results'} aria-label={'Results for '+form.title}><BarChart3 size={15}/>Results</a>
          <button className="icon-button" disabled={busy} aria-label={'Rename '+form.title} onClick={()=>{setEditing(form);setDialogError('');}}><Pencil size={16}/></button>
          <button className="icon-button" disabled={busy} aria-label={'Duplicate '+form.title} onClick={()=>duplicate(form)}><Copy size={16}/></button>
          <button className="icon-button" disabled={busy} aria-label={'Delete '+form.title} onClick={()=>{setDeleting(form);setDialogError('');}}><Trash2 size={16}/></button></div>
      </article>)}</div>
    </section></div>
    {toast&&<div className="toast" role="status">{toast}<button className="icon-button" aria-label="Dismiss notification" onClick={()=>setToast('')}><X size={16}/></button></div>}
    {editing&&<TitleDialog title={editing==='new'?'Create form':'Rename form'} initial={editing==='new'?'':editing.title} busy={busy} error={dialogError} onSubmit={saveTitle} onCancel={()=>setEditing(null)}/>}
    {deleting&&<DeleteDialog form={deleting} busy={busy} error={dialogError} onCancel={()=>setDeleting(null)} onConfirm={remove}/>}
  </main>;
}

"use client";
import { useEffect, useRef, useState } from 'react';
export function TitleDialog({title, initial='', busy, error, onCancel, onSubmit}:{title:string; initial?:string; busy:boolean; error:string; onCancel:()=>void; onSubmit:(value:string)=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [value,setValue]=useState(initial);
  useEffect(()=>{dialog.current?.showModal();},[]);
  return <dialog ref={dialog} className="confirm-dialog title-dialog" aria-labelledby="title-dialog-heading" onCancel={event=>{event.preventDefault();if(!busy)onCancel();}}>
    <h2 id="title-dialog-heading">{title}</h2>
    <form onSubmit={event=>{event.preventDefault();onSubmit(value);}}>
      <label htmlFor="form-name">Form title</label><input autoFocus id="form-name" value={value} disabled={busy} onChange={e=>setValue(e.target.value)} required aria-invalid={Boolean(error)}/>
      {error&&<p role="alert" className="field-error">{error}</p>}
      <div className="confirm-actions"><button type="button" className="secondary" onClick={onCancel} disabled={busy}>Cancel</button><button className="primary" disabled={busy||!value.trim()}>{busy?'Saving…':'Save'}</button></div>
    </form>
  </dialog>;
}

"use client";
import { useEffect, useRef, useState } from 'react';
import { Copy, ExternalLink, X } from 'lucide-react';
import type { Publication } from '../lib/publication';

export function ShareDialog({ publication, onClose }: { publication: Publication; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [feedback, setFeedback] = useState('');
  const link = window.location.origin + '/f/' + publication.public_id;
  useEffect(() => { dialog.current?.showModal(); }, []);
  async function copy() {
    try { await navigator.clipboard.writeText(link); setFeedback('Link copied'); }
    catch { setFeedback('Could not copy automatically. Select and copy the link below.'); }
  }
  return <dialog ref={dialog} className="confirm-dialog share-dialog" onCancel={onClose} aria-labelledby="share-title">
    <div className="share-heading"><h2 id="share-title">Share your form</h2><button className="icon-button" aria-label="Close share" onClick={onClose}><X size={18}/></button></div>
    <p>{publication.published ? 'Your form is live. Share this link to collect responses.' : 'This link stays the same. Publish the form to accept responses.'}</p>
    <label htmlFor="public-link">Public link</label><input id="public-link" readOnly value={link} onFocus={event => event.target.select()} />
    <div className="confirm-actions"><a className="secondary" href={link} target="_blank" rel="noreferrer"><ExternalLink size={15}/>Open form</a><button className="primary" onClick={copy}><Copy size={15}/>Copy link</button></div>
    <p role="status">{feedback}</p>
  </dialog>;
}

import { useEffect, useId, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Check, Download, Eye, EyeOff, GraduationCap, Leaf, LoaderCircle, LogOut, MessageCircle, Plus, RefreshCw, Save, ShieldCheck, Stethoscope, Trash2, UserRound, X } from 'lucide-react';
import { api, formatDate } from './lib';
import { Logo, Stars } from './App.jsx';

const profileFields = [
  ['name', 'Display name'], ['initials', 'Monogram initials'], ['focus', 'Focus line'], ['location', 'Location'], ['email', 'Contact email', 'email'], ['photoUrl', 'Portrait image URL (optional, HTTPS)', 'url'],
  ['heroTitle', 'Homepage headline', 'textarea'], ['heroDescription', 'Homepage introduction', 'textarea'], ['aboutTitle', 'About heading'], ['aboutText', 'About paragraph', 'textarea'], ['aboutSecondary', 'Second about paragraph (optional)', 'textarea'],
  ['practiceNotice', 'Practice status notice (optional)', 'textarea'], ['registration', 'Council registration'], ['registrationNote', 'Registration status note (optional)'], ['contactTitle', 'Contact heading'], ['contactText', 'Contact description', 'textarea'],
];
const collections = {
  experience: { title: 'Experience', subtitle: 'Your clinical journey, in the order you want it to appear.', fields: [['role', 'Role'], ['organization', 'Organization & location'], ['period', 'Dates'], ['status', 'Status badge (optional)'], ['description', 'Description', 'textarea']], empty: { role: '', organization: '', period: '', status: '', description: '' } },
  education: { title: 'Education', subtitle: 'Qualifications, institutions, and ongoing learning.', fields: [['degree', 'Degree / qualification'], ['institution', 'Institution'], ['detail', 'Year or progress']], empty: { degree: '', institution: '', detail: '' } },
  focusAreas: { title: 'Focus areas', subtitle: 'The three introductory cards on your portfolio. You can add more or remove them.', fields: [['title', 'Title'], ['description', 'Description', 'textarea'], ['icon', 'Icon', 'icon'], ['color', 'Color', 'color']], empty: { title: '', description: '', icon: 'leaf', color: 'green' } },
};

function Field({ field, value, onChange }) {
  const id = useId();
  const [key, label, type = 'text'] = field;
  return <div className={type === 'textarea' ? 'field-wide' : ''}><label htmlFor={id}>{label}</label>{['icon', 'color'].includes(type) ? <select id={id} value={value} onChange={e => onChange(key, e.target.value)}>{(type === 'icon' ? ['leaf', 'heart', 'people'] : ['green', 'peach', 'lavender']).map(option => <option key={option}>{option}</option>)}</select> : type === 'textarea' ? <textarea id={id} value={value} rows={3} maxLength={key.startsWith('about') ? 3000 : key === 'description' ? 2000 : 600} onChange={e => onChange(key, e.target.value)} /> : <input id={id} value={value} type={type} maxLength={key === 'photoUrl' ? 2000 : 600} onChange={e => onChange(key, e.target.value)} />}</div>;
}
function Login({ onLogin }) {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault(); setError(''); setBusy(true);
    try { await api('session', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))) }); await onLogin(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <main className="login-page"><a href="/" className="login-back"><ArrowLeft size={17} /> Back to portfolio</a><div className="login-layout"><div className="login-story"><Logo /><span className="eyebrow">YOUR SPACE TO GROW</span><h1>A little update.<br />A more personal<br /><span className="serif-accent">connection.</span></h1><p>Keep your story up to date, share your journey, and make room for patient voices.</p><div className="login-art"><Leaf size={170} strokeWidth={0.7} /><span>✳</span></div></div><div className="login-card"><span className="login-lock"><ShieldCheck size={27} /></span><h2>Welcome back, Doctor.</h2><p className="muted">Sign in to manage your portfolio.</p><form onSubmit={submit}><label>Username<input name="username" autoComplete="username" placeholder="Your username" required maxLength={100} /></label><label>Password<div className="password-field"><input name="password" type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Your password" required maxLength={256} /><button type="button" className="icon-button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button primary full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in to dashboard'} <ArrowUpRight size={18} /></button></form><p className="form-footnote"><ShieldCheck size={14} /> Private access for the doctor</p></div></div></main>;
}

export default function Admin() {
  const [authenticated, setAuthenticated] = useState(null);
  const [content, setContent] = useState(null);
  const [revision, setRevision] = useState(0);
  const [feedback, setFeedback] = useState([]);
  const [tab, setTab] = useState('profile');
  const [filter, setFilter] = useState('pending');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);
  useEffect(() => { document.title = 'Doctor dashboard · Portfolio'; api('session').then(async data => { setAuthenticated(data.authenticated); if (data.authenticated) await load(); }).catch(e => { setAuthenticated(false); setNotice({ error: true, text: e.message }); }); }, []);
  useEffect(() => {
    const handle = event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', handle);
    return () => window.removeEventListener('beforeunload', handle);
  }, [dirty]);
  async function load() {
    const [details, reviews] = await Promise.all([api('admin/content'), api('admin/feedback')]);
    setContent(details.content); setRevision(details.revision); setFeedback(reviews.feedback); setDirty(false); setAuthenticated(true);
  }
  function report(error) { setNotice({ error: true, text: error.message }); if (error.status === 401) setAuthenticated(false); }
  async function reload() {
    if (dirty && !window.confirm('Discard your unsaved edits and reload the latest details?')) return;
    setBusy('reload');
    try { await load(); setNotice({ text: 'Dashboard refreshed.' }); } catch (e) { report(e); } finally { setBusy(''); }
  }
  function editProfile(key, value) { setContent(current => ({ ...current, profile: { ...current.profile, [key]: value } })); setDirty(true); }
  function editCollection(id, key, value) { setContent(current => ({ ...current, [tab]: current[tab].map(item => item.id === id ? { ...item, [key]: value } : item) })); setDirty(true); }
  function addItem() { setContent(current => ({ ...current, [tab]: [...current[tab], { id: crypto.randomUUID(), ...collections[tab].empty }] })); setDirty(true); }
  function removeItem(id) { if (!window.confirm('Remove this entry? The change takes effect when you save.')) return; setContent(current => ({ ...current, [tab]: current[tab].filter(item => item.id !== id) })); setDirty(true); }
  function moveItem(index, direction) { setContent(current => { const items = [...current[tab]]; [items[index], items[index + direction]] = [items[index + direction], items[index]]; return { ...current, [tab]: items }; }); setDirty(true); }
  async function save() {
    setBusy('save'); setNotice(null);
    try { const result = await api('admin/content', { method: 'PUT', body: JSON.stringify({ content, revision }) }); setContent(result.content); setRevision(result.revision); setDirty(false); setNotice({ text: 'Saved. Your portfolio now shows the latest details.' }); }
    catch (e) { report(e); } finally { setBusy(''); }
  }
  async function moderate(id, status) {
    if (status === 'delete' && !window.confirm('Permanently delete this feedback? This cannot be undone.')) return;
    setBusy(id); setNotice(null);
    try {
      await api('admin/feedback', { method: status === 'delete' ? 'DELETE' : 'PATCH', body: JSON.stringify({ id, status }) });
      setFeedback(current => status === 'delete' ? current.filter(item => item.id !== id) : current.map(item => item.id === id ? { ...item, status } : item));
      setNotice({ text: status === 'approved' ? 'Feedback approved and published on your portfolio and reviews page.' : status === 'delete' ? 'Feedback deleted.' : 'Feedback updated. It is not visible publicly.' });
    } catch (e) { report(e); } finally { setBusy(''); }
  }
  async function logout() {
    if (dirty && !window.confirm('Sign out and discard unsaved edits?')) return;
    try { await api('session', { method: 'DELETE' }); setAuthenticated(false); setContent(null); setDirty(false); setNotice(null); } catch (e) { report(e); }
  }
  if (authenticated === null) return <main className="loading-page"><LoaderCircle className="spin" /><p>Opening your workspace…</p></main>;
  if (!authenticated) return <Login onLogin={load} />;
  const tabs = [['profile', UserRound, 'Profile & content'], ['experience', Stethoscope, 'Experience'], ['education', GraduationCap, 'Education'], ['focusAreas', Leaf, 'Focus areas'], ['feedback', MessageCircle, 'Patient feedback']];
  const pending = feedback.filter(item => item.status === 'pending').length;
  return <div className="admin-shell"><aside className="admin-sidebar"><Logo name={content?.profile.name} focus="YOUR PORTFOLIO WORKSPACE" /><span className="sidebar-label">MANAGE</span><nav aria-label="Dashboard sections">{tabs.map(([key, Icon, title]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}><Icon size={19} /><span>{title}</span>{key === 'feedback' && pending > 0 && <span className="count-badge">{pending}</span>}</button>)}</nav><div className="sidebar-bottom"><a href="/" target="_blank" rel="noreferrer"><ArrowUpRight size={18} /> View portfolio</a><a href="/api/admin/export" download><Download size={18} /> Download JSON backup</a><button onClick={logout}><LogOut size={18} /> Sign out</button></div></aside><main className="admin-main"><header className="admin-topbar"><span><span className="status-dot" /> Doctor workspace</span><div><button className="icon-button" onClick={reload} disabled={Boolean(busy)} aria-label="Refresh dashboard"><RefreshCw size={18} /></button><span className="admin-avatar">{content?.profile.initials || 'KS'}</span></div></header><div className="admin-content"><div className="admin-heading"><div><span className="eyebrow">MAKE IT YOURS</span><h1>{tab === 'profile' ? 'Your story, in your words.' : tab === 'feedback' ? 'A space for patient voices.' : collections[tab].title}</h1><p>{tab === 'profile' ? 'Keep your introduction and contact details up to date.' : tab === 'feedback' ? 'Review each submission before it appears on your public portfolio.' : collections[tab].subtitle}</p></div>{tab !== 'feedback' && <button className="button primary" onClick={save} disabled={!dirty || Boolean(busy)}><Save size={17} />{busy === 'save' ? 'Saving…' : 'Save changes'}</button>}</div>{notice && <div className={`notice ${notice.error ? 'notice-error' : ''}`} role={notice.error ? 'alert' : 'status'}><span>{notice.text}</span><button className="icon-button" onClick={() => setNotice(null)} aria-label="Dismiss message"><X size={16} /></button></div>}{!content ? <div className="admin-panel"><p>Unable to load your details.</p><button className="button secondary" onClick={reload}>Try again</button></div> : <>{dirty && <div className="unsaved-note"><span className="unsaved-dot" /> You have unsaved changes.</div>}{tab === 'profile' && <div className="admin-panel"><div className="panel-heading"><span className="feature-icon green"><UserRound size={22} /></span><div><h2>Profile & website content</h2><p>All changes appear on the website after you save.</p></div></div><div className="admin-info"><ShieldCheck size={18} /><span>Verify your council registration renewal before publishing. Update the registration note only after confirmation.</span></div><fieldset className="editor-fields" disabled={busy === 'save'}><div className="form-grid">{profileFields.map(field => <Field key={field[0]} field={field} value={content.profile[field[0]]} onChange={editProfile} />)}</div></fieldset></div>}{collections[tab] && <><fieldset className="editor-fields" disabled={busy === 'save'}>{content[tab].map((item, index) => <div className="admin-panel collection-panel" key={item.id}><div className="collection-heading"><h2><span className="collection-number">{String(index + 1).padStart(2, '0')}</span>{item.role || item.degree || item.title || 'New entry'}</h2><div className="collection-actions"><button className="small-button" onClick={() => moveItem(index, -1)} disabled={index === 0} aria-label="Move entry up">↑</button><button className="small-button" onClick={() => moveItem(index, 1)} disabled={index === content[tab].length - 1} aria-label="Move entry down">↓</button><button className="icon-button danger" onClick={() => removeItem(item.id)} aria-label="Remove entry"><Trash2 size={17} /></button></div></div><div className="form-grid">{collections[tab].fields.map(field => <Field key={field[0]} field={field} value={item[field[0]]} onChange={(key, value) => editCollection(item.id, key, value)} />)}</div></div>)}</fieldset><button className="add-entry" onClick={addItem} disabled={Boolean(busy) || content[tab].length >= 30}><Plus size={19} /> Add {tab === 'experience' ? 'experience' : tab === 'education' ? 'education' : 'focus area'}</button></>}{tab === 'feedback' && <><div className="feedback-stats">{[['pending', 'Awaiting review'], ['approved', 'Published'], ['rejected', 'Not published']].map(([status, title]) => <button key={status} onClick={() => setFilter(status)} className={filter === status ? 'selected' : ''}><span>{title}</span><strong>{feedback.filter(r => r.status === status).length}</strong></button>)}</div><div className="filter-tabs" aria-label="Filter feedback">{['pending', 'approved', 'rejected', 'all'].map(status => <button className={filter === status ? 'active' : ''} key={status} onClick={() => setFilter(status)}>{status === 'all' ? 'All feedback' : status[0].toUpperCase() + status.slice(1)}</button>)}</div>{feedback.filter(r => filter === 'all' || r.status === filter).length === 0 && <div className="admin-empty"><MessageCircle size={38} /><h2>No {filter === 'all' ? '' : filter} feedback yet.</h2><p>New submissions will arrive here, ready for your review.</p></div>}{feedback.filter(r => filter === 'all' || r.status === filter).map(review => <article className="admin-panel moderation-card" key={review.id}><div className="moderation-heading"><div className="review-author"><span className="avatar-small">{review.name.slice(0, 1).toUpperCase()}</span><div><strong>{review.name}</strong><small>{formatDate(review.createdAt)}{review.email && <> · <a href={`mailto:${review.email}`}>{review.email}</a> (private)</>}</small></div></div><span className={`moderation-status ${review.status}`}>{review.status}</span></div><Stars rating={review.rating} /><p className="moderation-message">{review.message}</p><div className="moderation-actions">{review.status !== 'approved' && <button className="button primary small" onClick={() => moderate(review.id, 'approved')} disabled={Boolean(busy)}><Check size={16} /> Approve & publish</button>}{review.status !== 'rejected' && <button className="button secondary small" onClick={() => moderate(review.id, 'rejected')} disabled={Boolean(busy)}><X size={16} />{review.status === 'approved' ? 'Unpublish' : 'Reject'}</button>}{review.status === 'rejected' && <button className="button secondary small" onClick={() => moderate(review.id, 'pending')} disabled={Boolean(busy)}>Return to pending</button>}<button className="icon-button danger delete-review" onClick={() => moderate(review.id, 'delete')} disabled={Boolean(busy)} aria-label="Delete feedback"><Trash2 size={18} /></button></div></article>)}</>}</>}</div><footer className="admin-footer"><ShieldCheck size={14} /> Your changes are stored securely as JSON.</footer></main></div>;
}

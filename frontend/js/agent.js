const AGENT_TOKEN = 'securelife_agent_token';
const AGENT_USER = 'securelife_agent_user';
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
const formatDate = (value) => new Intl.DateTimeFormat('en-LK', { dateStyle:'medium', timeStyle:'short' }).format(new Date(value));

async function request(path, options = {}) {
  const token = sessionStorage.getItem(AGENT_TOKEN);
  const response = await fetch(`/api${path}`, { ...options, headers:{ ...(options.body ? { 'Content-Type':'application/json' } : {}), ...(token ? { Authorization:`Bearer ${token}` } : {}), ...options.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Request failed.');
  return data;
}
function toast(message, error = false) { const el=document.createElement('div'); el.className=`toast ${error?'error':''}`; el.textContent=message; $('#toast-zone').append(el); setTimeout(()=>el.remove(),4000); }
function setView(signedIn) { $('#agent-login-panel').classList.toggle('hidden',signedIn); $('#agent-dashboard').classList.toggle('hidden',!signedIn); $('#agent-logout').classList.toggle('hidden',!signedIn); if(signedIn){const agent=JSON.parse(sessionStorage.getItem(AGENT_USER)||'{}');$('#agent-welcome').textContent=`Signed in as ${agent.fullName||'Claims Agent'}`;loadNotifications();} }

$('#agent-login-form').addEventListener('submit',async(event)=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('button');button.disabled=true;try{const result=await request('/agent/login',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});sessionStorage.setItem(AGENT_TOKEN,result.token);sessionStorage.setItem(AGENT_USER,JSON.stringify(result.agent));setView(true);}catch(error){const alert=$('#agent-alert');alert.textContent=error.message;alert.className='alert error';}finally{button.disabled=false;}});
$('#agent-logout').addEventListener('click',()=>{sessionStorage.removeItem(AGENT_TOKEN);sessionStorage.removeItem(AGENT_USER);setView(false);});
$('#refresh-agent').addEventListener('click',loadNotifications);

async function loadPhoto(photoId,img){try{const response=await fetch(`/api/accident-photos/${photoId}`,{headers:{Authorization:`Bearer ${sessionStorage.getItem(AGENT_TOKEN)}`}});if(response.ok)img.src=URL.createObjectURL(await response.blob());}catch{img.remove();}}
async function loadNotifications(){const list=$('#agent-notifications');list.innerHTML='<div class="empty">Loading notifications…</div>';try{const rows=await request('/agent/notifications');list.innerHTML=rows.length?rows.map((n)=>`<article class="agent-card"><div class="record-head"><div><span class="reference">${escapeHtml(n.reference_number)}</span><h2>${escapeHtml(n.registration_number)} · ${escapeHtml(n.incident_type)}</h2></div><span class="status-pill ${n.status.toLowerCase().replaceAll(' ','-')}">${escapeHtml(n.status)}</span></div><div class="agent-card-grid"><div><b>Customer</b>${escapeHtml(n.full_name)}<br>${escapeHtml(n.email)}<br>${escapeHtml(n.contact_number)}</div><div><b>Vehicle</b>${escapeHtml(n.vehicle_type)}<br>${escapeHtml(n.registration_number)}</div><div><b>Incident</b>${formatDate(n.incident_at)}<br>${escapeHtml(n.accident_location)}</div></div><p>${escapeHtml(n.description)}</p>${n.photos.length?`<h3>Accident photos</h3><div class="agent-photos">${n.photos.map(p=>`<img data-photo-id="${p.id}" alt="${escapeHtml(p.original_name)}">`).join('')}</div>`:''}<form class="status-form" data-id="${n.id}"><select name="status" required>${['Pending','Under Review','Agent Contacted','Processing','Approved','Rejected','Closed'].map(s=>`<option ${s===n.status?'selected':''}>${s}</option>`).join('')}</select><input name="note" maxlength="500" placeholder="Status note (optional)"><button class="btn btn-primary" type="submit">Update status</button></form></article>`).join(''):'<div class="empty">No accident notifications have been submitted.</div>';list.querySelectorAll('img[data-photo-id]').forEach(img=>loadPhoto(img.dataset.photoId,img));list.querySelectorAll('.status-form').forEach(form=>form.addEventListener('submit',updateStatus));}catch(error){list.innerHTML=`<div class="empty">${escapeHtml(error.message)}</div>`;}}
async function updateStatus(event){event.preventDefault();const form=event.currentTarget,button=form.querySelector('button');button.disabled=true;try{const data=Object.fromEntries(new FormData(form));const result=await request(`/agent/notifications/${form.dataset.id}/status`,{method:'PATCH',body:JSON.stringify(data)});toast(result.message);await loadNotifications();}catch(error){toast(error.message,true);}finally{button.disabled=false;}}

setView(Boolean(sessionStorage.getItem(AGENT_TOKEN)));

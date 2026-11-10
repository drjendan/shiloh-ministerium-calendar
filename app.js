(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const config = window.SHILOH_CONFIG || {};
  const ready = !!(window.supabase && config.supabaseUrl?.startsWith('https://') && config.supabaseAnonKey && !config.supabaseAnonKey.includes('YOUR_'));
  const db = ready ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey) : null;
  const categories = ['All','Worship','Meetings','Outreach','Training','Other'];
  const today = new Date();
  let month = new Date(today.getFullYear(), today.getMonth(), 1);
  let filter = 'All', events = [], session = null, isAdmin = false, isOwner = false, adminDirectory = [];
  const pad = n => String(n).padStart(2,'0');
  const dateKey = d => [d.getFullYear(),pad(d.getMonth()+1),pad(d.getDate())].join('-');
  const esc = x => String(x ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  const readable = d => new Date(d+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  const prettyTime = t => t ? new Date('2000-01-01T'+t).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}) : '';
  const errorText = e => (e?.message || 'An unexpected error occurred. Please try again.');
  const notify = (message, kind = '') => {
    $('status').textContent = message; $('status').className = 'status'+(kind?' '+kind:''); $('status').hidden = false;
  };
  const clearNotice = () => { $('status').hidden = true; };
  const showModal = (title, html) => {
    $('modalTitle').textContent = title; $('modalBody').innerHTML = html; $('overlay').hidden = false;
    $('closeModal').focus();
  };
  const closeModal = () => { $('overlay').hidden = true; };
  function applyAccess() {
    $('adminBar').hidden = !isAdmin;
    $('adminUsersBtn').hidden = !isOwner;
    $('userBadge').hidden = !session;
    $('userBadge').textContent = session?.user?.email || '';
    $('loginBtn').textContent = session ? 'Sign Out' : 'Admin Login';
  }
  async function fetchEvents() {
    if (!db) return;
    const {data,error} = await db.from('calendar_events')
      .select('id,title,event_date,start_time,end_time,category,location,description,published')
      .order('event_date',{ascending:true}).order('start_time',{ascending:true});
    if (error) {notify('Unable to load calendar events: '+errorText(error),'error');return;}
    events = data || []; render();
  }
  async function refreshAuth() {
    if (!db) {applyAccess();return;}
    const {data:{session:s},error} = await db.auth.getSession();
    if (error) notify(errorText(error),'error');
    session = s; isAdmin = false; isOwner = false;
    if (session) {
      const [a,o] = await Promise.all([db.rpc('calendar_is_admin'),db.rpc('calendar_is_owner')]);
      if (a.error || o.error) notify('Unable to verify administrator access.','error');
      isAdmin = a.data === true && !a.error;
      isOwner = o.data === true && !o.error;
      if (!isAdmin) notify('This email account is not authorized to administer the Ministerium calendar.','error');
    }
    applyAccess();await fetchEvents();
  }
  async function doLogin() {
    if (!db) {notify('Administrator login requires the Supabase configuration to be completed.','error');return;}
    showModal('Administrator Login', '<p>Authorized administrators can sign in using their own email address. No shared email account is required.</p><form id="loginForm"><label class="field" for="email">Administrator email</label><input class="fieldinput" id="email" type="email" autocomplete="email" required placeholder="name@example.com"><p>We will email a secure sign-in link to you.</p><div class="form-error" id="loginError" role="alert"></div><div class="actions"><button type="button" id="cancelLogin" class="btn">Cancel</button><button type="submit" id="sendLogin" class="btn primary">Email Sign-In Link</button></div></form>');
    $('cancelLogin').onclick = closeModal;
    $('loginForm').onsubmit = async ev => {
      ev.preventDefault();
      $('loginError').textContent = ''; $('sendLogin').disabled = true;
      const email = $('email').value.trim().toLowerCase();
      // Only pre-provisioned authentication users may request a sign-in link.
      const {error} = await db.auth.signInWithOtp({email, options:{shouldCreateUser:false,emailRedirectTo:location.origin+location.pathname}});
      $('sendLogin').disabled = false;
      if(error){$('loginError').textContent = errorText(error);return;}
      closeModal();notify('If this address has been registered, a secure sign-in link has been sent.','success');
    };
  }
  function showDetails(id) {
    const e=events.find(x=>x.id===id); if(!e)return;
    showModal(e.title, '<p><strong>'+esc(readable(e.event_date))+'</strong><br>'+esc(prettyTime(e.start_time))+(e.end_time?' – '+esc(prettyTime(e.end_time)):'')+' · '+esc(e.category)+'</p><p>📍 '+esc(e.location||'Location to be announced')+'</p><p>'+esc(e.description||'No additional details.')+'</p>'+(isAdmin?'<p><small>'+ (e.published?'Published':'Unpublished draft') +'</small></p>':'')+'<div class="actions"><button id="closeDetails" class="btn">Close</button>'+(isAdmin?'<button id="editEvent" class="btn primary">Edit</button><button id="deleteEvent" class="btn">Delete</button>':'')+'</div>');
    $('closeDetails').onclick=closeModal;
    if(isAdmin) {
      $('editEvent').onclick=()=>showEventForm(id);
      $('deleteEvent').onclick=async()=>{
        if(!confirm('Delete this event? This cannot be undone.'))return;
        const {error}=await db.from('calendar_events').delete().eq('id',id);
        if(error){notify('Unable to delete event: '+errorText(error),'error');return;}
        closeModal();await fetchEvents();notify('Event deleted.','success');
      };
    }
  }
  function showEventForm(id) {
    if(!isAdmin)return;
    const e=events.find(x=>x.id===id)||{title:'',event_date:dateKey(today),start_time:'18:00',end_time:'',category:'Meetings',location:'',description:'',published:true};
    const opts=categories.slice(1).map(c=>'<option '+(e.category===c?'selected':'')+'>'+esc(c)+'</option>').join('');
    showModal(id?'Edit Event':'Add Event', '<form id="eventForm"><label class="field" for="title">Event title *</label><input class="fieldinput" id="title" maxlength="120" required value="'+esc(e.title)+'"><label class="field" for="eventDate">Date *</label><input class="fieldinput" id="eventDate" type="date" required value="'+esc(e.event_date)+'"><label class="field" for="startTime">Start time *</label><input class="fieldinput" id="startTime" type="time" required value="'+esc(e.start_time.slice(0,5))+'"><label class="field" for="endTime">End time</label><input class="fieldinput" id="endTime" type="time" value="'+esc((e.end_time||'').slice(0,5))+'"><label class="field" for="category">Category</label><select class="fieldinput" id="category">'+opts+'</select><label class="field" for="location">Location</label><input class="fieldinput" id="location" maxlength="200" value="'+esc(e.location)+'"><label class="field" for="description">Description</label><textarea class="fieldinput" id="description" rows="4" maxlength="3000">'+esc(e.description)+'</textarea><label class="field"><input type="checkbox" id="published" '+(e.published?'checked':'')+'> Publish on public calendar</label><div class="form-error" id="eventError" role="alert"></div><div class="actions"><button type="button" id="cancelEvent" class="btn">Cancel</button><button type="submit" id="saveEvent" class="btn primary">Save Event</button></div></form>');
    $('cancelEvent').onclick=closeModal;
    $('eventForm').onsubmit=async ev=>{
      ev.preventDefault();$('eventError').textContent='';
      const start=$('startTime').value,end=$('endTime').value||null;
      if(end && end<=start){$('eventError').textContent='End time must be after start time.';return;}
      $('saveEvent').disabled=true;
      const payload={title:$('title').value.trim(),event_date:$('eventDate').value,start_time:start,end_time:end,category:$('category').value,location:$('location').value.trim(),description:$('description').value.trim(),published:$('published').checked};
      const res=id?await db.from('calendar_events').update(payload).eq('id',id):await db.from('calendar_events').insert(payload);
      $('saveEvent').disabled=false;
      if(res.error){$('eventError').textContent=errorText(res.error);return;}
      const [y,m]=payload.event_date.split('-').map(Number);
      month=new Date(y,m-1,1);
      closeModal();await fetchEvents();notify(id?'Event updated.':'Event created.','success');
    };
  }
  async function manageAdmins() {
    if(!isOwner)return;
    const {data,error}=await db.from('calendar_admins').select('email,role').order('email');
    if(error){notify('Unable to load administrators: '+errorText(error),'error');return;}
    adminDirectory=data||[];
    showModal('Manage Administrators','<p>Approved administrators can sign in with their own email addresses. For security, the initial owner must register each administrator in Supabase Authentication before they can request a sign-in link.</p><div id="adminList"></div><form id="adminForm"><label class="field" for="newAdmin">Add administrator email</label><input class="fieldinput" type="email" id="newAdmin" required placeholder="minister@example.com"><div class="form-error" id="adminError" role="alert"></div><div class="actions"><button type="submit" class="btn primary">Add Administrator</button></div></form>');
    function list() {
      $('adminList').innerHTML=adminDirectory.map(a=>'<div class="admin-entry"><div>'+esc(a.email)+'<small>'+esc(a.role)+'</small></div>'+(a.role==='admin'?'<button class="btn" data-remove="'+esc(a.email)+'" type="button">Remove</button>':'')+'</div>').join('');
      $('adminList').querySelectorAll('[data-remove]').forEach(btn=>btn.onclick=async()=>{
        const email=btn.dataset.remove;if(!confirm('Remove administrative access for '+email+'?'))return;
        const {error}=await db.from('calendar_admins').delete().eq('email',email).eq('role','admin');
        if(error){$('adminError').textContent=errorText(error);return;}
        adminDirectory=adminDirectory.filter(a=>a.email!==email);list();
      });
    }
    list();
    $('adminForm').onsubmit=async ev=>{
      ev.preventDefault();const email=$('newAdmin').value.trim().toLowerCase();
      const {error}=await db.from('calendar_admins').insert({email,role:'admin'});
      if(error){$('adminError').textContent=errorText(error);return;}
      $('adminError').textContent='';adminDirectory.push({email,role:'admin'});adminDirectory.sort((a,b)=>a.email.localeCompare(b.email));$('newAdmin').value='';list();
      notify('Administrator email added. Provision the corresponding user under Supabase Authentication if not already registered.','success');
    };
  }
  function render() {
    const y=month.getFullYear(),m=month.getMonth();
    $('monthTitle').textContent=month.toLocaleDateString('en-US',{month:'long',year:'numeric'});
    $('filters').innerHTML=categories.map(c=>'<button class="chip '+(filter===c?'active':'')+'" data-filter="'+esc(c)+'" type="button">'+esc(c)+'</button>').join('');
    $('filters').querySelectorAll('button').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;render();});
    const start=new Date(y,m,1).getDay(),daysInMonth=new Date(y,m+1,0).getDate();
    const count=Math.ceil((start+daysInMonth)/7)*7;let html='';
    for(let i=0;i<count;i++){
      const d=new Date(y,m,i-start+1),key=dateKey(d);
      const list=events.filter(e=>e.event_date===key&&(filter==='All'||e.category===filter));
      html+='<div class="day '+(d.getMonth()!==m?'out':'')+' '+(key===dateKey(today)?'today':'')+'"><span class="day-number">'+d.getDate()+'</span>'+list.map(e=>'<button class="event '+esc(e.category.toLowerCase())+'" type="button" data-id="'+esc(e.id)+'" title="'+esc(e.title)+'">'+(isAdmin&&!e.published?'◌ ':'')+esc(e.title)+'</button>').join('')+'</div>';
    }
    $('days').innerHTML=html;
    $('days').querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>showDetails(b.dataset.id));
    const upcoming=events.filter(e=>e.event_date>=dateKey(today)&&(filter==='All'||e.category===filter)).slice(0,6);
    $('upcoming').innerHTML=upcoming.length?upcoming.map(e=>{
      const d=new Date(e.event_date+'T12:00:00');
      return '<article class="upcoming"><div class="date-box"><small>'+d.toLocaleString('en-US',{month:'short'}).toUpperCase()+'</small><strong>'+d.getDate()+'</strong></div><div><h3>'+esc(e.title)+'</h3><p>'+esc(prettyTime(e.start_time))+' · '+esc(e.location||'Location TBA')+'</p><button type="button" data-id="'+esc(e.id)+'">View details</button></div></article>';
    }).join(''):'<p class="empty">No upcoming events in this category.</p>';
    $('upcoming').querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>showDetails(b.dataset.id));
  }
  $('overlay').onclick=e=>{if(e.target===$('overlay'))closeModal();};
  $('closeModal').onclick=closeModal;
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('overlay').hidden)closeModal();});
  $('loginBtn').onclick=async()=>{if(!session)await doLogin();else {await db.auth.signOut();await refreshAuth();notify('Signed out.','success');}};
  $('addBtn').onclick=()=>showEventForm(null);
  $('adminUsersBtn').onclick=manageAdmins;
  $('prevBtn').onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()-1,1);render();};
  $('nextBtn').onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()+1,1);render();};
  $('todayBtn').onclick=()=>{month=new Date(today.getFullYear(),today.getMonth(),1);render();};
  render();
  if(!ready){notify('Calendar service has not been configured yet. Connect Supabase to publish and manage events.');}
  else {
    db.auth.onAuthStateChange((_event,newSession)=>{
      // Queue the refresh after Supabase finishes processing the auth change.
      setTimeout(()=>{if((session?.access_token||null)!==(newSession?.access_token||null))refreshAuth();},0);
    });
    refreshAuth();
  }
})();

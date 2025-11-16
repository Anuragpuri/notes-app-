const STORAGE_KEY = 'notesApp.notes.v2';
const USER_KEY = 'notesApp.user';

let notes = [];
let activeId = null;
let searchTerm = '';
const notesListEl = document.getElementById('notesList');
const newBtn = document.getElementById('newBtn');
const noteTitleEl = document.getElementById('noteTitle');
const noteBodyEl = document.getElementById('noteBody');
const saveBtn = document.getElementById('saveBtn');
const deleteBtn = document.getElementById('deleteBtn');
const notesCountEl = document.getElementById('notesCount');
const lastSavedEl = document.getElementById('lastSaved');
const searchEl = document.getElementById('search');
const toggleListBtn = document.getElementById('toggleListBtn');
const sidebar = document.getElementById('sidebar');
const imgUpload = document.getElementById('imgUpload');

const drawToggle = document.getElementById('drawToggle');
const drawPanel = document.getElementById('drawPanel');
const drawCanvas = document.getElementById('drawCanvas');
const drawClear = document.getElementById('drawClear');
const drawSave = document.getElementById('drawSave');
const drawClose = document.getElementById('drawClose');

const loginToggle = document.getElementById('loginToggle');
const loginModal = document.getElementById('loginModal');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const loginName = document.getElementById('loginName');
const userDisplay = document.getElementById('userDisplay');
const userAvatar = document.getElementById('userAvatar');

let autosaveTimer = null;
let ctx = null;
let drawing = false;
let lastPos = {x:0,y:0};
function loadNotes(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    notes = raw ? JSON.parse(raw) : [];
    console.log('[notes] loaded', notes.length);
  } catch(e) {
    console.error('loadNotes error', e);
    notes = [];
  }
}
function saveNotes(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    console.log('[notes] saved', notes.length);
  }catch(e){
    console.error('saveNotes error', e);
  }
}
function getUser(){ return localStorage.getItem(USER_KEY) || null; }
function setUser(name){
  if(!name) localStorage.removeItem(USER_KEY);
  else localStorage.setItem(USER_KEY, name);
  renderUser();
}
function renderUser(){
  const u = getUser();
  if(userDisplay) userDisplay.textContent = u ? `Hi, ${u}` : 'Not logged in';
  if(loginToggle) loginToggle.textContent = u ? 'Account' : 'Login';
  if(userAvatar) userAvatar.textContent = u && u.length ? u.trim()[0].toUpperCase() : 'A';
}
function stripHtml(html){
  const d = document.createElement('div');
  d.innerHTML = html || '';
  return d.textContent || d.innerText || '';
}
function timeSince(ts){
  if(!ts) return '—';
  const diff = Date.now() - ts;
  const sec = Math.floor(diff/1000);
  if(sec < 60) return sec + 's';
  const min = Math.floor(sec/60);
  if(min < 60) return min + 'm';
  const hr = Math.floor(min/60);
  if(hr < 24) return hr + 'h';
  const d = Math.floor(hr/24);
  return d + 'd';
}
function formatTime(ts){ return ts ? new Date(ts).toLocaleString() : '—'; }
function renderList(){
  const filtered = notes
    .filter(n => (n.title + ' ' + stripHtml(n.body)).toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a,b)=> b.updatedAt - a.updatedAt);

  notesListEl.innerHTML = '';
  if(filtered.length === 0){
    notesListEl.innerHTML = '<li style="padding:10px;color:var(--muted)">No notes</li>';
  } else {
    filtered.forEach(n=>{
      const li = document.createElement('li');
      li.className = 'note-item';
      li.dataset.id = n.id;
      li.innerHTML = `
        <div class="meta">
          <div style="flex:1">
            <div class="title">${escapeHtml(n.title || 'Untitled')}</div>
            <div class="snippet">${escapeHtml(stripHtml(n.body).slice(0,120))}</div>
          </div>
          <div style="margin-left:8px;color:var(--muted);font-size:12px">${timeSince(n.updatedAt)}</div>
        </div>
      `;
      li.addEventListener('click', ()=> openNote(n.id));
      notesListEl.appendChild(li);
    });
  }
  notesCountEl.textContent = `${notes.length} note${notes.length===1?'':'s'}`;
  highlightActive();
}
function highlightActive(){
  [...notesListEl.children].forEach(li=>{
    if(li.dataset.id === String(activeId)){
      li.style.background = '#f7f5ff';
      li.style.borderColor = 'rgba(110,80,220,0.12)';
    } else {
      li.style.background = '';
      li.style.borderColor = '';
    }
  });
}
function escapeHtml(s=''){ return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
function createNote(){
  const note = {
    id: String(Date.now()) + Math.random().toString(36).slice(2,5),
    title: '',
    body: '',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  notes.push(note);
  saveNotes();
  renderList();
  openNote(note.id);
}
function openNote(id){
  const note = notes.find(n=> n.id === id);
  if(!note) return;
  activeId = id;
  noteTitleEl.value = note.title;
  noteBodyEl.innerHTML = note.body || '';
  lastSavedEl.textContent = 'Last saved: ' + formatTime(note.updatedAt);
  if(window.innerWidth <= 800) sidebar.classList.add('hidden-mobile');
  highlightActive();
  console.log('[open] opened', id);
}
function saveActiveNote(){
  if(!activeId){
    createNote();
    return;
  }
  const note = notes.find(n=> n.id === activeId);
  if(!note) return;
  note.title = noteTitleEl.value.trim();
  note.body = noteBodyEl.innerHTML;
  note.updatedAt = Date.now();
  saveNotes();
  renderList();
  lastSavedEl.textContent = 'Last saved: ' + formatTime(note.updatedAt);
  if(saveBtn){
    saveBtn.classList.add('pulse');
    setTimeout(()=> saveBtn.classList.remove('pulse'), 600);
  }
  console.log('[save] saved note', note.id);
}

function deleteActiveNote(){
  if(!activeId) return;
  if(!confirm('Delete this note?')) return;
  notes = notes.filter(n=> n.id !== activeId);
  saveNotes();
  activeId = null;
  noteTitleEl.value = '';
  noteBodyEl.innerHTML = '';
  lastSavedEl.textContent = 'Not saved yet';
  renderList();
  console.log('[delete] deleted note');
}
function scheduleAutoSave(ms=800){
  lastSavedEl.textContent = 'Unsaved changes...';
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(()=>{
    try{ saveActiveNote(); } catch(e){ console.error('autosave failed', e); }
  }, ms);
}
noteBodyEl.addEventListener('input', ()=> {
  scheduleAutoSave();
});
noteBodyEl.addEventListener('paste', (e)=>{
  setTimeout(()=> scheduleAutoSave(500), 50);
});
noteBodyEl.addEventListener('drop', (e)=>{
  e.preventDefault();
  const files = e.dataTransfer.files;
  if(files && files[0]){
    const f = files[0];
    if(f.type.startsWith('image/')){
      const reader = new FileReader();
      reader.onload = (ev)=>{
        const img = document.createElement('img');
        img.src = ev.target.result;
        img.style.maxWidth = '100%';
        img.style.borderRadius = '8px';
        noteBodyEl.appendChild(img);
        scheduleAutoSave(400);
      };
      reader.readAsDataURL(f);
    }
  }
});

const mo = new MutationObserver((mut)=>{
  scheduleAutoSave(600);
});
mo.observe(noteBodyEl, { childList: true, subtree: true, characterData: true });
imgUpload.addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (ev)=>{
    const img = document.createElement('img');
    img.src = ev.target.result;
    img.style.maxWidth = '100%';
    img.style.borderRadius = '8px';
    noteBodyEl.appendChild(img);
    scheduleAutoSave(400);
  };
  reader.readAsDataURL(file);
  imgUpload.value = '';
});
function initCanvas(){
  if(!drawCanvas) return;
  drawCanvas.width = Math.max(400, drawPanel.clientWidth - 24);
  drawCanvas.height = Math.max(200, drawPanel.clientHeight - 80);
  ctx = drawCanvas.getContext('2d');
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#222';
}
drawToggle && drawToggle.addEventListener('click', ()=>{
  drawPanel.classList.toggle('hidden');
  if(!drawPanel.classList.contains('hidden')) initCanvas();
});
drawClear && drawClear.addEventListener('click', ()=> ctx && ctx.clearRect(0,0,drawCanvas.width,drawCanvas.height));
drawClose && drawClose.addEventListener('click', ()=> drawPanel.classList.add('hidden'));
drawSave && drawSave.addEventListener('click', ()=>{
  if(!drawCanvas) return;
  const data = drawCanvas.toDataURL();
  const img = document.createElement('img');
  img.src = data;
  img.style.maxWidth = '100%';
  img.style.borderRadius = '8px';
  noteBodyEl.appendChild(img);
  scheduleAutoSave(200);
  drawPanel.classList.add('hidden');
});
if(drawCanvas){
  drawCanvas.addEventListener('pointerdown', (e)=>{
    drawing = true;
    const r = drawCanvas.getBoundingClientRect();
    lastPos = {x: e.clientX - r.left, y: e.clientY - r.top};
  });
  drawCanvas.addEventListener('pointermove', (e)=>{
    if(!drawing || !ctx) return;
    const r = drawCanvas.getBoundingClientRect();
    const pos = {x: e.clientX - r.left, y: e.clientY - r.top};
    ctx.beginPath();
    ctx.moveTo(lastPos.x, lastPos.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos = pos;
  });
  drawCanvas.addEventListener('pointerup', ()=> drawing = false);
  drawCanvas.addEventListener('pointerleave', ()=> drawing = false);
}


loginToggle && loginToggle.addEventListener('click', ()=>{
  loginModal.classList.toggle('hidden');
  loginName.value = getUser() || '';
});
loginBtn && loginBtn.addEventListener('click', ()=>{
  const name = loginName.value.trim();
  if(!name) return alert('Enter a name');
  setUser(name);
  loginModal.classList.add('hidden');
});
logoutBtn && logoutBtn.addEventListener('click', ()=>{
  if(!confirm('Logout?')) return;
  setUser(null);
  loginModal.classList.add('hidden');
});


newBtn && newBtn.addEventListener('click', createNote);
saveBtn && saveBtn.addEventListener('click', saveActiveNote);
deleteBtn && deleteBtn.addEventListener('click', deleteActiveNote);
toggleListBtn && toggleListBtn.addEventListener('click', ()=> sidebar.classList.toggle('hidden-mobile'));

noteTitleEl && noteTitleEl.addEventListener('input', ()=> scheduleAutoSave());

searchEl && searchEl.addEventListener('input', (e)=> {
  searchTerm = e.target.value || '';
  renderList();
});
// mobile sidebar toggle + overlay
(function(){
  const toggle = document.getElementById('toggleListBtn');
  const sidebar = document.getElementById('sidebar');

  let overlay = document.querySelector('.mobile-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.className = 'mobile-overlay';
    document.body.appendChild(overlay);
  }

  function openSidebar(){
    sidebar.classList.add('open');
    overlay.classList.add('active');
  }
  function closeSidebar(){
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
  }

  toggle.addEventListener('click', ()=>{
    if(window.innerWidth <= 800){
      if(sidebar.classList.contains('open')) closeSidebar();
      else openSidebar();
    } else {
      sidebar.classList.toggle('hidden-mobile');
    }
  });

  overlay.addEventListener('click', closeSidebar);

  window.addEventListener('resize', ()=>{
    if(window.innerWidth > 800){
      closeSidebar();
    }
  });
})();


document.addEventListener('keydown', (e)=>{
  if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's'){
    e.preventDefault();
    saveActiveNote();
  }
  if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n'){
    e.preventDefault();
    createNote();
  }
});

window.addEventListener('beforeunload', (e)=>{
  try {
    if(activeId) saveActiveNote();
  } catch(err){
    console.warn('beforeunload save error', err);
  }
});


(function init(){
  loadNotes();
  renderUser();
  renderList();
  if(notes.length > 0){
    openNote(notes[0].id);
  } else {
    createNote();
  }
  setTimeout(()=> {
    try{ initCanvas(); } catch(e){ console.warn('init canvas error', e); }
  }, 200);
  console.log('App initialized');
})();


const STAT=[
  ['strength','Сила','💪','#fb7185'],
  ['health','Здоровье','♥','#4ade80'],
  ['intellect','Интеллект','◈','#60a5fa'],
  ['discipline','Дисциплина','◎','#fbbf24'],
  ['skills','Навыки','✦','#a78bfa'],
  ['wealth','Финансы','₸','#4de0ff'],
  ['faith','Вера','🕌','#8b5cf6'],
  ['knowledge','Знания','📚','#60a5fb']
];

const RANKS=[
  ['E',1,'#94a3b8','Начинающий охотник'],
  ['D',5,'#4ade80','Уверенный охотник'],
  ['C',10,'#60a5fa','Опытный охотник'],
  ['B',15,'#a78bea','Элитный охотник'],
  ['A',20,'#fbbf24','Мастер'],
  ['S',30,'#f43f5e','Легенда']
];

const seed={
  name:'Охотник',
  streak:0,
  lastDay:'',
  stats:Object.fromEntries(STAT.map(([id])=>[id,0])),
  quests:[
    {id:1,title:'Выпить стакан воды',stat:'health',xp:10,done:false},
    {id:2,title:'Сделать зарядку 10 минут',stat:'strength',xp:15,done:false},
    {id:3,title:'Прочитать 10 страниц',stat:'intellect',xp:15,done:false}
  ],
  tasks:[],
  schedule:[],
  money:[],
  photos:{avatar:null,before:null,after:null}
};

let db=JSON.parse(localStorage.getItem('levelup-data')||'null')||structuredClone(seed);
db.photos??={avatar:null,before:null,after:null};
let modalType='',photoTarget='';

const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

function save(){localStorage.setItem('levelup-data',JSON.stringify(db))}
function today(){return new Date().toISOString().slice(0,10)}
function xp(){return Object.values(db.stats).reduce((a,b)=>a+b,0)}
function level(){return Math.floor(xp()/100)+1}
function rank(){return [...RANKS].reverse().find(r=>level()>=r[1])}

function resetDay(){
  let d=today();
  if(db.lastDay&&db.lastDay!==d){
    let y=new Date(Date.now()-864e5).toISOString().slice(0,10);
    db.streak=db.lastDay===y&&db.quests.some(q=>q.done)?db.streak+1:0;
    db.quests.forEach(q=>q.done=false);
    db.tasks.forEach(q=>q.done=false);
    db.lastDay=d;
    save();
  }
  if(!db.lastDay){
    db.lastDay=d;
    save();
  }
}

function render(){
  resetDay();
  let l=level(), r=rank();
  let inM=db.money.filter(x=>x.type==='income').reduce((a,x)=>a+x.amount,0);
  let outM=db.money.filter(x=>x.type==='expense').reduce((a,x)=>a+x.amount,0);

  $('#dateLabel').textContent=new Intl.DateTimeFormat('ru-RU',{weekday:'long',day:'numeric',month:'long'}).format(new Date());
  $('#heroName').textContent=db.name;
  $('#level').textContent=l;
  $('#xpLabel').textContent=`${xp()%100} / 100 XP`;
  $('#xpBar').style.width=`${xp()%100}%`;
  $('#rankBadge').textContent=r[0];
  $('#rankBadge').style.cssText=`border-color:${r[2]};color:${r[2]};box-shadow:0 0 20px ${r[2]}55`;
  $('#rankText').textContent=r[3];
  $('#streak').textContent=db.streak;
  $('#streakSmall').textContent=db.streak;
  $('#questCount').textContent=`${db.quests.filter(x=>x.done).length} / ${db.quests.length}`;
  $('#balance').textContent=fmt(inM-outM);
  $('#bigBalance').textContent=fmt(inM-outM);
  $('#income').textContent=`Доходы: ${fmt(inM)}`;
  $('#expense').textContent=`Расходы: ${fmt(outM)}`;

  $('#questList').innerHTML=db.quests.length
    ? db.quests.map(q=>item(q,`<span class="tag">${STAT.find(s=>s[0]===q.stat)?.[1]||'Общее'} · +${q.xp} XP</span>`,'quest')).join('')
    : '<p class="item-sub">Квестов пока нет — добавь первый.</p>';

  $('#taskList').innerHTML=db.tasks.length
    ? db.tasks.map(q=>item(q,'<span class="tag">Задача</span>','task')).join('')
    : '<p class="item-sub">Выбери до 3 главных задач.</p>';

  $('#scheduleList').innerHTML=db.schedule.length
    ? db.schedule.sort((a,b)=>a.time.localeCompare(b.time)).map(q=>`<article class="item"><b class="tag">${q.time}</b><div class="item-main"><div class="item-title">${esc(q.title)}</div></div><button class="delete" data-del="schedule" data-id="${q.id}">×</button></article>`).join('')
    : '<p class="item-sub">Запланируй время для важных дел.</p>';

  $('#moneyList').innerHTML=db.money.length
    ? db.money.slice().reverse().map(m=>`<article class="item"><b class="${m.type}">${m.type==='income'?'+':'−'} ${fmt(m.amount)}</b><div class="item-main"><div class="item-title">${esc(m.title)}</div></div><button class="delete" data-del="money" data-id="${m.id}">×</button></article>`).join('')
    : '<p class="item-sub">Добавй доходы и расходы за месяц.</p>';

  $('#statGrid').innerHTML=STAT.map(s=>{
    let v=db.stats[s[0]],lv=Math.floor(v/100)+1;
    return `<article class="stat panel"><div class="stat-head"><b>${s[2]} ${s[1]}</b><span>${lv} ур.</span></div><div class="progress"><i style="width:${v%100}%;background:${s[3]}"></i></div><small>${v%100} / 100 XP</small></article>`
  }).join('');

  renderAscension(r,l);
  renderLibrary();
}

function renderAscension(currentRank, level) {
  const path = $('#rankPath');
  if (!path) return;
  
  path.innerHTML = RANKS.map(([rank, reqLevel, color, name]) => {
    const isActive = level >= reqLevel;
    const isCurrent = currentRank[0] === rank;
    return `
      <div class="rank-step ${isActive ? 'active' : ''} ${isCurrent ? 'current' : ''}">
        <div class="rank-letter" style="color: ${color}">${rank}</div>
        <div class="rank-info">
          <div class="rank-name" style="color: ${isCurrent ? color : 'inherit'}">${name}</div>
          <div class="rank-req">Уровень ${reqLevel}+</div>
        </div>
      </div>
    `;
  }).join('');
  
  $('#characterRank').textContent = currentRank[0];
  $('#characterLevel').textContent = level;
  $('#characterDescription').textContent = currentRank[3];
}

function renderLibrary(){
  const root = $('#libraryList');
  if(!root || typeof LIBRARY === 'undefined') return;
  root.innerHTML = Object.entries(LIBRARY).map(([key,group]) => `
    <article class="panel library-group">
      <div class="library-head">
        <b>${group.title}</b>
        <span>${group.label}</span>
      </div>
      <div>${group.items.slice(0,5).map((item,i) => preset(key,i,item)).join('')}</div>
      ${group.items.length > 5 ? `<button class="show-more" data-show="${key}">Показать все ${group.items.length}</button>` : ''}
    </article>
  `).join('');
}

function preset(group, index, item) {
  return `
    <div class="preset-wrap">
      <div class="preset">
        <span class="preset-title">${esc(item.title)}</span>
        <button data-add-preset="${group}" data-index="${index}">+ Добавить</button>
      </div>
      <details class="preset-details">
        <summary>Подробнее</summary>
        <p><b>Как:</b> ${esc(item.how)}</p>
        <p><b>Зачем:</b> ${esc(item.why)}</p>
        <p><b>Долгосрочно:</b> ${esc(item.long)}</p>
        <small>${esc(item.source)}</small>
      </details>
    </div>
  `;
}

function showGroup(key){
  const group = LIBRARY[key];
  const card = $(`[data-show="${key}"]`)?.closest('.library-group');
  if(!card) return;
  card.querySelector('div:nth-child(2)').innerHTML = group.items.map((item,i) => preset(key,i,item)).join('');
  card.querySelector('[data-show]')?.remove();
}

function item(q, side, type){
  return `
    <article class="item ${q.done?'done':''}">
      <button class="check" data-toggle="${type}" data-id="${q.id}">${q.done?'✓':''}</button>
      <div class="item-main">
        <div class="item-title">${esc(q.title)}</div>
      </div>
      ${side}
      <button class="delete" data-del="${type}" data-id="${q.id}">×</button>
    </article>
  `;
}

function fmt(n){
  return new Intl.NumberFormat('ru-RU').format(n) + ' ₸';
}

function collection(type){
  return {quest: 'quests', task: 'tasks', schedule: 'schedule', money: 'money'}[type];
}

function open(type){
  modalType = type;
  const title = {
    quest: 'Новый квест',
    task: 'Новая задача',
    schedule: 'Событие в расписании',
    money: 'Финансовая операция'
  }[type];
  
  $('#modalTitle').textContent = title;
  let f = '<label>Название<input name="title" required maxlength="60" autofocus></label>';
  
  if(type === 'quest') {
    f += '<label>Характеристика<select name="stat">' + STAT.map(s => `<option value="${s[0]}">${s[1]}</option>`).join('') + '</select></label>';
    f += '<label>Опыт за квест<input name="xp" type="number" min="1" value="15"></label>';
  }
  
  if(type === 'schedule') {
    f = '<label>Время<input name="time" type="time" required value="09:00"></label>' + f;
  }
  
  if(type === 'money') {
    f += '<label>Тип<select name="type"><option value="expense">Расход</option><option value="income">Доход</option></select></label>';
    f += '<label>Сумма, ₸<input name="amount" type="number" min="1" required></label>';
  }
  
  $('#formFields').innerHTML = f;
  $('#modal').showModal();
}

document.addEventListener('click', e => {
  const tab = e.target.closest('[data-page]');
  if(tab) {
    document.querySelectorAll('.tabs button, .page').forEach(x => x.classList.remove('active'));
    tab.classList.add('active');
    $('#' + tab.dataset.page).classList.add('active');
  }
  
  const op = e.target.closest('[data-open]');
  if(op) open(op.dataset.open);
  
  const more = e.target.closest('[data-show]');
  if(more) showGroup(more.dataset.show);
  
  const presetBtn = e.target.closest('[data-add-preset]');
  if(presetBtn) {
    const group = LIBRARY[presetBtn.dataset.addPreset];
    const source = group.items[+presetBtn.dataset.index];
    const list = collection(group.type);
    
    if(db[list].some(x => x.title === source.title)) {
      alert('Этот пункт уже добавлен');
      return;
    }
    
    const item = { id: Date.now(), title: source.title, done: false };
    if(group.type === 'quest') Object.assign(item, { stat: source.stat, xp: 15 });
    db[list].push(item);
    save();
    presetBtn.textContent = 'Добавлено';
    presetBtn.disabled = true;
    render();
  }
  
  const del = e.target.closest('[data-del]');
  if(del) {
    const c = collection(del.dataset.del);
    db[c] = db[c].filter(x => x.id != del.dataset.id);
    save();
    render();
  }
  
  const tog = e.target.closest('[data-toggle]');
  if(tog) {
    const q = db[collection(tog.dataset.toggle)].find(x => x.id == tog.dataset.id);
    q.done = !q.done;
    if(tog.dataset.toggle === 'quest') {
      db.stats[q.stat] += q.done ? q.xp : -q.xp;
    }
    save();
    render();
  }
});

$('#form').addEventListener('submit', e => {
  e.preventDefault();
  const x = Object.fromEntries(new FormData(e.target));
  const obj = { id: Date.now(), title: x.title, done: false };
  
  if(modalType === 'quest') Object.assign(obj, { stat: x.stat, xp: +x.xp });
  if(modalType === 'schedule') obj.time = x.time;
  if(modalType === 'money') Object.assign(obj, { type: x.type, amount: +x.amount });
  
  db[collection(modalType)].push(obj);
  save();
  $('#modal').close();
  render();
});

$('#settingsBtn').onclick = () => {
  $('#nameInput').value = db.name;
  $('#settings').showModal();
};

$('#settingsForm').addEventListener('submit', e => {
  e.preventDefault();
  db.name = $('#nameInput').value.trim() || 'Охотник';
  save();
  $('#settings').close();
  render();
});

$('#resetBtn').onclick = () => {
  if(confirm('Стереть весь прогресс?')) {
    db = structuredClone(seed);
    save();
    $('#settings').close();
    render();
  }
};

if('serviceWorker' in navigator)
  navigator.serviceWorker.register('./sw.js');

render();
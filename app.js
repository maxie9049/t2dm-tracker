/* T2DM Tracker SPA — localStorage only */
const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => [...el.querySelectorAll(sel)];
const storeKey = 't2dm-tracker-v1';

const emptyData = {
  patient: {name:'', age:'', phone:'', email:'', dxDate:'', emergency:'', notes:''},
  glucose: [], // {date, time, value}
  meds: [],    // {name, strength, freq, doc}
  weight: [],  // {date, weight, note}
  food: [],    // {date, meal, items}
  messages: [] // {to, priority, body, ts}
};

let data = load();

function save(){ localStorage.setItem(storeKey, JSON.stringify(data)); }
function load(){
  try{ return JSON.parse(localStorage.getItem(storeKey)) || structuredClone(emptyData); }
  catch(e){ return structuredClone(emptyData); }
}

function init(){
  $('#yr').textContent = new Date().getFullYear();

  // Tabs
  const navBtns = $$('.navbtn');
  navBtns.forEach(btn => btn.addEventListener('click', () => showTab(btn.dataset.tab)));
  showTab('patient');

  // Patient form
  const pf = $('#patientForm');
  Object.entries(data.patient).forEach(([k,v]) => { if(pf[k]) pf[k].value = v; });
  pf.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(pf);
    data.patient = Object.fromEntries(fd.entries());
    save();
    $('#patientSaved').textContent = 'Saved ✓';
    setTimeout(()=>$('#patientSaved').textContent='',1500);
  });

  // Glucose
  $('#glucoseForm').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const entry = {date:fd.get('date'), time:fd.get('time'), value: Number(fd.get('value'))};
    const sameDay = data.glucose.filter(r=>r.date===entry.date);
    if(sameDay.length>=4){ alert('Limit is 4 readings per day.'); return; }
    data.glucose.push(entry);
    save(); renderGlucose();
    e.target.reset();
  });
  renderGlucose();

  // Meds
  $('#medForm').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    data.meds.push({name:fd.get('name'), strength:fd.get('strength'), freq:fd.get('freq'), doc:fd.get('doc')});
    save(); renderMeds(); e.target.reset();
  });
  renderMeds();

  // Weight
  $('#weightForm').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    data.weight.push({date:fd.get('date'), weight:Number(fd.get('weight')), note:fd.get('note')});
    data.weight.sort((a,b)=>a.date.localeCompare(b.date));
    save(); renderWeight(); e.target.reset();
  });
  renderWeight();

  // Food
  $('#foodForm').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    data.food.push({date:fd.get('date'), meal:fd.get('meal'), items:fd.get('items')});
    save(); renderFood(); e.target.reset();
  });
  renderFood();

  // Messages
  $('#msgForm').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    data.messages.unshift({to:fd.get('to'), priority:fd.get('priority'), body:fd.get('body'), ts:Date.now()});
    save(); renderMessages(); e.target.reset();
  });
  renderMessages();

  // Export/Import
  $('#btnExport').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 't2dm-tracker-backup.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });
  $('#btnImport').addEventListener('click', ()=> $('#importFile').click());
  $('#importFile').addEventListener('change', async (e)=>{
    const file = e.target.files[0]; if(!file) return;
    const text = await file.text();
    try{ data = JSON.parse(text); save(); location.reload(); }
    catch(e){ alert('Invalid JSON'); }
  });
  $('#btnReset').addEventListener('click', ()=>{
    if(confirm('Delete all data in this browser?')){ localStorage.removeItem(storeKey); data = structuredClone(emptyData); location.reload(); }
  });
}

function showTab(name){
  $$('.tab').forEach(s=>s.classList.add('hidden'));
  $('#tab-'+name).classList.remove('hidden');
  $$('.navbtn').forEach(b=>b.setAttribute('aria-current', b.dataset.tab===name ? 'page' : 'false'));
}

// ---------------- Renders ----------------
let glucoseChart, weightChart;

function renderGlucose(){
  const list = $('#glucoseList'); list.innerHTML='';
  const items = [...data.glucose].sort((a,b)=> (a.date===b.date? order(a.time)-order(b.time) : a.date.localeCompare(b.date)));
  items.forEach((r,i)=>{
    const color = glucoseColor(r);
    const row = document.createElement('div');
    row.className = 'flex items-center justify-between bg-white border rounded p-2';
    row.innerHTML = `<div class="flex gap-3"><span class="pill" style="background:${color.bg};border:1px solid ${color.border};">${r.time}</span>
      <span class="font-medium">${r.value} mg/dL</span><span class="text-gray-500">${r.date}</span></div>
      <button class="text-red-600 text-sm">Delete</button>`;
    row.querySelector('button').addEventListener('click', ()=>{ data.glucose.splice(data.glucose.indexOf(r),1); save(); renderGlucose(); });
    list.appendChild(row);
  });

  // Chart
  const ctx = $('#glucoseChart');
  const labels = items.map(r=> `${r.date} ${short(r.time)}`);
  const values = items.map(r=> r.value);
  if(glucoseChart){ glucoseChart.destroy(); }
  glucoseChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label:'mg/dL', data: values, tension:.25, pointRadius:4 }]},
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}} }
  });
}
function order(t){
  return ['Fasting','Before Lunch','Before Dinner','Bedtime'].indexOf(t);
}
function short(t){
  return { 'Fasting':'AM', 'Before Lunch':'Noon', 'Before Dinner':'PM', 'Bedtime':'HS' }[t] || t;
}
function glucoseColor(r){
  // green normal ranges; simplistic thresholds
  if(r.time==='Fasting'){
    if(r.value<=99 && r.value>=80) return {bg:'rgba(16,185,129,.15)', border:'rgba(16,185,129,.5)'}; // green
  } else {
    if(r.value<140) return {bg:'rgba(16,185,129,.15)', border:'rgba(16,185,129,.5)'};
  }
  if(r.value<200) return {bg:'rgba(234,179,8,.15)', border:'rgba(234,179,8,.5)'}; // yellow
  return {bg:'rgba(239,68,68,.15)', border:'rgba(239,68,68,.5)'}; // red
}

function renderMeds(){
  const list = $('#medList'); list.innerHTML='';
  data.meds.forEach((m)=>{
    const card = document.createElement('div');
    card.className='bg-white border rounded p-3 flex items-center justify-between';
    card.innerHTML = `<div><div class="font-medium">${m.name}</div><div class="text-sm text-gray-600">${m.strength || ''} · ${m.freq || ''} ${m.doc? '· '+m.doc:''}</div></div>
      <div class="flex gap-3"><button class="text-red-600 text-sm">Delete</button></div>`;
    card.querySelector('button').addEventListener('click', ()=>{ data.meds.splice(data.meds.indexOf(m),1); save(); renderMeds(); });
    list.appendChild(card);
  });
}

function renderWeight(){
  const list = $('#weightList'); list.innerHTML='';
  const items = [...data.weight];
  items.forEach(w=>{
    const row = document.createElement('div');
    row.className = 'flex items-center justify-between bg-white border rounded p-2';
    row.innerHTML = `<div><span class="font-medium">${w.weight} lb</span> <span class="text-gray-500">${w.date}</span> ${w.note? '· '+w.note:''}</div>
      <button class="text-red-600 text-sm">Delete</button>`;
    row.querySelector('button').addEventListener('click', ()=>{ data.weight.splice(data.weight.indexOf(w),1); save(); renderWeight(); });
    list.appendChild(row);
  });

  // Chart
  const ctx = $('#weightChart');
  const labels = items.map(w=> w.date);
  const values = items.map(w=> w.weight);
  if(weightChart){ weightChart.destroy(); }
  weightChart = new Chart(ctx, {
    type:'line',
    data:{ labels, datasets:[{ label:'Weight (lb)', data: values, tension:.25, pointRadius:4 }]},
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}} }
  });
}

function renderFood(){
  const list = $('#foodList'); list.innerHTML='';
  const items = [...data.food].sort((a,b)=> a.date.localeCompare(b.date));
  items.forEach(f=>{
    const row = document.createElement('div');
    row.className='bg-white border rounded p-2 flex items-center justify-between';
    row.innerHTML = `<div><span class="pill bg-gray-100 border border-gray-300">${f.meal}</span> <span class="text-gray-700">${f.items}</span> <span class="text-gray-500">${f.date}</span></div>
      <button class="text-red-600 text-sm">Delete</button>`;
    row.querySelector('button').addEventListener('click', ()=>{ data.food.splice(data.food.indexOf(f),1); save(); renderFood(); });
    list.appendChild(row);
  });
}

function renderMessages(){
  const list = $('#msgList'); list.innerHTML='';
  data.messages.forEach(msg=>{
    const row = document.createElement('div');
    const color = msg.priority==='emergency'?'border-red-300 bg-red-50':
                  msg.priority==='urgent'?'border-yellow-300 bg-yellow-50':'border-gray-200 bg-white';
    row.className = `border ${color} rounded p-3`;
    const dt = new Date(msg.ts);
    row.innerHTML = `<div class="text-sm text-gray-600">${dt.toLocaleString()} · to <strong>${msg.to}</strong> · ${msg.priority}</div>
                     <div class="mt-1">${msg.body}</div>`;
    list.appendChild(row);
  });
}

document.addEventListener('DOMContentLoaded', init);


/* =========================================================
   DEMONSTRAÇÃO FRONT-END
   Para produção: substitua localStorage por API + banco de dados,
   hash de senhas no servidor, sessão segura e autorização RBAC.
   ========================================================= */
const MANAGERS = [
 "antoniodanielferreiraalencar@gmail.com",
 "airtongleisson@gmail.com","thyagosilvalima664@gmail.com",
 "gabrielribeirolima667@gmail.com","joaovenanciotexeira7@gmail.com","thcontaparaafiliacao@gmail.com"
];
const MANAGER_NAMES = {
 "antoniodanielferreiraalencar@gmail.com": "Daniel",
 "airtongleisson@gmail.com": "Airton Gleisson",
 "thyagosilvalima664@gmail.com": "Thyago",
 "gabrielribeirolima667@gmail.com": "Gabriel",
 "joaovenanciotexeira7@gmail.com": "João Venâncio",
 "thcontaparaafiliacao@gmail.com": "Nivel Tech"
};
const SESSION_KEYS = { client: "niveltech_session_client", manager: "niveltech_session_manager" };
const WHATSAPP_PHONE="5585988730484";
const KEY="niveltech_demo_v1";
const QUICK_REPLY_TEMPLATES=[
 {label:"Recebemos o pedido", text:"Recebemos seu pedido e vamos confirmar os próximos passos em breve."},
 {label:"Detalhes do projeto", text:"Gostaria de confirmar alguns detalhes do seu projeto para dar andamento ao pedido."},
 {label:"Prazo", text:"Seu pedido foi recebido com sucesso. Vamos validar o prazo e te atualizar em seguida."},
 {label:"Pagamento", text:"Tudo certo para seguir com o pagamento. Assim que você confirmar, daremos continuidade."}
];
let db=loadDB(), currentUser=null, managerEmail=null;
function normalizeEmail(value){return String(value !== undefined && value !== null ? value : "").trim().toLowerCase();}
function loadDB(){
 try{
  const parsed = JSON.parse(localStorage.getItem(KEY)) || {users:[],orders:[]};
  parsed.users = Array.isArray(parsed.users) ? parsed.users : [];
  parsed.orders = Array.isArray(parsed.orders) ? parsed.orders : [];
  parsed.orders.forEach(order => {
   order.chat = Array.isArray(order.chat) ? order.chat : [];
   order.paymentHistory = Array.isArray(order.paymentHistory) ? order.paymentHistory : [];
   order.userEmail = normalizeEmail(order.userEmail || order.email);
   order.email = normalizeEmail(order.email || order.userEmail);
  });
  return parsed;
 }catch(e){return {users:[],orders:[]}}
}
function orderBelongsToUser(order, userEmail){
  const target = normalizeEmail(userEmail);
  if(!target || !order) return false;
  return [order.userEmail, order.email, order.clientEmail].some(value => normalizeEmail(value) === target);
}
function refreshDBFromStorage(){
 db=loadDB();
 if(currentUser && !db.users.some(u => normalizeEmail(u.email) === normalizeEmail(currentUser))){currentUser=null;}
 if(managerEmail && !MANAGERS.includes(managerEmail)){managerEmail=null;}
}
function saveSessionState(){
 if(currentUser){localStorage.setItem(SESSION_KEYS.client,currentUser);}else{localStorage.removeItem(SESSION_KEYS.client);}
 if(managerEmail){localStorage.setItem(SESSION_KEYS.manager,managerEmail);}else{localStorage.removeItem(SESSION_KEYS.manager);}
}
function restoreSessionState(){
 const savedClient=localStorage.getItem(SESSION_KEYS.client);
 const savedManager=localStorage.getItem(SESSION_KEYS.manager);
 if(savedClient && db.users.some(u => normalizeEmail(u.email) === normalizeEmail(savedClient))){currentUser=savedClient;}
 if(savedManager && MANAGERS.includes(savedManager)){managerEmail=savedManager;}
}
function saveDB(){
 db.users = Array.isArray(db.users) ? db.users : [];
 db.orders = Array.isArray(db.orders) ? db.orders : [];
 db.orders.forEach(order => {
  order.chat = Array.isArray(order.chat) ? order.chat : [];
  order.paymentHistory = Array.isArray(order.paymentHistory) ? order.paymentHistory : [];
  order.userEmail = normalizeEmail(order.userEmail || order.email);
  order.email = normalizeEmail(order.email || order.userEmail);
 });
 localStorage.setItem(KEY,JSON.stringify(db));
 refreshDBFromStorage();
 saveSessionState();
 if (document.getElementById("managerView") && !document.getElementById("managerView").classList.contains("hidden")) {
  renderManager();
 }
 if (document.getElementById("clientView") && !document.getElementById("clientView").classList.contains("hidden")) {
  renderClient();
 }
 window.dispatchEvent(new CustomEvent("niveltech:db-updated"));
}
function money(v){return Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
function brandLogoSrc(){return "file:///d:/Empresa/logo-nivel-tech.png"}
function receiptLogoSrc(){return brandLogoSrc()}
function date(v){if(!v)return "—";return new Date(v+"T12:00:00").toLocaleDateString("pt-BR")}
function addDays(d,n){let x=new Date(d+"T12:00:00");x.setDate(x.getDate()+Number(n));return x.toISOString().slice(0,10)}
function today(){return new Date().toISOString().slice(0,10)}
function toast(msg){let root=document.getElementById("toastRoot");root.innerHTML='<div class="toast">'+escapeHTML(msg)+'</div>';setTimeout(()=>root.innerHTML="",3400)}
function escapeHTML(s){return String(s !== undefined && s !== null ? s : "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function whatsAppUrl(message){return "https://wa.me/"+WHATSAPP_PHONE+"?text="+encodeURIComponent(message)}
function orderWhatsAppMessage(order){
 let valor = Number(order.price || 0);
 let valorTexto = valor > 0 ? ` Valor do projeto: ${money(valor)}.` : "";
 return `Olá! Acabei de enviar o pedido ${order.id} para ${order.company} (${order.type})${valorTexto} Quero conversar sobre o pagamento e os próximos passos.`;
}
function getOrderPayments(order){
 if(!order) return [];
 if(Array.isArray(order.paymentHistory)) return order.paymentHistory;
 return [];
}
function getOrderReceived(order){
 if(!order) return 0;
 let payments = getOrderPayments(order);
 if(payments.length){
  return payments.reduce((sum,p)=>sum + Number(p.amount || 0), 0);
 }
 return Number(order.received || 0);
}
function formatPaymentHistory(order){
 return getOrderPayments(order).slice().sort((a,b)=>new Date(b.date||b.created||b.createdAt||today())-new Date(a.date||a.created||a.createdAt||today())).map(p=>`<li><strong>${money(p.amount)}</strong> · ${date(p.date || today())}${p.note?` · ${escapeHTML(p.note)}`:""}</li>`).join("");
}
function downloadPaymentReceipt(order, payment){
 if(!order) return toast("Pedido não encontrado para gerar o recibo.");
 let entry = payment || getOrderPayments(order).slice().sort((a,b)=>new Date(b.date||today())-new Date(a.date||today()))[0];
 if(!entry){return toast("Nenhum pagamento registrado para gerar o recibo.");}
 let receiptNumber = `RCB-${String(order.id).replace(/[^0-9]/g,"").slice(-6) || Date.now().toString().slice(-6)}`;
 let html=`<!DOCTYPE html>
 <html lang="pt-BR">
 <head>
   <meta charset="UTF-8" />
   <title>Recibo de pagamento - ${escapeHTML(order.id)}</title>
   <style>
     :root{--navy:#07192d;--blue:#0f67de;--cyan:#69d2ff;--ice:#edf6ff;--ink:#11213d;--muted:#63758d;--line:#e3ecf8;--success:#1fa56a}
     *{box-sizing:border-box}
     body{margin:0;background:linear-gradient(135deg,#edf4fb,#f8fbff);font-family:Arial,Helvetica,sans-serif;color:var(--ink);padding:40px}
     .box{max-width:760px;margin:0 auto;background:#fff;border:1px solid var(--line);border-radius:22px;overflow:hidden;box-shadow:0 18px 48px rgba(11,29,54,.12)}
     .top{background:radial-gradient(circle at 15% 15%,rgba(61,201,255,.26),transparent 28%),linear-gradient(135deg,#030d1c 0%,#071b38 25%,#0a3d7a 60%,#0a62cc 100%);color:#fff;padding:28px 32px;position:relative;border-bottom:1px solid rgba(124,201,255,.3)}
     .top:after{content:"";position:absolute;inset:auto 32px 0 auto;width:140px;height:140px;background:radial-gradient(circle,rgba(105,210,255,.42),transparent 66%);border-radius:50%}
     .brand-row{display:flex;align-items:center;justify-content:space-between;gap:20px;position:relative;z-index:1}
     .brand-mark{width:72px;height:72px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#081825,#020b12 55%,#01070d 100%);display:flex;align-items:center;justify-content:center;overflow:hidden;border:2px solid rgba(136,225,255,.72);box-shadow:0 0 0 3px rgba(25,127,255,.28),0 16px 26px rgba(0,0,0,.18)}
     .brand-mark img{display:block;width:100%;height:100%;object-fit:cover;filter:drop-shadow(0 0 12px rgba(73,217,255,.32));background:#020b12}
     .brand{font-size:22px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;margin:0;display:none}
     .brand-badge{display:flex;align-items:center;gap:12px}
     .subtitle{margin:10px 0 0;color:rgba(255,255,255,.8);font-size:14px;letter-spacing:.12em;text-transform:uppercase;position:relative;z-index:1;font-weight:800}
     .badge{display:inline-block;background:linear-gradient(180deg,rgba(255,255,255,.18),rgba(255,255,255,.08));border:1px solid rgba(255,255,255,.26);border-radius:999px;padding:7px 12px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;position:relative;z-index:1;box-shadow:inset 0 0 14px rgba(255,255,255,.08),0 8px 18px rgba(0,0,0,.12)}
     .content{padding:28px 32px 10px}
     .title{font-size:27px;font-weight:900;margin:0 0 18px;color:var(--ink);letter-spacing:-.04em}
     .kicker{color:var(--muted);font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;margin:0 0 12px}
     .meta{display:grid;grid-template-columns:repeat(2,minmax(180px,1fr));gap:10px 20px;margin:8px 0 18px;padding:14px 16px;border:1px solid var(--line);border-radius:12px;background:#f8fbff}
     .meta-item{display:flex;flex-direction:column;gap:4px}
     .meta-label{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:800}
     .meta-value{font-size:14px;color:var(--ink);font-weight:700}
     .row{display:flex;justify-content:space-between;gap:18px;padding:12px 0;border-bottom:1px solid #edf2f7}
     .label{color:var(--muted);font-weight:700}
     .value{color:var(--ink);text-align:right;max-width:62%}
     .value strong{font-weight:800}
     .total{margin-top:20px;padding:18px 20px;border-radius:12px;background:linear-gradient(135deg,#eef7ff,#f6fbff);border:1px solid #d9ebff;font-size:18px;font-weight:900;color:#0a5ac7}
     .signatures{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:26px;padding-top:18px;border-top:1px solid var(--line)}
     .signature{padding-top:18px;border-top:2px solid #adc9f0;font-size:12px;color:var(--muted);font-weight:700;letter-spacing:.08em;text-transform:uppercase}
     .footer{padding:0 32px 28px;color:#60708b;font-size:12px;line-height:1.6}
     @media print{body{background:#fff;padding:0}.box{box-shadow:none;border:none;border-radius:0}} 
   </style>
 </head>
 <body>
   <div class="box">
     <div class="top">
       <div class="brand-row">
         <div class="brand-badge">
           <div class="brand-mark"><img src="${receiptLogoSrc()}" alt="Logo Nivel Tech" /></div>
         </div>
         <div class="badge">Recibo oficial</div>
       </div>
       <p class="subtitle">Recibo de pagamento · ${escapeHTML(receiptNumber)}</p>
     </div>
     <div class="content">
       <p class="kicker">Comprovante de recebimento</p>
       <h1 class="title">Pagamento confirmado</h1>
       <div class="meta">
         <div class="meta-item"><span class="meta-label">Empresa</span><span class="meta-value">Nivel Tech</span></div>
         <div class="meta-item"><span class="meta-label">Contato</span><span class="meta-value">+55 (85) 98873-0484</span></div>
         <div class="meta-item"><span class="meta-label">CNPJ</span><span class="meta-value">00.000.000/0000-00</span></div>
         <div class="meta-item"><span class="meta-label">Data de emissão</span><span class="meta-value">${date(today())}</span></div>
       </div>
       <div class="row"><span class="label">Pedido</span><span class="value"><strong>${escapeHTML(order.id)}</strong></span></div>
       <div class="row"><span class="label">Cliente</span><span class="value">${escapeHTML(order.client || order.email || "Cliente")}</span></div>
       <div class="row"><span class="label">Projeto</span><span class="value">${escapeHTML(order.company || order.type || "Projeto")}</span></div>
       <div class="row"><span class="label">Data do pagamento</span><span class="value">${date(entry.date || today())}</span></div>
       <div class="row"><span class="label">Valor recebido</span><span class="value"><strong>${money(entry.amount || 0)}</strong></span></div>
       <div class="row"><span class="label">Observação</span><span class="value">${escapeHTML(entry.note || "—")}</span></div>
       <div class="total">Total recebido no pedido: ${money(getOrderReceived(order))}</div>
       <div class="signatures">
         <div><div class="signature">Assinatura do cliente</div></div>
         <div><div class="signature">Responsável Nivel Tech</div></div>
       </div>
     </div>
     <div class="footer">
       Documento gerado automaticamente pela plataforma Nivel Tech.<br>
       Este recibo confirma o recebimento do valor acima descrito e é válido como comprovante financeiro.
     </div>
   </div>
 </body>
 </html>`;
 let a=document.createElement("a");a.href=URL.createObjectURL(new Blob([html],{type:"text/html;charset=utf-8"}));a.download="recibo-pagamento-"+String(order.id).replace(/\s+/g,"-")+".html";document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(a.href);
 toast("Recibo baixado.");
}
async function copyPixKey(){
 let input=document.getElementById("pixKey");
 try{await navigator.clipboard.writeText(input.value);toast("Chave Pix copiada.");}
 catch(error){console.error("Não foi possível copiar a chave Pix.",error);input.focus();input.select();toast("Não foi possível copiar automaticamente. Selecione a chave e copie manualmente.");}
}
function showView(name){document.querySelectorAll("main > section.view").forEach(x=>x.classList.add("hidden"));document.getElementById("homeView").classList.toggle("hidden",name!=="home");if(name!=="home")document.getElementById(name+"View").classList.remove("hidden");document.querySelector(".navlinks").classList.remove("open");window.scrollTo({top:0,behavior:"smooth"});if(name==="client")renderClient();if(name==="manager")renderManager()}
window.addEventListener("storage",event=>{
 if(event.key===KEY){
  refreshDBFromStorage();
  if(managerEmail && !document.getElementById("managerView").classList.contains("hidden")){renderManager();}
  if(currentUser && !document.getElementById("clientView").classList.contains("hidden")){renderClient();}
 }
});
window.addEventListener("niveltech:db-updated",()=>{
 refreshDBFromStorage();
 if(managerEmail && !document.getElementById("managerView").classList.contains("hidden")){renderManager();}
 if(currentUser && !document.getElementById("clientView").classList.contains("hidden")){renderClient();}
});
function goHome(){showView("home")}
function logout(){currentUser=null;managerEmail=null;localStorage.removeItem(SESSION_KEYS.client);localStorage.removeItem(SESSION_KEYS.manager);showView("home");toast("Você saiu da sua conta.")}
function activeUser(){return db.users.find(u => normalizeEmail(u.email) === normalizeEmail(currentUser))}
function isManagerLoggedIn(){return !!managerEmail && MANAGERS.includes(managerEmail)}
function guardManagerAction(){if(!isManagerLoggedIn()){toast("Acesso restrito: somente gerentes autorizados podem alterar valores e status dos projetos.");return false}return true}
function loginManager(email,password,form){
 if(!MANAGERS.includes(email))return toast("Este e-mail não está autorizado.");
 let stored=localStorage.getItem("niveltech_manager_"+email);
 if(stored&&stored!==password)return toast("Senha incorreta para este gerente.");
 if(!stored){if(password.length<6)return toast("Use uma senha com pelo menos 6 caracteres.");localStorage.setItem("niveltech_manager_"+email,password);toast("Senha local cadastrada para este navegador.");}
 db=loadDB();
 managerEmail=email;saveSessionState();form.reset();showView("manager");
}
document.getElementById("year").textContent=new Date().getFullYear();
document.getElementById("startDate").min=today();
restoreSessionState();
if(managerEmail){showView("manager");}
else if(currentUser){showView("client");}
else{showView("home");}

document.getElementById("registerForm").addEventListener("submit",e=>{
 e.preventDefault();let f=Object.fromEntries(new FormData(e.target));
 const email = normalizeEmail(f.email);
 if(f.password!==f.confirm)return toast("As senhas não conferem.");
 if(db.users.some(u => normalizeEmail(u.email) === email))return toast("Este e-mail já possui cadastro.");
 db.users.push({name:f.name,phone:f.phone,email:email,password:f.password});saveDB();currentUser=email;saveSessionState();e.target.reset();showView("order");toast("Conta criada! Agora descreva seu projeto.");
});
document.getElementById("loginForm").addEventListener("submit",e=>{
 e.preventDefault();let f=Object.fromEntries(new FormData(e.target));
 let email=normalizeEmail(f.email);
 let u=db.users.find(x => normalizeEmail(x.email) === email && String(x.password || "") === String(f.password || ""));
 if(MANAGERS.includes(email))return loginManager(email,f.password,e.target);
 if(!u)return toast("E-mail ou senha inválidos.");
 currentUser=u.email;saveSessionState();e.target.reset();showView("client");
});
document.getElementById("orderForm").addEventListener("submit",e=>{
 e.preventDefault();if(!activeUser())return showView("login");
 let f=Object.fromEntries(new FormData(e.target)),id="NT-"+Date.now().toString().slice(-7),deadline=addDays(f.startDate,f.requestedDays),userEmail=normalizeEmail(currentUser),clientName=activeUser().name || "Cliente";
 let order={
  id,
  userEmail,
  client: clientName,
  phone: activeUser().phone,
  email: userEmail,
  type:f.type,
  company:f.company,
  description:f.description,
  reference:f.reference,
  startDate:f.startDate,
  requestedDays:Number(f.requestedDays),
  deadline,
  price:0,
  received:0,
  paymentHistory:[],
  chat:[{
   id:"msg-system-" + Date.now(),
   sender:"sistema",
   senderName:"Sistema",
   text:`Recebemos seu pedido para ${f.company || "o projeto"}. Nossa equipe vai analisar os detalhes e responder no painel do site em breve.`,
   created:new Date().toISOString()
  },{
   id:"msg-manager-auto-" + Date.now(),
   sender:"gerente",
   senderName:"Gerente",
   text:"Recebemos seu pedido e vamos confirmar os próximos passos com você em breve. Acompanhe as mensagens no painel do site.",
   created:new Date().toISOString()
  }],
  status:"Pendente",
  created:today(),
  updated:today()
 };
 db.orders.unshift(order);saveDB();
 e.target.reset();showView("client");
 toast("Pedido enviado com sucesso! Você pode acompanhar tudo e conversar com o gerente diretamente no painel do site.");
});
document.getElementById("managerForm").addEventListener("submit",e=>{
 e.preventDefault();let f=Object.fromEntries(new FormData(e.target)),email=f.email.toLowerCase();
 loginManager(email,f.password,e.target);
});
function statusClass(s){return s==="Concluído"?"done":s==="Em andamento"?"progress":s==="Inacabado"?"paused":""}
function deleteOrder(id){
 let order=db.orders.find(o => o.id===id && orderBelongsToUser(o, currentUser));
 if(!order)return toast("Não foi possível encontrar este pedido na sua conta.");
 if(!confirm(`Tem certeza que deseja apagar definitivamente o pedido de "${order.company}"? Esta ação não pode ser desfeita.`))return;
 db.orders=db.orders.filter(o => !(o.id===id && orderBelongsToUser(o, currentUser)));
 saveDB();renderClient();toast("Pedido removido.");
}
function renderChat(order){
 order.chat = Array.isArray(order.chat) ? order.chat : [];
 if(!order.chat.length){return '<div class="notice">Ainda não há mensagens. A equipe responderá aqui no site.</div>'};
 return order.chat.map(msg=>{
  const sender = msg.sender === "cliente" ? "Cliente" : msg.sender === "gerente" ? "Gerente" : msg.senderName || "Sistema";
  const time = msg.created ? new Date(msg.created).toLocaleTimeString("pt-BR", {hour:"2-digit", minute:"2-digit"}) : "agora";
  const meta = `${escapeHTML(sender)}<span>${time}</span>`;
  return `<div class="chat-message ${msg.sender === "cliente" ? "client" : msg.sender === "gerente" ? "manager" : "system"}"><span class="chat-meta">${meta}</span><span class="chat-text">${escapeHTML(msg.text || "")}</span></div>`;
 }).join("");
}
function sendPresetManagerReply(orderId, text){
 const order = db.orders.find(o => o.id === orderId);
 if(!order){return toast("Pedido não encontrado.");}
 if(!text){return;}
 order.chat = Array.isArray(order.chat) ? order.chat : [];
 order.chat.push({id:"msg-manager-quick-" + Date.now(), sender:"gerente", senderName:"Gerente", text, created:new Date().toISOString()});
 order.updated = today();
 saveDB();
}
function sendClientMessage(event, orderId){
 event.preventDefault();
 const form = event.target;
 const text = String(new FormData(form).get("message") || "").trim();
 if(!text){return;}
 const order = db.orders.find(o => o.id === orderId);
 if(!order){return toast("Pedido não encontrado.");}
 order.chat = Array.isArray(order.chat) ? order.chat : [];
 const currentClient = activeUser();
 order.chat.push({id:"msg-client-" + Date.now(), sender:"cliente", senderName: currentClient ? currentClient.name : "Cliente", text, created:new Date().toISOString()});
 order.updated = today();
 saveDB();
 form.reset();
}
function sendManagerMessage(event, orderId){
 event.preventDefault();
 const form = event.target;
 const text = String(new FormData(form).get("message") || "").trim();
 if(!text){return;}
 const order = db.orders.find(o => o.id === orderId);
 if(!order){return toast("Pedido não encontrado.");}
 order.chat = Array.isArray(order.chat) ? order.chat : [];
 order.chat.push({id:"msg-manager-" + Date.now(), sender:"gerente", senderName:"Gerente", text, created:new Date().toISOString()});
 order.updated = today();
 saveDB();
 form.reset();
}
function renderClient(){
 db=loadDB();
 let u=activeUser();if(!u){showView("login");return}
 document.getElementById("clientGreeting").textContent="Olá, "+u.name.split(" ")[0]+"!";
 let orders=db.orders.filter(o => orderBelongsToUser(o, currentUser));
 let root=document.getElementById("clientOrders");
 if(!orders.length){root.innerHTML='<div class="panel"><h3>Seu primeiro projeto começa aqui.</h3><p class="muted">Você ainda não possui solicitações. Conte sua ideia para a gente!</p><button class="btn btn-primary" onclick="showView(\'order\')">Solicitar meu site</button></div>';return}
 root.innerHTML=orders.map(o=>{let remaining=Math.ceil((new Date(o.deadline+"T23:59:59")-new Date())/86400000),pct=o.status==="Concluído"?100:o.status==="Pendente"?8:Math.min(90,Math.max(15,100-Math.max(0,remaining)/Math.max(1,o.requestedDays)*100));
 let valorProjeto = Number(o.price || 0), valorRecebido = getOrderReceived(o);
 let financeiro = valorProjeto > 0 ? `<div class="notice" style="display:grid;gap:8px;"><div style="padding:8px 10px;border-radius:8px;background:rgba(0,124,255,.08);border:1px solid rgba(0,124,255,.18)"><strong>Valor do projeto:</strong> ${money(valorProjeto)}</div><div style="padding:8px 10px;border-radius:8px;background:rgba(34,200,138,.08);border:1px solid rgba(34,200,138,.18)"><strong>Valor recebido:</strong> ${money(valorRecebido)}</div></div>` : `<div class="notice">Financeiro: o valor do projeto ainda não foi definido pelo gerente.</div>`;
 return `<div class="panel" style="margin-bottom:16px"><div class="order-card"><div><span class="muted" style="font-size:.8rem">${escapeHTML(o.id)} · ${date(o.created)}</span><h2 style="margin:4px 0">${escapeHTML(o.company)} · ${escapeHTML(o.type)}</h2><span class="status ${statusClass(o.status)}">${escapeHTML(o.status)}</span></div><div><small class="muted">Previsão de entrega</small><h3 style="margin:2px 0">${date(o.deadline)}</h3></div></div><div class="progress-track"><span style="width:${pct}%"></span></div><div class="order-card"><span class="muted">${o.status==="Concluído"?"Projeto concluído!":remaining>=0?`Previsão em ${remaining} dia(s)`: `Prazo previsto ultrapassado em ${Math.abs(remaining)} dia(s)`}</span><span class="muted">Atualizado: ${date(o.updated)}</span></div>${o.managerNote?`<div class="notice">Atualização da equipe: ${escapeHTML(o.managerNote)}</div>`:""}${financeiro}<div class="chat-box"><h3 style="margin-top:0">Conversa com o gerente</h3><div class="chat-thread">${renderChat(o)}</div><form class="chat-form" onsubmit="sendClientMessage(event, '${o.id}')"><input type="text" name="message" maxlength="500" placeholder="Escreva sua mensagem para o gerente..." required><button class="btn btn-primary btn-small" type="submit">Enviar</button></form></div><div class="form-actions"><a class="btn btn-primary" href="${whatsAppUrl(orderWhatsAppMessage(o))}" target="_blank" rel="noopener noreferrer">WhatsApp opcional</a><button class="btn btn-ghost" type="button" onclick="deleteOrder('${o.id}')">Retirar pedido</button></div></div>`}).join("");
}
function renderManager(){
 db=loadDB();
 if(!isManagerLoggedIn()){showView("managerLogin");return}
 let orders=db.orders,received=orders.reduce((a,o)=>a+getOrderReceived(o),0),sales=orders.reduce((a,o)=>a+Number(o.price||0),0);
 let pending=orders.filter(o=>o.status==="Pendente").length,done=orders.filter(o=>o.status==="Concluído").length,unfinished=orders.filter(o=>o.status==="Inacabado"||o.status==="Em andamento").length;
 document.getElementById("managerStats").innerHTML=[["Vendas contratadas",money(sales)],["Total recebido",money(received)],["Pedidos pendentes",pending],["Concluídos / em aberto",done+" / "+unfinished]].map(x=>`<div class="stat"><small>${x[0]}</small><strong>${x[1]}</strong></div>`).join("");
 let filterEl=document.getElementById("statusFilter"); let filter = filterEl ? filterEl.value : "all"; let shown=orders.filter(o=>filter==="all"||o.status===filter);
 document.getElementById("managerOrderRows").innerHTML=shown.length?shown.map(o=>`<tr><td><strong>${escapeHTML(o.company)}</strong><br><span class="muted">${escapeHTML(o.client)} · ${escapeHTML(o.type)}<br>${escapeHTML(o.email)}</span></td><td><span class="status ${statusClass(o.status)}">${escapeHTML(o.status)}</span></td><td>${date(o.deadline)}</td><td><div style="padding:6px 8px;border-radius:8px;background:rgba(0,124,255,.08);border:1px solid rgba(0,124,255,.18)"><small class="muted">Projeto</small><br>${Number(o.price||0)>0?money(o.price):'<span class="muted">Não definido</span>'}</div><div style="margin-top:8px;padding:6px 8px;border-radius:8px;background:rgba(34,200,138,.08);border:1px solid rgba(34,200,138,.18)"><small class="muted">Recebido</small><br>${money(getOrderReceived(o))}</div></td><td><button class="btn btn-ghost btn-small" onclick="editOrder('${o.id}')">Editar</button> <button class="btn btn-primary btn-small" onclick="registerPayment('${o.id}')">Registrar pagamento</button> <button class="btn btn-ghost btn-small" onclick="finishOrder('${o.id}')">Finalizar</button></td></tr>`).join(""):'<tr><td colspan="5" class="muted">Nenhum pedido neste filtro.</td></tr>';
 let managerChatHtml = shown.length ? shown.map(o => `
  <div class="chat-box">
    <h3 style="margin-top:0">Conversa · ${escapeHTML(o.company)}</h3>
   <div class="chat-thread">${renderChat(o)}</div>
   <div class="quick-replies" style="display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px;">
    ${QUICK_REPLY_TEMPLATES.map(template=>`<button type="button" class="btn btn-ghost btn-small" onclick="sendPresetManagerReply('${o.id}', '${template.text.replace(/'/g, "\\'").replace(/\n/g, ' ')}')">${template.label}</button>`).join("")}
   </div>
   <form class="chat-form" onsubmit="sendManagerMessage(event, '${o.id}')">
    <input type="text" name="message" maxlength="500" placeholder="Responder ao cliente..." required>
    <button type="submit" class="btn btn-primary btn-small">Enviar</button>
   </form>
  </div>
 `).join("") : '<div class="notice">Nenhum pedido para iniciar uma conversa.</div>';
 document.getElementById("managerChat").innerHTML = managerChatHtml;
  renderFinance();document.getElementById("managerEmails").innerHTML=MANAGERS.map(email=>`<li><strong>${MANAGER_NAMES[email] || email}</strong>${email && email !== (MANAGER_NAMES[email] || email) && !(MANAGER_NAMES[email] === "Nivel Tech") ? ` · ${email}` : ""}</li>`).join("");
}
function managerTab(tab,btn){document.querySelectorAll(".tabs .tab").forEach(x=>x.classList.remove("active"));btn.classList.add("active");["orders","finance","team"].forEach(x=>document.getElementById("manager"+x[0].toUpperCase()+x.slice(1)).classList.toggle("hidden",x!==tab))}
function finishOrder(id){if(!guardManagerAction())return;let o=db.orders.find(x=>x.id===id);if(!o)return;o.status="Concluído";o.updated=today();o.managerNote="Seu projeto foi finalizado. Obrigado por escolher a Nivel Tech!";saveDB();renderManager();toast("Pedido finalizado. O cliente verá a atualização no painel.");}
function registerPayment(id){
 if(!guardManagerAction())return;
 let o=db.orders.find(x=>x.id===id);if(!o)return;
 let currentTotal = getOrderReceived(o);
 document.getElementById("modalRoot").innerHTML=`<div class="modal-backdrop" onclick="if(event.target===this)closeModal()"><div class="modal"><button class="close" onclick="closeModal()">×</button><h2>Registrar pagamento · ${escapeHTML(o.company)}</h2><div class="notice" style="margin-bottom:16px">Total recebido até agora: <strong>${money(currentTotal)}</strong></div><form id="paymentForm"><div class="field"><label>Valor do pagamento (R$)</label><input name="amount" type="number" min="0" step=".01" required placeholder="Ex.: 500"></div><div class="field" style="margin-top:12px"><label>Data do pagamento</label><input name="date" type="date" value="${today()}" required></div><div class="field" style="margin-top:12px"><label>Observação</label><textarea name="note" placeholder="Ex.: entrada do projeto, pagamento parcial, etc."></textarea></div><div class="form-actions"><button class="btn btn-primary">Salvar pagamento</button><button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button><button type="button" class="btn btn-ghost" onclick="downloadPaymentReceipt(db.orders.find(x=>x.id==='${o.id}'))">Baixar recibo</button></div></form><div style="margin-top:16px"><strong>Histórico</strong><ul class="muted" style="padding-left:20px;margin:10px 0 0">${formatPaymentHistory(o) || '<li>Nenhum pagamento registrado até o momento.</li>'}</ul></div></div></div>`;
 document.getElementById("paymentForm").addEventListener("submit",e=>{e.preventDefault();if(!guardManagerAction())return;let f=Object.fromEntries(new FormData(e.target));if(!Number(f.amount||0))return toast("Informe um valor maior que zero.");
 let entry={id:"pay-"+Date.now(),amount:Number(f.amount||0),date:f.date||today(),note:String(f.note||"").trim()};
 o.paymentHistory = Array.isArray(o.paymentHistory)?o.paymentHistory:[];
 o.paymentHistory.push(entry);o.received=getOrderReceived(o);o.updated=today();saveDB();closeModal();renderManager();toast("Pagamento registrado com sucesso.");});
}
function editOrder(id){
 if(!guardManagerAction())return;
 let o=db.orders.find(x=>x.id===id);if(!o)return;
 document.getElementById("modalRoot").innerHTML=`<div class="modal-backdrop" onclick="if(event.target===this)closeModal()"><div class="modal"><button class="close" onclick="closeModal()">×</button><h2>Editar pedido ${escapeHTML(o.id)}</h2><form id="editForm"><div class="field"><label>Status</label><select name="status">${["Pendente","Em andamento","Concluído","Inacabado"].map(s=>`<option ${o.status===s?"selected":""}>${s}</option>`).join("")}</select></div><div class="field" style="margin-top:12px"><label>Prazo final</label><input name="deadline" type="date" value="${o.deadline}" required></div><div class="field" style="margin-top:12px"><label>Valor do projeto (R$)</label><input name="price" type="number" min="0" step=".01" value="${o.price}" placeholder="Ex.: 2500"></div><div class="field" style="margin-top:12px"><label>Valor recebido (R$)</label><input name="received" type="number" min="0" step=".01" value="${getOrderReceived(o)}" placeholder="Ex.: 1000"></div><div class="field" style="margin-top:12px"><label>Nota visível ao cliente</label><textarea name="managerNote">${escapeHTML(o.managerNote||"")}</textarea></div><div class="form-actions"><button class="btn btn-primary">Salvar alterações</button><button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button></div></form></div></div>`;
 document.getElementById("editForm").addEventListener("submit",e=>{e.preventDefault();if(!guardManagerAction())return;let f=Object.fromEntries(new FormData(e.target));o.status=f.status;o.deadline=f.deadline;o.price=Number(f.price||0);o.received=Number(f.received||0);o.managerNote=f.managerNote;o.updated=today();saveDB();closeModal();renderManager();toast("Pedido atualizado.");});
}
function closeModal(){document.getElementById("modalRoot").innerHTML=""}
function renderFinance(){
 let now=new Date(),monthKey=now.toISOString().slice(0,7),year=String(now.getFullYear()),weekStart=new Date(now);weekStart.setDate(now.getDate()-((now.getDay()+6)%7));weekStart.setHours(0,0,0,0);
 let byMonth={},byYear={},byWeek={},countMonth=0,countWeek=0,countYear=0;
 db.orders.forEach(o=>{let val=getOrderReceived(o);if(!val)return;let d=new Date((o.updated||o.created)+"T12:00:00"),m=(o.updated||o.created).slice(0,7),y=String(d.getFullYear());byMonth[m]=(byMonth[m]||0)+val;byYear[y]=(byYear[y]||0)+val;if(d>=weekStart){byWeek["Semana atual"]=(byWeek["Semana atual"]||0)+val;countWeek++}if(m===monthKey)countMonth++;if(y===year)countYear++;});
 let m=byMonth[monthKey]||0,w=byWeek["Semana atual"]||0,y=byYear[year]||0;
 document.getElementById("financeStats").innerHTML=[["Recebido nesta semana",money(w)],["Recebido neste mês",money(m)],["Recebido neste ano",money(y)]].map(x=>`<div class="stat"><small>${x[0]}</small><strong>${x[1]}</strong></div>`).join("");
 let rows=[...Object.entries(byMonth).sort((a,b)=>b[0].localeCompare(a[0])).map(([k,v])=>[new Date(k+"-02").toLocaleDateString("pt-BR",{month:"long",year:"numeric"}),v,"—"]),...Object.entries(byYear).sort((a,b)=>b[0].localeCompare(a[0])).map(([k,v])=>["Ano "+k,v,"—"]),["Semana atual",w,countWeek]];
 document.getElementById("financeRows").innerHTML=rows.length?rows.map(r=>`<tr><td>${r[0]}</td><td>${money(r[1])}</td><td>${r[2]}</td></tr>`).join(""):'<tr><td colspan="3" class="muted">Nenhum recebimento registrado ainda. Edite um pedido para informar o valor recebido.</td></tr>';
}
function exportData(){let lines=[["ID","Cliente","Email","Projeto","Status","Prazo","Valor","Recebido"],...db.orders.map(o=>[o.id,o.client,o.email,o.company,o.status,o.deadline,o.price,o.received])];let csv=lines.map(r=>r.map(v=>'"'+String(v !== undefined && v !== null ? v : "").replace(/"/g,'""')+'"').join(";")).join("\\n");let a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\\ufeff"+csv],{type:"text/csv;charset=utf-8"}));a.download="nivel-tech-pedidos.csv";a.click();URL.revokeObjectURL(a.href)}

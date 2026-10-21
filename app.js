const $ = id => document.getElementById(id);
let mode = "login", currentUser = null, quiz = [], answers = {}, questionIndex = 0, adminToken = null;
function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2600)}
async function api(url, options={}) {
  const response = await fetch(url, {credentials:"same-origin",headers:{"Content-Type":"application/json",...(options.headers||{})},...options});
  const data = await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.error || "요청에 실패했습니다.");
  return data;
}
document.querySelectorAll("[data-auth]").forEach(btn=>btn.addEventListener("click",()=>{
  mode=btn.dataset.auth;document.querySelectorAll("[data-auth]").forEach(b=>b.classList.toggle("active",b===btn));
  $("authSubmit").textContent=mode==="login"?"로그인":"회원가입";$("password").autocomplete=mode==="login"?"current-password":"new-password";$("authMessage").textContent="";
}));
$("authForm").addEventListener("submit",async e=>{
  e.preventDefault();const button=$("authSubmit");button.disabled=true;$("authMessage").textContent="";
  try{const data=await api(`/api/auth/${mode==="login"?"login":"register"}`,{method:"POST",body:JSON.stringify({username:$("username").value,password:$("password").value})});currentUser=data.user;showLoggedIn();toast(`${currentUser.username}님, 환영합니다!`);}
  catch(err){$("authMessage").textContent=err.message;}
  finally{button.disabled=false;}
});
function showLoggedIn(){ $("authPanel").hidden=true;$("quizPanel").hidden=false;$("logoutBtn").hidden=false;$("userChip").textContent=`👩‍🚀 ${currentUser.username}`; }
$("logoutBtn").addEventListener("click",async()=>{try{await api("/api/auth/logout",{method:"POST",body:"{}"});}catch{}currentUser=null;$("authPanel").hidden=false;$("quizPanel").hidden=true;$("logoutBtn").hidden=true;$("quizArea").innerHTML='<div class="empty"><span>🚀</span><h3>준비됐나요?</h3><p>조건을 선택하고 퀘스트 시작 버튼을 눌러 주세요.</p></div>';toast("로그아웃했습니다.");});
$("startQuiz").addEventListener("click",async()=>{
  const btn=$("startQuiz");btn.disabled=true;
  try{const data=await api(`/api/questions?subject=${encodeURIComponent($("subject").value)}&level=${encodeURIComponent($("level").value)}&count=${$("count").value}`);quiz=data.questions;answers={};questionIndex=0;renderQuestion();}
  catch(e){toast(e.message);}finally{btn.disabled=false;}
});
function renderQuestion(){
  if(!quiz.length)return;
  const q=quiz[questionIndex],picked=answers[q.id];
  $("quizArea").innerHTML=`<div class="question-card"><div class="q-meta">${escapeHtml(q.subject)} · 난이도 ${escapeHtml(q.level)} · ${questionIndex+1}/${quiz.length}</div><div class="progress"><div style="width:${(questionIndex+1)/quiz.length*100}%"></div></div><h3>${escapeHtml(q.question)}</h3><div class="answers">${q.options.map((opt,i)=>`<label class="answer"><input type="radio" name="answer" value="${i}" ${picked===i?"checked":""}><span>${String.fromCharCode(65+i)}. ${escapeHtml(opt)}</span></label>`).join("")}</div><div class="quiz-actions"><button class="ghost" id="prevQ" ${questionIndex===0?"disabled":""}>← 이전</button><span class="muted">${Object.keys(answers).length}/${quiz.length} 답변</span><button class="primary" id="nextQ">${questionIndex===quiz.length-1?"제출하기":"다음 →"}</button></div></div>`;
  document.querySelectorAll('input[name="answer"]').forEach(r=>r.addEventListener("change",()=>{answers[q.id]=Number(r.value);renderQuestion();}));
  $("prevQ").addEventListener("click",()=>{questionIndex--;renderQuestion();});
  $("nextQ").addEventListener("click",()=>{if(answers[q.id]===undefined){toast("답을 하나 선택해 주세요.");return;}if(questionIndex<quiz.length-1){questionIndex++;renderQuestion();}else submitQuiz();});
}
async function submitQuiz(){
  try{
    const result=await api("/api/quiz/submit",{method:"POST",body:JSON.stringify({subject:$("subject").value,answers:quiz.filter(q=>answers[q.id]!==undefined).map(q=>({questionId:q.id,answer:answers[q.id]}))})});
    $("quizArea").innerHTML=`<div class="question-card"><div class="eyebrow">MISSION COMPLETE</div><h2>퀘스트 완료! 🎉</h2><p style="font-size:28px;font-weight:900;color:var(--cyan)">${result.score} / ${result.total} 정답</p><p class="muted">정답률 ${Math.round(result.score/Math.max(result.total,1)*100)}% · 결과가 리더보드에 저장됐어요.</p>${result.results.map((r,i)=>`<div class="board-row"><span>${r.correct?"✅":"❌"}</span><div><b>${i+1}번 ${r.correct?"정답":"오답"}</b><div class="muted">${escapeHtml(r.explanation)}</div></div></div>`).join("")}<button class="primary full" id="again">다시 도전하기</button></div>`;
    $("again").addEventListener("click",()=>$("startQuiz").click());loadBoard();toast("결과를 저장했습니다.");
  }catch(e){toast(e.message);}
}
async function loadBoard(){
  try{const {leaderboard}=await api("/api/leaderboard");$("board").innerHTML=leaderboard.length?leaderboard.map((u,i)=>`<div class="board-row"><div class="rank">${i+1}</div><div><b>${escapeHtml(u.username)}</b><div class="muted">${u.rounds}회 도전 · ${u.answered}문항 풀이</div></div><div class="points">${u.points} XP<small>정답 수</small></div></div>`).join(""):'<div class="empty"><span>🏆</span><h3>아직 기록이 없어요</h3><p>첫 퀘스트를 완료하고 리더보드에 이름을 올려 보세요.</p></div>';}
  catch{$("board").innerHTML='<p class="muted">리더보드를 불러오지 못했습니다.</p>';}
}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
$("refreshBoard").addEventListener("click",loadBoard);
$("leaderboardNav").addEventListener("click",()=>{$("leaderboardPanel").scrollIntoView({behavior:"smooth"});loadBoard();});
(async()=>{try{const {user}=await api("/api/auth/me");currentUser=user;showLoggedIn();}catch{}loadBoard();})();

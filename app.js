const form=document.querySelector("#form");
const statusBox=document.querySelector("#status");
const result=document.querySelector("#result");
let sourceType="link";

document.querySelectorAll(".source").forEach(btn=>{
  btn.onclick=()=>{
    document.querySelectorAll(".source").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");
    sourceType=btn.dataset.source;
    document.querySelector("#sourceType").value=sourceType;
    document.querySelector("#linkBox").classList.toggle("hidden",sourceType!=="link");
    document.querySelector("#fileBox").classList.toggle("hidden",sourceType==="link");
    document.querySelector("#sourceValue").required=sourceType==="link";
  };
});

form.onsubmit=async e=>{
  e.preventDefault();
  statusBox.textContent="Membuat project...";
  const fd=new FormData();
  fd.append("name",document.querySelector("#name").value);
  fd.append("packageName",document.querySelector("#packageName").value);
  fd.append("version",document.querySelector("#version").value);
  fd.append("sourceType",sourceType);
  fd.append("sourceValue",document.querySelector("#sourceValue").value);
  document.querySelectorAll('input[name="permission"]:checked').forEach(x=>fd.append("permissions",x.value));
  const file=document.querySelector("#sourceFile").files[0];
  if(file) fd.append("sourceFile",file);

  try{
    const r=await fetch("/api/projects",{method:"POST",body:fd});
    const j=await r.json();
    if(!j.ok) throw new Error(j.error);
    statusBox.textContent="Project dibuat. Memulai build...";
    const b=await fetch(`/api/projects/${j.project.id}/build`,{method:"POST"});
    const bj=await b.json();
    if(!bj.ok) throw new Error(bj.error);
    poll(j.project.id);
  }catch(err){statusBox.textContent="ERROR: "+err.message}
};

async function poll(id){
  const r=await fetch(`/api/projects/${id}`);
  const j=await r.json();
  if(!j.ok){statusBox.textContent=j.error;return}
  statusBox.textContent=j.project.message||j.project.status;
  if(j.project.status==="done"){
    result.classList.remove("hidden");
    result.innerHTML=`<h2>APK selesai dibuat.</h2><p>${esc(j.project.name)} • ${esc(j.project.version)}</p><a class="download" href="${j.project.download}">DOWNLOAD APK</a>`;
    return;
  }
  if(j.project.status==="error"){
    result.classList.remove("hidden");
    result.innerHTML=`<h2>Build gagal</h2><p>${esc(j.project.message)}</p>`;
    return;
  }
  setTimeout(()=>poll(id),2000);
}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

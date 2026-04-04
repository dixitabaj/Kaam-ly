import { useState, useEffect, useRef } from "react";

const C = {
  orange:"#f6ad56",orangeDark:"#e59a3d",orangeDeep:"#c97c20",orangeLight:"#fff7ed",orangeBorder:"#fde8c8",
  bg:"#f8f5f0",surface:"#ffffff",border:"#e2e8f0",divider:"#f1f5f9",
  text:"#0f172a",textMid:"#475569",textLight:"#94a3b8",
  green:"#10b981",greenLight:"#ecfdf5",greenBorder:"#a7f3d0",
  red:"#ef4444",redLight:"#fef2f2",redBorder:"#fecaca",
  blue:"#3b82f6",blueLight:"#eff6ff",blueBorder:"#bfdbfe",
};

const BASE = "http://127.0.0.1:8000";

const CATEGORY_SKILLS_MAP = {
  Plumbing:["Pipe Repair","Drain Cleaning","Sewer Repair","Fixture Installation","Water Heater Repair"],
  Moving:["Packing","Loading & Unloading","Furniture Moving","Relocation Support"],
  Cleaning:["House Cleaning","Office Cleaning","Carpet Cleaning","Window Cleaning","Laundry & Ironing"],
  Gardening:["Lawn Care","Landscaping","Tree Service","Plant Care","Garden Maintenance"],
  Painting:["Interior Painting","Exterior Painting","Wall Painting","Touch-ups & Patching"],
  Carpentry:["Furniture Repair","Cabinet Making","Shelving & Storage","Woodwork","Joinery"],
  "Appliance Repair":["Washer Repair","Dryer Repair","Fridge Repair","Oven Repair"],
  Electrical:["Wiring & Rewiring","Lighting Installation","Circuit Repair","Outlet & Switch Repair"],
  HVAC:["Heating Repair","Air Conditioning","Ventilation","Furnace Repair","Cooling Systems"],
  Assembly:["Furniture Assembly","Flat-pack Assembly","TV Mounting","Shelving Installation"],
};
const ALL_CATEGORIES = Object.keys(CATEGORY_SKILLS_MAP);
const SERVICE_AREAS = ["Kathmandu","Lalitpur","Bhaktapur","Pokhara","Chitwan","Butwal","Biratnagar","Dharan","Nepalgunj","Dhangadhi","Hetauda","Janakpur","Bharatpur","Itahari","Birgunj"];
const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

function loadStored() {
  try { const r = sessionStorage.getItem("user")||localStorage.getItem("user"); return r?JSON.parse(r):null; } catch { return null; }
}
function loadToken() {
  for (const s of [sessionStorage,localStorage]) {
    const t = s.getItem("token")||s.getItem("accessToken")||s.getItem("authToken");
    if (t) return t;
  }
  return null;
}

function normaliseSkills(rawSkills=[]) {
  if (!rawSkills.length) return [];
  if (rawSkills[0]?.subSkills) return JSON.parse(JSON.stringify(rawSkills));
  const grouped={};
  rawSkills.forEach(s => {
    let parent=s.name;
    for (const [cat,subs] of Object.entries(CATEGORY_SKILLS_MAP)) {
      if (subs.includes(s.name)){parent=cat;break;}
    }
    if (!grouped[parent]) grouped[parent]=[];
    grouped[parent].push({
      name: s.name,
      price: s.price||0,
      evidenceUrl: s.evidenceUrl||"",
      evidenceType: s.evidenceType||"",
      evidenceName: s.evidenceName||"",
      evidenceThumbnail: s.evidenceThumbnail||"",
      skillVerificationStatus: s.skillVerificationStatus||null,
      skillVerifyReason: s.skillVerifyReason||"",
    });
  });
  return Object.entries(grouped).map(([name,subSkills])=>({name,subSkills}));
}

const initials=(f="",l="")=>`${f[0]||""}${l[0]||""}`.toUpperCase()||"W";
const fmtDate=(d)=>d?new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):"—";
const fmtMonth=(d)=>d?new Date(d).toLocaleDateString("en-US",{month:"long",year:"numeric"}):"";
const formatBytes=(b)=>b<1024?`${b} B`:b<1048576?`${(b/1024).toFixed(1)} KB`:`${(b/1048576).toFixed(1)} MB`;
const fileIcon=(f)=>!f?"📁":f.type?.startsWith("image/")?"🖼️":f.type?.startsWith("video/")?"🎬":"📄";

const inputSx={width:"100%",padding:"9px 13px",borderRadius:8,fontSize:13.5,border:`1.5px solid ${C.border}`,outline:"none",background:"#fafbfc",color:C.text,fontFamily:"inherit",boxSizing:"border-box",transition:"border-color 0.15s, box-shadow 0.15s"};

const STATUS_MAP = {
  pending:  { bg:"#fff7ed", border:"#fde8c8", text:"#c97c20", label:"⏳ Pending Review" },
  accepted: { bg:"#ecfdf5", border:"#a7f3d0", text:"#10b981", label:"✓ Verified"        },
  rejected: { bg:"#fef2f2", border:"#fecaca", text:"#ef4444", label:"✕ Rejected"        },
};

const Toast=({toast})=>toast?(
  <div style={{position:"fixed",top:20,right:20,zIndex:9999,background:toast.ok?"#065f46":"#7f1d1d",color:"white",padding:"13px 20px",borderRadius:12,fontSize:13.5,fontWeight:500,boxShadow:"0 10px 32px rgba(0,0,0,0.2)",display:"flex",alignItems:"center",gap:10,animation:"slideIn 0.22s ease"}}>
    <div style={{width:7,height:7,borderRadius:"50%",background:"rgba(255,255,255,0.5)",flexShrink:0}}/>
    {toast.msg}
  </div>
):null;

const EmptyState=({title,sub})=>(
  <div style={{padding:"56px 24px",textAlign:"center"}}>
    <div style={{width:44,height:44,borderRadius:"50%",background:C.orangeLight,border:`1.5px solid ${C.orangeBorder}`,margin:"0 auto 16px",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:10,height:10,borderRadius:"50%",background:C.orange}}/>
    </div>
    <div style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:6}}>{title}</div>
    <div style={{fontSize:13,color:C.textLight,lineHeight:1.75,maxWidth:300,margin:"0 auto"}}>{sub}</div>
  </div>
);

const Toggle=({checked,onChange,disabled=false})=>(
  <div onClick={()=>!disabled&&onChange(!checked)} style={{width:44,height:24,borderRadius:12,flexShrink:0,background:checked?C.orange:C.border,position:"relative",cursor:disabled?"not-allowed":"pointer",transition:"background 0.2s",opacity:disabled?0.5:1}}>
    <div style={{position:"absolute",top:3,left:checked?23:3,width:18,height:18,borderRadius:"50%",background:"white",boxShadow:"0 1px 4px rgba(0,0,0,0.2)",transition:"left 0.2s"}}/>
  </div>
);

const Spinner=({size=14,color="white"})=>(
  <div style={{width:size,height:size,border:`2px solid ${color}40`,borderTopColor:color,borderRadius:"50%",animation:"spin 0.7s linear infinite",flexShrink:0}}/>
);

/* ── Evidence Section ── */
function EvidenceSection({ skillName, skillData, pending, err, loading, onFile, onUpload, onClear }) {
  const evidenceUrl  = skillData?.evidenceUrl  || "";
  const evidenceName = skillData?.evidenceName || "Uploaded file";
  const status       = skillData?.skillVerificationStatus || (evidenceUrl ? "pending" : null);
  const rejectReason = skillData?.skillVerifyReason || "";
  const sc           = status ? STATUS_MAP[status] : null;

  return (
    <div style={{borderTop:`1px solid ${C.divider}`,padding:"12px 16px",background:"#FDFCFA"}}>
      <div style={{fontSize:11,fontWeight:700,color:C.textLight,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:8,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        Skill Evidence
        {sc && (
          <span style={{background:sc.bg,color:sc.text,border:`1px solid ${sc.border}`,borderRadius:100,padding:"1px 8px",fontSize:10,fontWeight:700}}>
            {sc.label}
          </span>
        )}
      </div>

      {/* Rejection reason */}
      {status === "rejected" && rejectReason && (
        <div style={{fontSize:12,color:C.red,background:C.redLight,border:`1px solid ${C.redBorder}`,borderRadius:8,padding:"8px 12px",marginBottom:8}}>
          Reason: {rejectReason}
        </div>
      )}

      {err && (
        <div style={{fontSize:12,color:C.red,background:C.redLight,borderRadius:8,padding:"8px 12px",marginBottom:8}}>⚠️ {err}</div>
      )}

      {/* Existing uploaded file */}
      {evidenceUrl && (
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:C.greenLight,border:`1px solid ${C.greenBorder}`,borderRadius:8,marginBottom:8}}>
          <span style={{fontSize:16}}>📄</span>
          <span style={{fontSize:12,flex:1,fontWeight:500,color:C.text,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {evidenceName}
          </span>
          <a href={evidenceUrl} target="_blank" rel="noopener noreferrer"
            style={{fontSize:12,color:C.blue,textDecoration:"none",fontWeight:600,flexShrink:0}}>
            View
          </a>
        </div>
      )}

      {/* Pending file ready to upload */}
      {pending ? (
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",background:C.orangeLight,border:`1px solid ${C.orangeBorder}`,borderRadius:8}}>
          <span style={{fontSize:16}}>{fileIcon(pending)}</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{pending.name}</div>
            <div style={{fontSize:11,color:C.textLight}}>{formatBytes(pending.size)}</div>
          </div>
          <button onClick={onUpload} disabled={loading}
            style={{padding:"5px 12px",borderRadius:7,border:"none",background:C.orange,color:"white",fontSize:12,fontWeight:600,cursor:"pointer",flexShrink:0}}>
            {loading ? "…" : "Upload"}
          </button>
          <button onClick={onClear}
            style={{background:"none",border:"none",cursor:"pointer",color:C.textLight,fontSize:14,padding:"4px 6px"}}>✕</button>
        </div>
      ) : (
        <label style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",border:`2px dashed ${C.border}`,borderRadius:8,cursor:"pointer",transition:"border-color 0.15s"}}
          onMouseEnter={e=>e.currentTarget.style.borderColor=C.orange}
          onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
          <input type="file" accept="image/*,video/*,application/pdf,.pdf" style={{display:"none"}}
            onChange={e=>{if(e.target.files[0])onFile(e.target.files[0]);e.target.value="";}}/>
          <span style={{fontSize:16}}>⬆️</span>
          <div>
            <div style={{fontSize:12,fontWeight:600,color:C.textMid}}>
              {evidenceUrl ? "Replace evidence" : `Attach evidence for ${skillName}`}
            </div>
            <div style={{fontSize:11,color:C.textLight}}>PDF · Image · Video</div>
          </div>
        </label>
      )}
    </div>
  );
}

export default function WorkerSettings(){
  const fileRef=useRef(null);
  const [worker,setWorker]=useState(null);
  const [token,setToken]=useState(null);
  const [tab,setTab]=useState("profile");
  const [toast,setToast]=useState(null);
  const [loading,setLoading]=useState(true);

  // Profile fields
  const [firstName,setFirstName]=useState("");
  const [lastName,setLastName]=useState("");
  const [address,setAddress]=useState("");
  const [description,setDescription]=useState("");
  const [basePrice,setBasePrice]=useState("");
  const [phoneNo,setPhoneNo]=useState("");
  const [email,setEmail]=useState("");
  const [taskType,setTaskType]=useState("");
  const [isAvailable,setIsAvailable]=useState(false);
  const [avatar,setAvatar]=useState(null);
  const [avatarUploading,setAvatarUploading]=useState(false);
  const [serviceAreas,setServiceAreas]=useState([]);
  const [minHours,setMinHours]=useState(1);
  const [profileSaving,setProfileSaving]=useState(false);
  const [profileSaved,setProfileSaved]=useState(false);

  // Stats
  const [totalEarnings,setTotalEarnings]=useState(0);
  const [completedTasks,setCompletedTasks]=useState(0);
  const [ratings,setRatings]=useState(0);

  // Skills
  const [editSkills,setEditSkills]=useState([]);
  const [skillsDirty,setSkillsDirty]=useState(false);
  const [addingSkill,setAddingSkill]=useState(false);
  const [newSkillCat,setNewSkillCat]=useState("");
  const [newSubSels,setNewSubSels]=useState([]);
  const [newSubPrices,setNewSubPrices]=useState({});
  const [addSkillErr,setAddSkillErr]=useState("");
  const [skillsSaving,setSkillsSaving]=useState(false);
  const [skillsSaved,setSkillsSaved]=useState(false);
  const [skillsError,setSkillsError]=useState("");

  // Evidence — keyed by skill name
  const [evidenceFiles,setEvidenceFiles]=useState({});   // { skillName: File }
  const [evidenceLoading,setEvidenceLoading]=useState({}); // { skillName: bool }
  const [evidenceErrors,setEvidenceErrors]=useState({});  // { skillName: string }

  // Availability
  const [availData,setAvailData]=useState(null);
  const [availLoading,setAvailLoading]=useState(false);

  // Reviews & Reports
  const [reviews,setReviews]=useState([]);
  const [reports,setReports]=useState([]);
  const [reviewsLoading,setReviewsLoading]=useState(false);
  const [reportsLoading,setReportsLoading]=useState(false);

  const showToast=(msg,ok=true)=>{setToast({msg,ok});setTimeout(()=>setToast(null),3500);};
  const authH=(t)=>({"Content-Type":"application/json",...(t?{Authorization:`Bearer ${t}`}:{})});

  const applyWorker=(w)=>{
    setWorker(w);
    setFirstName(w.firstName||"");
    setLastName(w.lastName||"");
    setAddress(w.address||"");
    setDescription(w.description||"");
    setBasePrice(String(w.basePrice||""));
    setPhoneNo(w.phoneNo||"");
    setEmail(w.email||w._id||"");
    setTaskType(w.taskType||"");
    setIsAvailable(w.isAvailable??true);
    setAvatar(w.profilePhoto||null);
    setRatings(w.ratings||0);
    setTotalEarnings(w.total_earnings||w.earnings||0);
    setCompletedTasks(w.noOfCompletedTask||0);
    setMinHours(w.minHours||1);
    const areas=w.serviceAreas||(w.serviceArea?.cities)||(w.serviceArea?.primaryCity?[w.serviceArea.primaryCity]:[]);
    setServiceAreas(areas||[]);
    setEditSkills(normaliseSkills(w.skills||[]));
    setSkillsDirty(false);
    if(w.hours){
      const wh={};
      DAYS.forEach(day=>{
        const slots=w.hours[day]||[];
        wh[day]={enabled:slots.length>0,start:slots[0]?.start||"09:00",end:slots[0]?.end||"17:00",slots};
      });
      setAvailData({weekly_hours:wh});
    }
  };

  /* Refresh skills from server to get latest evidence + status */
  const refreshWorkerSkills = async (workerId, t) => {
    try {
      const res = await fetch(`${BASE}/api/worker/${encodeURIComponent(workerId)}`, { headers: authH(t) });
      if (res.ok) {
        const w = await res.json();
        setEditSkills(normaliseSkills(w.skills || []));
      }
    } catch {}
  };

  useEffect(()=>{
    const stored=loadStored();
    const t=loadToken();
    setToken(t);
    if(!stored?.email){setLoading(false);return;}
    applyWorker(stored);
    const workerId=stored.email;
    (async()=>{
      try{
        const wRes=await fetch(`${BASE}/api/worker/${encodeURIComponent(workerId)}`,{headers:authH(t)});
        if(wRes.ok){const w=await wRes.json();applyWorker(w);}

        setReviewsLoading(true);
        const revRes=await fetch(`${BASE}/api/reviews/worker/${workerId}`,{headers:authH(t)});
        if(revRes.ok){const d=await revRes.json();setReviews(Array.isArray(d)?d:d.reviews||[]);}
        setReviewsLoading(false);

        setReportsLoading(true);
        const repRes=await fetch(`${BASE}/api/reports/worker/${workerId}`,{headers:authH(t)});
        if(repRes.ok){const d=await repRes.json();setReports(Array.isArray(d)?d:d.reports||[]);}
        setReportsLoading(false);
      }catch(err){console.error(err);showToast("Failed to load some data",false);}
      finally{setLoading(false);}
    })();
  },[]);

  const handleProfileSave=async()=>{
    if(!worker?.email)return;
    setProfileSaving(true);
    try{
      const res=await fetch(`${BASE}/api/worker/${encodeURIComponent(worker.email)}`,{
        method:"PATCH",headers:authH(token),
        body:JSON.stringify({firstName,lastName,address,description,basePrice:Number(basePrice)||0,serviceAreas,minHours:Number(minHours)||1,taskType}),
      });
      await fetch(`${BASE}/api/worker/${worker.email}/availability/toggle`,{
        method:"PATCH",headers:authH(token),body:JSON.stringify({isAvailable}),
      });
      if(res.ok){setProfileSaved(true);setTimeout(()=>setProfileSaved(false),2500);showToast("Profile updated successfully");}
      else{const e=await res.json().catch(()=>({}));showToast(e.detail||"Failed to save changes",false);}
    }catch{showToast("Network error",false);}
    setProfileSaving(false);
  };

  const handlePhotoChange=async(e)=>{
    const file=e.target.files[0];
    if(!file||!worker?.email)return;
    const reader=new FileReader();
    reader.onload=ev=>setAvatar(ev.target.result);
    reader.readAsDataURL(file);
    setAvatarUploading(true);
    try{
      const fd=new FormData();fd.append("photo",file);
      const res=await fetch(`${BASE}/api/worker/upload-photo/${worker.email}`,{method:"POST",body:fd});
      if(res.ok){const d=await res.json();setAvatar(d.photo_url);showToast("Photo updated");}
      else throw new Error();
    }catch{showToast("Upload failed",false);}
    setAvatarUploading(false);
  };

  const handleToggleAvailability=async()=>{
    const next=!isAvailable;setIsAvailable(next);
    try{
      await fetch(`${BASE}/api/worker/${worker.email}/availability/toggle`,{method:"PATCH",headers:authH(token),body:JSON.stringify({isAvailable:next})});
      showToast(next?"Now available for work":"Now unavailable");
    }catch{showToast("Failed to update availability",false);}
  };

  const handleDayToggle=async(day)=>{
    if(!availData||!worker?.email)return;
    const cur=availData.weekly_hours[day]?.enabled||false;
    const next=!cur;
    setAvailData(prev=>({...prev,weekly_hours:{...prev.weekly_hours,[day]:{...prev.weekly_hours[day],enabled:next}}}));
    setAvailLoading(true);
    try{
      const slots=next?[{start:availData.weekly_hours[day]?.start||"09:00",end:availData.weekly_hours[day]?.end||"17:00"}]:[];
      await fetch(`${BASE}/api/worker/${worker.email}/availability/hours/day`,{method:"PATCH",headers:authH(token),body:JSON.stringify({day,slots})});
    }catch{}
    setAvailLoading(false);
  };

  const markDirty=()=>setSkillsDirty(true);
  const updateSubPrice=(si,bi,price)=>{setEditSkills(prev=>{const c=JSON.parse(JSON.stringify(prev));c[si].subSkills[bi].price=price;return c;});markDirty();};
  const toggleSub=(si,subName)=>{
    setEditSkills(prev=>{
      const c=JSON.parse(JSON.stringify(prev));const subs=c[si].subSkills;
      const idx=subs.findIndex(s=>s.name===subName);
      if(idx>=0)subs.splice(idx,1);else subs.push({name:subName,price:0});
      return c;
    });markDirty();
  };
  const removeSkill=(si)=>{setEditSkills(prev=>prev.filter((_,i)=>i!==si));markDirty();};

  const handleSkillsSave=async()=>{
    setSkillsError("");
    for(const sk of editSkills){
      if(!sk.subSkills?.length){setSkillsError(`"${sk.name}" needs at least one job type`);return;}
      if(sk.subSkills.some(s=>!s.price||parseFloat(s.price)<=0)){setSkillsError(`Set a price > 0 for every job type under "${sk.name}"`);return;}
    }
    if(!worker?.email)return;
    setSkillsSaving(true);
    try{
      const res=await fetch(`${BASE}/api/worker/${encodeURIComponent(worker.email)}`,{
        method:"PATCH",headers:authH(token),body:JSON.stringify({skills:editSkills}),
      });
      if(res.ok){
        setSkillsDirty(false);setSkillsSaved(true);setTimeout(()=>setSkillsSaved(false),2500);
        showToast("Skills saved successfully");
        await refreshWorkerSkills(worker.email, token);
      }else{
        const e=await res.json().catch(()=>({}));
        setSkillsError(e.detail||"Failed to save skills");
        showToast("Failed to save skills",false);
      }
    }catch{setSkillsError("Network error");showToast("Network error",false);}
    setSkillsSaving(false);
  };

  const cancelAdd=()=>{setAddingSkill(false);setNewSkillCat("");setNewSubSels([]);setNewSubPrices({});setAddSkillErr("");};
  const confirmAddSkill=()=>{
    setAddSkillErr("");
    if(!newSkillCat){setAddSkillErr("Choose a category");return;}
    if(!newSubSels.length){setAddSkillErr("Select at least one job type");return;}
    if(newSubSels.some(s=>!newSubPrices[s]||parseFloat(newSubPrices[s])<=0)){setAddSkillErr("Set a price > 0 for each job type");return;}
    if(editSkills.some(s=>s.name===newSkillCat)){setAddSkillErr("This skill is already added");return;}
    setEditSkills(prev=>[...prev,{name:newSkillCat,subSkills:newSubSels.map(s=>({name:s,price:parseFloat(newSubPrices[s])}))}]);
    markDirty();cancelAdd();
  };

  const handleEvidenceFile=(skillName,file)=>{
    const ok=file.type?.startsWith("image/")||file.type?.startsWith("video/")||file.type==="application/pdf"||file.name?.toLowerCase().endsWith(".pdf");
    if(!ok){setEvidenceErrors(p=>({...p,[skillName]:"Only PDF, image, or video"}));return;}
    setEvidenceErrors(p=>{const n={...p};delete n[skillName];return n;});
    setEvidenceFiles(p=>({...p,[skillName]:file}));
  };

  const uploadEvidenceNow=async(skillName)=>{
    const file=evidenceFiles[skillName];
    if(!file||!worker?.email)return;
    setEvidenceLoading(p=>({...p,[skillName]:true}));
    try{
      const fd=new FormData();
      fd.append("file", file);
      fd.append("worker_id", worker.email);
      fd.append("skill_name", skillName); // ← matches backend field name
      const res=await fetch(`${BASE}/api/upload/skill-evidence`,{method:"POST",body:fd});
      if(res.ok){
        setEvidenceFiles(p=>{const n={...p};delete n[skillName];return n;});
        showToast(`Evidence for "${skillName}" uploaded`);
        // Refresh skills to get updated evidence + status from DB
        await refreshWorkerSkills(worker.email, token);
      }else{
        const e=await res.json().catch(()=>({}));
        setEvidenceErrors(p=>({...p,[skillName]:e.detail||"Upload failed"}));
        showToast("Upload failed",false);
      }
    }catch{
      setEvidenceErrors(p=>({...p,[skillName]:"Network error"}));
      showToast("Network error",false);
    }
    setEvidenceLoading(p=>({...p,[skillName]:false}));
  };

  if(loading) return(
    <div style={{background:C.bg,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif"}}>
      <div style={{textAlign:"center"}}>
        <div style={{width:44,height:44,borderRadius:"50%",background:C.orangeLight,border:`1.5px solid ${C.orangeBorder}`,margin:"0 auto 16px",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{width:28,height:28,border:`2px solid ${C.orangeBorder}`,borderTopColor:C.orange,borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>
        </div>
        <div style={{fontSize:14,color:C.textLight}}>Loading profile...</div>
      </div>
    </div>
  );

  if(!worker) return(
    <div style={{background:C.bg,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12,fontFamily:"'DM Sans',sans-serif"}}>
      <div style={{fontSize:16,fontWeight:600,color:C.text}}>No worker session found</div>
      <div style={{fontSize:13,color:C.textLight}}>Please log in as a worker first</div>
    </div>
  );

  const displayName=`${firstName} ${lastName}`.trim()||email;
  const initialsVal=initials(firstName,lastName);
  const avgRating=reviews.length?(reviews.reduce((s,r)=>s+(r.stars||r.rating||0),0)/reviews.length).toFixed(1):Number(ratings||0).toFixed(1);
  const stars=Math.min(5,Math.round(Number(avgRating)));
  const availSubs=newSkillCat?(CATEGORY_SKILLS_MAP[newSkillCat]||[]):[];
  const TABS=[
    {key:"profile",label:"Profile",icon:"👤"},
    {key:"skills",label:"Skills",icon:"🛠️",badge:skillsDirty},
    {key:"availability",label:"Availability",icon:"📅"},
    {key:"reviews",label:"Reviews",icon:"⭐",count:reviews.length},
    {key:"reports",label:"Reports",icon:"⚠️",count:reports.length},
  ];

  return(
    <>
      <Toast toast={toast}/>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');
        *{box-sizing:border-box;}
        .ws-root{font-family:'DM Sans',-apple-system,sans-serif;}
        .ws-tab:hover{background:${C.orangeLight}!important;color:${C.orangeDeep}!important;}
        .ws-photo:hover .ws-overlay{opacity:1!important;}
        .ws-row:hover{background:${C.orangeLight}66;}
        input:focus,textarea:focus,select:focus{border-color:${C.orange}!important;box-shadow:0 0 0 3px ${C.orange}22!important;outline:none;}
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}
        @keyframes slideIn{from{opacity:0;transform:translateX(16px);}to{opacity:1;transform:translateX(0);}}
        .ws-panel{animation:fadeIn 0.18s ease;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-thumb{background:${C.border};border-radius:4px;}
      `}</style>

      <div className="ws-root" style={{background:C.bg,minHeight:"100vh",padding:"28px 32px 60px"}}>
        <div style={{maxWidth:1080,margin:"0 auto",display:"flex",gap:22,alignItems:"flex-start",flexWrap:"wrap"}}>

          {/* SIDEBAR */}
          <div style={{width:272,flexShrink:0}}>
            <div style={{background:C.surface,borderRadius:16,border:`1px solid ${C.border}`,overflow:"hidden",boxShadow:"0 2px 10px rgba(0,0,0,0.06)"}}>
              <div style={{height:76,background:`linear-gradient(135deg,${C.orange} 0%,${C.orangeDark} 100%)`,position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",inset:0,opacity:0.1,backgroundImage:"radial-gradient(circle,white 1px,transparent 1px)",backgroundSize:"16px 16px"}}/>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"0 20px 22px"}}>
                <div className="ws-photo" style={{position:"relative",cursor:"pointer",marginTop:-48}} onClick={()=>fileRef.current?.click()}>
                  <div style={{width:96,height:96,borderRadius:"50%",background:`linear-gradient(135deg,${C.orange},${C.orangeDark})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,fontWeight:800,color:"white",overflow:"hidden",border:"3px solid white",boxShadow:`0 4px 20px ${C.orange}55`}}>
                    {avatar?<img src={avatar} alt="avatar" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:initialsVal}
                  </div>
                  <div className="ws-overlay" style={{position:"absolute",inset:0,borderRadius:"50%",background:"rgba(0,0,0,0.42)",display:"flex",alignItems:"center",justifyContent:"center",opacity:0,transition:"opacity 0.18s",border:"3px solid white"}}>
                    {avatarUploading
                      ?<div style={{width:18,height:18,border:"2.5px solid white",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>
                      :<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>}
                  </div>
                </div>
                <div style={{marginTop:12,fontSize:17,fontWeight:700,color:C.text,textAlign:"center",lineHeight:1.3}}>{displayName}</div>
                {email&&<div style={{fontSize:12.5,color:C.textLight,marginTop:4,textAlign:"center"}}>{email}</div>}
                {taskType&&<div style={{fontSize:12,color:C.orangeDeep,fontWeight:600,marginTop:3}}>{taskType}</div>}
                {worker.registeredAt&&<div style={{fontSize:11.5,color:C.textLight,marginTop:2}}>Member since {fmtMonth(worker.registeredAt)}</div>}
                <button onClick={()=>fileRef.current?.click()} disabled={avatarUploading}
                  style={{marginTop:14,padding:"7px 18px",borderRadius:8,fontSize:12,fontWeight:600,color:C.orangeDeep,background:C.orangeLight,border:`1.5px solid ${C.orangeBorder}`,cursor:avatarUploading?"not-allowed":"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6}}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  {avatarUploading?"Uploading…":"Change Photo"}
                </button>
                <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{display:"none"}}/>
                <div onClick={handleToggleAvailability}
                  style={{marginTop:16,display:"inline-flex",alignItems:"center",gap:8,padding:"8px 18px",borderRadius:40,cursor:"pointer",background:isAvailable?C.greenLight:C.redLight,border:`1.5px solid ${isAvailable?C.green:C.red}`,transition:"all 0.15s"}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:isAvailable?C.green:C.red}}/>
                  <span style={{fontSize:12.5,fontWeight:600,color:isAvailable?C.green:C.red}}>{isAvailable?"Available for work":"Unavailable"}</span>
                </div>
              </div>
              <div style={{height:1,background:C.divider}}/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr"}}>
                {[
                  {label:"Tasks",value:completedTasks,color:C.orange},
                  {label:"Rating",value:Number(avgRating)>0?`${avgRating}★`:"—",color:C.green},
                  {label:"Reviews",value:reviews.length,color:C.orangeDark},
                ].map((s,i)=>(
                  <div key={s.label} style={{textAlign:"center",padding:"16px 0",borderRight:i<2?`1px solid ${C.divider}`:"none"}}>
                    <div style={{fontSize:22,fontWeight:800,color:s.color,lineHeight:1}}>{s.value}</div>
                    <div style={{fontSize:10,color:C.textLight,marginTop:4,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em"}}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{height:1,background:C.divider}}/>
              <div style={{padding:"16px 20px"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                  <div style={{width:5,height:5,borderRadius:"50%",background:C.green}}/>
                  <div style={{fontSize:11,fontWeight:700,color:C.textLight,textTransform:"uppercase",letterSpacing:"0.07em"}}>Total Earnings</div>
                </div>
                <div style={{fontSize:24,fontWeight:800,color:C.text}}>NPR {Number(totalEarnings).toLocaleString()}</div>
              </div>
              <div style={{height:1,background:C.divider}}/>
              <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:10}}>
                {[
                  {label:"Face Verification",ok:worker.face_verified,no:"Pending"},
                  {label:"Skill Verification",ok:worker.skill_verified==="accepted",no:worker.skill_verified==="pending"?"Under Review":"Not Submitted"},
                ].map(row=>(
                  <div key={row.label} style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <span style={{fontSize:12,color:C.textMid}}>{row.label}</span>
                    <span style={{padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:600,background:row.ok?C.greenLight:C.orangeLight,color:row.ok?C.green:C.orangeDeep}}>{row.ok?"Verified ✓":row.no}</span>
                  </div>
                ))}
                {worker.status==="suspended"&&<div style={{marginTop:4,padding:"8px 12px",background:C.redLight,borderRadius:8,fontSize:12,color:C.red,textAlign:"center"}}>⚠️ Account Suspended</div>}
              </div>
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div style={{flex:1,minWidth:0}}>
            <div style={{background:C.surface,borderRadius:16,border:`1px solid ${C.border}`,boxShadow:"0 2px 10px rgba(0,0,0,0.06)",overflow:"hidden"}}>

              {/* Tabs */}
              <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,padding:"0 6px",background:"#fafaf9",gap:2,overflowX:"auto"}}>
                {TABS.map(t=>(
                  <button key={t.key} className="ws-tab" onClick={()=>setTab(t.key)} style={{padding:"14px 18px",background:"none",border:"none",borderBottom:`2.5px solid ${tab===t.key?C.orange:"transparent"}`,cursor:"pointer",fontSize:13.5,fontWeight:tab===t.key?700:500,color:tab===t.key?C.orangeDeep:C.textMid,fontFamily:"inherit",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:7,marginBottom:-1,borderRadius:"6px 6px 0 0",transition:"color 0.15s,background 0.15s"}}>
                    <span>{t.icon}</span>{t.label}
                    {t.badge&&<span style={{marginLeft:4,width:8,height:8,borderRadius:"50%",background:C.orange,flexShrink:0}}/>}
                    {t.count>0&&<span style={{fontSize:10.5,fontWeight:700,minWidth:18,height:18,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",background:tab===t.key?C.orange:C.border,color:tab===t.key?"white":C.textMid,padding:"0 5px"}}>{t.count}</span>}
                  </button>
                ))}
              </div>

              {/* ── PROFILE TAB ── */}
              {tab==="profile"&&(
                <div className="ws-panel">
                  <div style={{padding:"20px 28px 12px",fontSize:11,fontWeight:700,color:C.textLight,textTransform:"uppercase",letterSpacing:"0.09em"}}>Personal Information</div>
                  {[
                    {label:"Full Name",content:(
                      <div style={{display:"flex",gap:8}}>
                        <input value={firstName} onChange={e=>setFirstName(e.target.value)} placeholder="First name" style={{...inputSx,flex:1}}/>
                        <input value={lastName} onChange={e=>setLastName(e.target.value)} placeholder="Last name" style={{...inputSx,flex:1}}/>
                      </div>
                    )},
                    {label:"Email Address",content:(
                      <span style={{fontSize:13.5,color:C.text,display:"inline-flex",alignItems:"center",gap:8}}>
                        {email}
                        <span style={{fontSize:10,fontWeight:700,color:C.green,background:C.greenLight,border:`1px solid ${C.greenBorder}`,borderRadius:10,padding:"1px 7px"}}>Verified</span>
                      </span>
                    )},
                    {label:"Phone Number",content:<span style={{fontSize:13.5,color:phoneNo?C.text:C.textLight,fontStyle:phoneNo?"normal":"italic"}}>{phoneNo||"Not added"}</span>},
                    {label:"Service Category",content:(
                      <select value={taskType} onChange={e=>setTaskType(e.target.value)} style={{...inputSx,width:"auto",minWidth:180}}>
                        <option value="">Select category…</option>
                        {ALL_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                      </select>
                    )},
                    {label:"Address",content:<input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Enter address" style={{...inputSx}}/>},
                    {label:"Base Rate (NPR/hr)",content:(
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontSize:13,color:C.textLight}}>NPR</span>
                        <input type="number" value={basePrice} onChange={e=>setBasePrice(e.target.value)} placeholder="Rate per hour" style={{...inputSx,width:140}}/>
                        <span style={{fontSize:13,color:C.textLight}}>/hr</span>
                      </div>
                    )},
                    {label:"Min. Booking (hrs)",content:<input type="number" min="1" max="24" value={minHours} onChange={e=>setMinHours(e.target.value)} style={{...inputSx,width:100}}/>},
                  ].map((row,i,arr)=>(
                    <div key={row.label}>
                      <div className="ws-row" style={{padding:"15px 28px",display:"flex",alignItems:"center",gap:16,transition:"background 0.12s"}}>
                        <div style={{width:170,flexShrink:0,fontSize:12.5,fontWeight:600,color:C.textLight}}>{row.label}</div>
                        <div style={{flex:1}}>{row.content}</div>
                      </div>
                      {i<arr.length-1&&<div style={{height:1,background:C.divider,margin:"0 28px"}}/>}
                    </div>
                  ))}
                  <div style={{padding:"18px 28px"}}>
                    <div style={{fontSize:12,fontWeight:600,color:C.textLight,marginBottom:10}}>Service Areas</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                      {SERVICE_AREAS.map(area=>{
                        const on=serviceAreas.includes(area);
                        return(
                          <button key={area} onClick={()=>setServiceAreas(p=>p.includes(area)?p.filter(a=>a!==area):[...p,area])}
                            style={{padding:"6px 14px",borderRadius:20,cursor:"pointer",fontSize:12.5,fontWeight:on?600:400,border:`1.5px solid ${on?C.orange:C.border}`,background:on?C.orangeLight:C.surface,color:on?C.orangeDeep:C.textMid,fontFamily:"inherit",transition:"all 0.15s"}}>
                            {on&&"✓ "}{area}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{height:1,background:C.divider,margin:"0 28px"}}/>
                  <div style={{padding:"18px 28px"}}>
                    <div style={{fontSize:12,fontWeight:600,color:C.textLight,marginBottom:8}}>Bio / Description</div>
                    <textarea value={description} onChange={e=>setDescription(e.target.value)} rows={4} style={{...inputSx,resize:"vertical"}} placeholder="Describe your experience and what makes you great..."/>
                    <div style={{fontSize:11,color:C.textLight,marginTop:4,textAlign:"right"}}>{description.length}/500</div>
                  </div>
                  <div style={{padding:"0 28px 24px",display:"flex",justifyContent:"flex-end"}}>
                    <button onClick={handleProfileSave} disabled={profileSaving}
                      style={{padding:"9px 24px",borderRadius:9,background:`linear-gradient(135deg,${C.orange},${C.orangeDark})`,color:"white",border:"none",fontSize:13,fontWeight:600,cursor:profileSaving?"not-allowed":"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:8,opacity:profileSaving?0.75:1}}>
                      {profileSaving?<><Spinner/>Saving…</>:profileSaved?"✓ Saved!":"Save Changes"}
                    </button>
                  </div>
                </div>
              )}

              {/* ── SKILLS TAB ── */}
              {tab==="skills"&&(
                <div className="ws-panel">
                  <div style={{padding:"18px 28px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
                    <div>
                      <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:3}}>Your Skills & Services</div>
                      <div style={{fontSize:12.5,color:C.textLight}}>Add services you offer and set your rates per job type</div>
                    </div>
                    {!addingSkill&&<button onClick={()=>setAddingSkill(true)} style={{padding:"9px 20px",borderRadius:9,background:C.orangeLight,color:C.orangeDeep,border:`1.5px solid ${C.orangeBorder}`,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>+ Add Skill</button>}
                  </div>

                  {skillsError&&<div style={{margin:"16px 28px",padding:"10px 14px",background:C.redLight,border:`1px solid ${C.redBorder}`,borderRadius:8,fontSize:13,color:C.red}}>{skillsError}</div>}
                  {editSkills.length===0&&!addingSkill&&<EmptyState title="No skills added yet" sub="Add your skills so customers can find and book you"/>}

                  {editSkills.map((sk,si)=>{
                    const catSubs=CATEGORY_SKILLS_MAP[sk.name]||[];
                    const selSubNames=sk.subSkills?.map(s=>s.name)||[];

                    // Find per-subskill evidence data from the flat skills stored in DB
                    // For category-level evidence we look at the first subskill that has evidence
                    // (since we upload at category level, not sub-skill level)
                    const evidenceSkillData = sk.subSkills?.find(s => s.evidenceUrl) || null;

                    return(
                      <div key={si} style={{borderBottom:`1px solid ${C.border}`}}>
                        <div style={{padding:"18px 28px",background:C.bg}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12,marginBottom:16}}>
                            <div style={{display:"flex",alignItems:"center",gap:10}}>
                              <div style={{width:8,height:8,borderRadius:"50%",background:C.orange}}/>
                              <span style={{fontSize:16,fontWeight:700,color:C.text}}>{sk.name}</span>
                              <span style={{fontSize:12,color:C.textLight,background:C.surface,padding:"2px 10px",borderRadius:20,border:`1px solid ${C.border}`}}>{sk.subSkills?.length||0} service{sk.subSkills?.length!==1?"s":""}</span>
                            </div>
                            <button onClick={()=>removeSkill(si)} style={{padding:"6px 14px",borderRadius:8,background:"none",border:`1.5px solid ${C.border}`,color:C.textMid,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Remove</button>
                          </div>

                          {catSubs.length>0&&(
                            <div style={{marginBottom:16}}>
                              <div style={{fontSize:11,fontWeight:700,color:C.textLight,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:10}}>Service Types</div>
                              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                                {catSubs.map(sub=>{
                                  const on=selSubNames.includes(sub);
                                  return(<button key={sub} onClick={()=>toggleSub(si,sub)} style={{padding:"6px 14px",borderRadius:20,cursor:"pointer",fontSize:12.5,fontWeight:on?600:400,border:`1.5px solid ${on?C.orange:C.border}`,background:on?C.orangeLight:C.surface,color:on?C.orangeDeep:C.textMid,fontFamily:"inherit",transition:"all 0.15s"}}>{on&&"✓ "}{sub}</button>);
                                })}
                              </div>
                            </div>
                          )}

                          {sk.subSkills?.length>0&&(
                            <div>
                              <div style={{fontSize:11,fontWeight:700,color:C.textLight,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:10}}>Set Your Rates (NPR/hr)</div>
                              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                                {sk.subSkills.map((sub,bi)=>(
                                  <div key={bi} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:C.surface,borderRadius:8,border:`1px solid ${C.border}`,flexWrap:"wrap",gap:8}}>
                                    <span style={{fontSize:13,fontWeight:500,color:C.text}}>{sub.name}</span>
                                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                                      <span style={{fontSize:11,color:C.textLight,fontWeight:700}}>NPR</span>
                                      <input type="number" min="1" step="50" placeholder="500" value={sub.price||""} onChange={e=>updateSubPrice(si,bi,e.target.value)}
                                        style={{width:90,padding:"7px 10px",borderRadius:8,border:`1.5px solid ${(!sub.price||sub.price<=0)?C.red:C.border}`,fontSize:13,outline:"none",textAlign:"right",fontFamily:"inherit",transition:"border-color 0.15s"}}/>
                                      <span style={{fontSize:11,color:C.textLight}}>/hr</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Evidence section — one per skill category */}
                          <EvidenceSection
                            skillName={sk.name}
                            skillData={evidenceSkillData}
                            pending={evidenceFiles[sk.name]}
                            err={evidenceErrors[sk.name]}
                            loading={evidenceLoading[sk.name]||false}
                            onFile={f=>handleEvidenceFile(sk.name,f)}
                            onUpload={()=>uploadEvidenceNow(sk.name)}
                            onClear={()=>setEvidenceFiles(p=>{const n={...p};delete n[sk.name];return n;})}
                          />
                        </div>
                      </div>
                    );
                  })}

                  {/* Add Skill Form */}
                  {addingSkill&&(
                    <div style={{padding:"24px 28px",borderTop:`1px solid ${C.border}`,background:C.orangeLight}}>
                      <div style={{fontSize:14,fontWeight:700,color:C.orangeDeep,marginBottom:16}}>➕ Add New Skill</div>
                      {addSkillErr&&<div style={{marginBottom:16,padding:"10px 14px",background:C.redLight,border:`1px solid ${C.redBorder}`,borderRadius:8,fontSize:13,color:C.red}}>{addSkillErr}</div>}
                      <div style={{marginBottom:16}}>
                        <div style={{fontSize:12,fontWeight:600,color:C.textLight,marginBottom:8}}>Service Category</div>
                        <select value={newSkillCat} onChange={e=>{setNewSkillCat(e.target.value);setNewSubSels([]);setNewSubPrices({});}} style={{...inputSx}}>
                          <option value="">Select a category…</option>
                          {ALL_CATEGORIES.filter(c=>!editSkills.some(s=>s.name===c)).map(c=><option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      {newSkillCat&&(
                        <>
                          <div style={{marginBottom:16}}>
                            <div style={{fontSize:12,fontWeight:600,color:C.textLight,marginBottom:8}}>Select Service Types</div>
                            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                              {availSubs.map(sub=>{
                                const on=newSubSels.includes(sub);
                                return(<button key={sub} type="button"
                                  onClick={()=>{setNewSubSels(p=>p.includes(sub)?p.filter(s=>s!==sub):[...p,sub]);if(newSubPrices[sub])setNewSubPrices(p=>{const n={...p};delete n[sub];return n;});}}
                                  style={{padding:"6px 14px",borderRadius:20,cursor:"pointer",fontSize:12.5,fontWeight:on?600:400,border:`1.5px solid ${on?C.orange:C.border}`,background:on?C.orangeLight:C.surface,color:on?C.orangeDeep:C.textMid,fontFamily:"inherit"}}>{on&&"✓ "}{sub}</button>);
                              })}
                            </div>
                          </div>
                          {newSubSels.length>0&&(
                            <div style={{marginBottom:16}}>
                              <div style={{fontSize:12,fontWeight:600,color:C.textLight,marginBottom:8}}>Set Your Rates (NPR/hr)</div>
                              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                                {newSubSels.map(sub=>(
                                  <div key={sub} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:C.surface,borderRadius:8,border:`1px solid ${C.border}`,flexWrap:"wrap",gap:8}}>
                                    <span style={{fontSize:13,fontWeight:500,color:C.text}}>{sub}</span>
                                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                                      <span style={{fontSize:11,color:C.textLight,fontWeight:700}}>NPR</span>
                                      <input type="number" min="1" step="50" placeholder="500" value={newSubPrices[sub]||""} onChange={e=>setNewSubPrices(p=>({...p,[sub]:e.target.value}))}
                                        style={{width:90,padding:"7px 10px",borderRadius:8,border:`1.5px solid ${(!newSubPrices[sub]||newSubPrices[sub]<=0)?C.red:C.border}`,fontSize:13,outline:"none",textAlign:"right",fontFamily:"inherit"}}/>
                                      <span style={{fontSize:11,color:C.textLight}}>/hr</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
                        <button onClick={cancelAdd} style={{padding:"9px 20px",borderRadius:9,background:"none",border:`1.5px solid ${C.border}`,color:C.textMid,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
                        <button onClick={confirmAddSkill} style={{padding:"9px 20px",borderRadius:9,background:`linear-gradient(135deg,${C.orange},${C.orangeDark})`,color:"white",border:"none",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Add Skill</button>
                      </div>
                    </div>
                  )}

                  {editSkills.length>0&&(
                    <div style={{padding:"20px 28px",borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
                      {skillsDirty
                        ?<span style={{fontSize:12,color:C.orangeDeep,fontWeight:600}}>⚠ You have unsaved changes</span>
                        :<span style={{fontSize:12,color:C.green,fontWeight:600}}>✓ All skills saved</span>}
                      <button onClick={handleSkillsSave} disabled={skillsSaving||!skillsDirty}
                        style={{padding:"9px 24px",borderRadius:9,background:`linear-gradient(135deg,${C.orange},${C.orangeDark})`,color:"white",border:"none",fontSize:13,fontWeight:600,cursor:(skillsSaving||!skillsDirty)?"not-allowed":"pointer",fontFamily:"inherit",opacity:(skillsSaving||!skillsDirty)?0.6:1,display:"flex",alignItems:"center",gap:8}}>
                        {skillsSaving?<><Spinner/>Saving…</>:skillsSaved?"✓ Saved!":"Save Skills"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── AVAILABILITY TAB ── */}
              {tab==="availability"&&(
                <div className="ws-panel">
                  <div style={{padding:"18px 28px",borderBottom:`1px solid ${C.border}`}}>
                    <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:3}}>Weekly Availability</div>
                    <div style={{fontSize:12.5,color:C.textLight}}>Toggle the days you're available. Changes sync immediately.</div>
                  </div>
                  {availLoading&&<div style={{margin:"16px 28px",padding:"10px 14px",background:C.orangeLight,border:`1px solid ${C.orangeBorder}`,borderRadius:8,fontSize:13,color:C.orangeDeep}}>Updating…</div>}
                  {availData?.weekly_hours?(
                    <div style={{padding:"20px 28px"}}>
                      {Object.entries(availData.weekly_hours).map(([day,info])=>(
                        <div key={day} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",background:info.enabled?C.greenLight:C.bg,borderRadius:10,border:`1px solid ${info.enabled?C.greenBorder:C.border}`,marginBottom:8,transition:"all 0.2s"}}>
                          <div>
                            <span style={{fontSize:14,fontWeight:600,color:info.enabled?C.green:C.textMid}}>{day}</span>
                            {info.enabled&&info.slots?.length>0&&(
                              <span style={{fontSize:12,color:C.textLight,marginLeft:12}}>{info.slots.map(s=>`${s.start}–${s.end}`).join(", ")}</span>
                            )}
                          </div>
                          <Toggle checked={info.enabled} onChange={()=>handleDayToggle(day)}/>
                        </div>
                      ))}
                    </div>
                  ):<EmptyState title="No schedule set" sub="Your availability schedule will appear here"/>}
                </div>
              )}

              {/* ── REVIEWS TAB ── */}
              {tab==="reviews"&&(
                <div className="ws-panel">
                  {reviewsLoading?(
                    <div style={{padding:"40px",textAlign:"center",display:"flex",justifyContent:"center"}}><Spinner size={24} color={C.orange}/></div>
                  ):reviews.length>0?(
                    <>
                      <div style={{padding:"20px 28px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:20,background:C.orangeLight}}>
                        <div style={{textAlign:"center"}}>
                          <div style={{fontSize:40,fontWeight:800,color:C.orange,lineHeight:1}}>{avgRating}</div>
                          <div style={{fontSize:10.5,color:C.textLight,marginTop:4,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em"}}>avg rating</div>
                        </div>
                        <div style={{width:1,height:44,background:C.orangeBorder}}/>
                        <div>
                          <div style={{fontSize:"1.3rem",color:"#f0a500",marginBottom:4}}>{"★".repeat(stars)}{"☆".repeat(5-stars)}</div>
                          <div style={{fontSize:13.5,color:C.textMid}}>You have received <strong style={{color:C.text}}>{reviews.length} review{reviews.length>1?"s":""}</strong> from customers.</div>
                        </div>
                      </div>
                      {reviews.map((rev,i)=>{
                        const rating=rev.stars||rev.rating||0;
                        const reviewerName=(rev.first_name||rev.last_name)?`${rev.first_name||""} ${rev.last_name||""}`.trim():rev.customerName||"Anonymous Customer";
                        return(
                          <div key={rev._id||i}>
                            {i>0&&<div style={{height:1,background:C.divider,margin:"0 28px"}}/>}
                            <div className="ws-row" style={{padding:"18px 28px"}}>
                              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                                <div>
                                  <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:3}}>{reviewerName}</div>
                                  <div style={{fontSize:12,color:C.textLight}}>{fmtDate(rev.createdAt)}</div>
                                </div>
                                <div style={{display:"flex",gap:2,alignItems:"center"}}>
                                  {[1,2,3,4,5].map(n=><span key={n} style={{fontSize:17,color:n<=rating?C.orange:C.border,lineHeight:1}}>★</span>)}
                                  <span style={{marginLeft:6,fontSize:12.5,fontWeight:700,color:C.orangeDeep}}>{rating}/5</span>
                                </div>
                              </div>
                              {rev.text||rev.comment
                                ?<p style={{margin:0,fontSize:13.5,color:C.textMid,lineHeight:1.75}}>{rev.text||rev.comment}</p>
                                :<p style={{margin:0,fontSize:13,color:C.textLight,fontStyle:"italic"}}>No comment left</p>}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  ):<EmptyState title="No reviews yet" sub="Reviews from customers will appear here once you complete tasks."/>}
                </div>
              )}

              {/* ── REPORTS TAB ── */}
              {tab==="reports"&&(
                <div className="ws-panel">
                  <div style={{padding:"18px 28px",borderBottom:`1px solid ${C.border}`}}>
                    <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:3}}>Reports & Complaints</div>
                    <div style={{fontSize:12.5,color:C.textLight}}>Reports filed against you appear here for full transparency.</div>
                  </div>
                  {reportsLoading?(
                    <div style={{padding:"40px",textAlign:"center",display:"flex",justifyContent:"center"}}><Spinner size={24} color={C.orange}/></div>
                  ):reports.length===0?<EmptyState title="No reports filed" sub="No complaints have been filed against you. Keep up the great work!"/>:
                  reports.map((r,i)=>{
                    const sColor=r.status==="resolved"?C.green:r.status==="declined"?C.red:C.orangeDeep;
                    const sBg=r.status==="resolved"?C.greenLight:r.status==="declined"?C.redLight:C.orangeLight;
                    const sBd=r.status==="resolved"?C.greenBorder:r.status==="declined"?C.redBorder:C.orangeBorder;
                    return(
                      <div key={r._id||i}>
                        {i>0&&<div style={{height:1,background:C.divider,margin:"0 28px"}}/>}
                        <div className="ws-row" style={{padding:"18px 28px"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                            <div style={{fontSize:14,fontWeight:600,color:C.text}}>{r.reason||"Report"}</div>
                            <span style={{fontSize:11,fontWeight:700,color:sColor,background:sBg,border:`1px solid ${sBd}`,padding:"3px 10px",borderRadius:20,flexShrink:0,marginLeft:12}}>
                              {r.status==="resolved"?"Resolved":r.status==="declined"?"Declined":"Under Review"}
                            </span>
                          </div>
                          {r.description&&<p style={{margin:"0 0 10px",fontSize:13.5,color:C.textMid,lineHeight:1.7}}>{r.description}</p>}
                          <div style={{fontSize:12,color:C.textLight}}>Filed {fmtDate(r.createdAt)}</div>
                          {r.adminNote&&(
                            <div style={{marginTop:12,padding:"12px 16px",background:C.bg,borderRadius:10,border:`1px solid ${C.border}`}}>
                              <div style={{fontSize:10.5,fontWeight:700,color:C.textLight,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:5}}>Response from Kaam-ly</div>
                              <div style={{fontSize:13.5,color:C.textMid,lineHeight:1.65}}>{r.adminNote}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div style={{height:12}}/>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </>
  );
}
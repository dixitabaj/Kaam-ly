// import { useState, useMemo } from "react";

// // ── SVG Icon set ──────────────────────────────────────────────────────────────
// const Icon = ({ name, size = 16, color = "currentColor" }) => {
//   const icons = {
//     ac: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="10" rx="2"/><path d="M8 16v2M12 16v2M16 16v2M6 11h.01M10 11h4M18 11h.01"/></svg>,
//     plumbing: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v12M6 15a3 3 0 1 0 6 0v-3h6V9H12V6H6"/><circle cx="6" cy="18" r="2"/></svg>,
//     electrical: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
//     cleaning: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M3 7V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2M3 7h18M7 21V7M17 21V7M12 7v14"/></svg>,
//     carpentry: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
//     painting: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 13.5V20a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-1h10v1a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-6.5"/><path d="M2 13.5A8.5 8.5 0 0 1 10.5 5H20l1 4-1 4H10.5A8.5 8.5 0 0 1 2 13.5z"/></svg>,
//     appliance: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M15 2v20M9 7h1M9 12h1M9 17h1"/></svg>,
//     pest: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c4 0 7-3.5 7-7a7 7 0 1 0-14 0c0 3.5 3 7 7 7z"/><path d="M12 8v8M8 12h8"/></svg>,
//     default: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>,
//     edit: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
//     trash: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
//     search: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
//     plus: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>,
//     grid: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
//     list: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
//     star: <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
//     starEmpty: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
//     close: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>,
//     check: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
//     alert: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><triangle cx="12" cy="12" r="10"/><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
//   };
//   return icons[name] || icons.default;
// };

// // ── Data ──────────────────────────────────────────────────────────────────────
// const ICON_OPTIONS = ["ac","plumbing","electrical","cleaning","carpentry","painting","appliance","pest","default"];

// const INITIAL_CATEGORIES = [
//   { id:1, name:"AC Repair & Service", slug:"ac-repair", iconKey:"ac", color:"#EFF6FF", accent:"#3B82F6", description:"Air conditioner installation, repair, and servicing", basePrice:142, priceUnit:"per visit", isActive:true, isFeatured:true, totalBookings:248, activeWorkers:12, avgRating:4.3, subcategories:["AC Installation","AC Cleaning","Gas Refill","Fan Repair"], createdAt:"2025-01-10" },
//   { id:2, name:"Plumbing", slug:"plumbing", iconKey:"plumbing", color:"#F0FDF4", accent:"#22C55E", description:"Pipe repairs, leakage fixes, tap installation", basePrice:200, priceUnit:"per visit", isActive:true, isFeatured:true, totalBookings:189, activeWorkers:9, avgRating:4.1, subcategories:["Pipe Repair","Tap Replacement","Water Tank","Drain Cleaning"], createdAt:"2025-01-10" },
//   { id:3, name:"Electrical", slug:"electrical", iconKey:"electrical", color:"#FFFBEB", accent:"#F59E0B", description:"Wiring, short circuits, switch and socket installation", basePrice:300, priceUnit:"per visit", isActive:true, isFeatured:false, totalBookings:134, activeWorkers:7, avgRating:4.5, subcategories:["Wiring","MCB/Fuse","Fan Installation","CCTV"], createdAt:"2025-01-15" },
//   { id:4, name:"Cleaning", slug:"cleaning", iconKey:"cleaning", color:"#F5F3FF", accent:"#8B5CF6", description:"Deep cleaning, sofa cleaning, kitchen cleaning", basePrice:500, priceUnit:"per session", isActive:true, isFeatured:true, totalBookings:312, activeWorkers:18, avgRating:4.6, subcategories:["Deep Clean","Sofa Cleaning","Kitchen Clean","Post-construction"], createdAt:"2025-01-10" },
//   { id:5, name:"Carpentry", slug:"carpentry", iconKey:"carpentry", color:"#FFF7ED", accent:"#F97316", description:"Furniture assembly, door and window repairs", basePrice:250, priceUnit:"per visit", isActive:true, isFeatured:false, totalBookings:87, activeWorkers:5, avgRating:4.0, subcategories:["Furniture Assembly","Door Repair","Window Fix","Shelf Install"], createdAt:"2025-02-01" },
//   { id:6, name:"Painting", slug:"painting", iconKey:"painting", color:"#FFF1F2", accent:"#F43F5E", description:"Interior and exterior painting services", basePrice:800, priceUnit:"per room", isActive:false, isFeatured:false, totalBookings:43, activeWorkers:3, avgRating:3.8, subcategories:["Interior","Exterior","Touch-up","Waterproofing"], createdAt:"2025-03-01" },
//   { id:7, name:"Appliance Repair", slug:"appliance-repair", iconKey:"appliance", color:"#ECFDF5", accent:"#10B981", description:"Washing machine, fridge, microwave repair", basePrice:180, priceUnit:"per visit", isActive:true, isFeatured:false, totalBookings:156, activeWorkers:8, avgRating:4.2, subcategories:["Washing Machine","Refrigerator","Microwave","TV Repair"], createdAt:"2025-01-20" },
//   { id:8, name:"Pest Control", slug:"pest-control", iconKey:"pest", color:"#F0F9FF", accent:"#0EA5E9", description:"Cockroach, mosquito, and rodent control treatment", basePrice:1200, priceUnit:"per treatment", isActive:true, isFeatured:false, totalBookings:61, activeWorkers:4, avgRating:4.4, subcategories:["Cockroach Control","Mosquito Spray","Rodent Control","Termite Treatment"], createdAt:"2025-04-01" },
// ];

// const PRICE_UNITS = ["per visit","per hour","per session","per room","per treatment","per sq.ft"];

// // ── Stars ─────────────────────────────────────────────────────────────────────
// function Stars({ rating }) {
//   return (
//     <span style={{ display:"inline-flex", alignItems:"center", gap:2 }}>
//       {[1,2,3,4,5].map(n => (
//         <span key={n}><Icon name={n<=Math.round(rating)?"star":"starEmpty"} size={12} color={n<=Math.round(rating)?"#F59E0B":"#D1D5DB"} /></span>
//       ))}
//       <span style={{ fontSize:12, color:"#6B7280", marginLeft:5 }}>{rating.toFixed(1)}</span>
//     </span>
//   );
// }

// // ── Modal ─────────────────────────────────────────────────────────────────────
// function CategoryModal({ category, onClose, onSave }) {
//   const isNew = !category.id;
//   const [form, setForm] = useState({
//     name: category.name||"",
//     slug: category.slug||"",
//     iconKey: category.iconKey||"default",
//     description: category.description||"",
//     basePrice: category.basePrice||"",
//     priceUnit: category.priceUnit||"per visit",
//     isActive: category.isActive??true,
//     isFeatured: category.isFeatured??false,
//     subcategories: category.subcategories?.join(", ")||"",
//   });

//   const set = (k,v) => setForm(p=>({ ...p,[k]:v, ...(k==="name"&&isNew?{slug:v.toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"")}:{}) }));

//   const inp = { width:"100%", padding:"9px 12px", borderRadius:8, border:"1px solid #E5E7EB", fontSize:13, color:"#111827", fontFamily:"'Inter',sans-serif", outline:"none", background:"#fff", boxSizing:"border-box" };
//   const lbl = { fontSize:12, color:"#374151", fontWeight:600, marginBottom:5, display:"block", fontFamily:"'Inter',sans-serif" };

//   return (
//     <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.3)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }}
//       onClick={e=>e.target===e.currentTarget&&onClose()}>
//       <div style={{ background:"#fff", borderRadius:16, padding:28, width:520, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.15)", border:"1px solid #E5E7EB" }}>
//         <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
//           <h2 style={{ margin:0, fontSize:18, fontWeight:800, color:"#111827", fontFamily:"'Inter',sans-serif" }}>{isNew?"Add Category":"Edit Category"}</h2>
//           <button onClick={onClose} style={{ background:"#F3F4F6", border:"none", borderRadius:8, width:32, height:32, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"#6B7280" }}>
//             <Icon name="close" size={16} color="#6B7280" />
//           </button>
//         </div>

//         {/* Icon picker */}
//         <div style={{ marginBottom:16 }}>
//           <label style={lbl}>Icon</label>
//           <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
//             {ICON_OPTIONS.map(key => (
//               <button key={key} onClick={()=>set("iconKey",key)} style={{
//                 width:42, height:42, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center",
//                 border:`2px solid ${form.iconKey===key?"#2563EB":"#E5E7EB"}`,
//                 background: form.iconKey===key?"#EFF6FF":"#F9FAFB", cursor:"pointer",
//               }}>
//                 <Icon name={key} size={18} color={form.iconKey===key?"#2563EB":"#6B7280"} />
//               </button>
//             ))}
//           </div>
//         </div>

//         <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
//           <div>
//             <label style={lbl}>Category Name *</label>
//             <input style={inp} value={form.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. AC Repair" />
//           </div>
//           <div>
//             <label style={lbl}>Slug</label>
//             <input style={{ ...inp, background:"#F9FAFB", color:"#6B7280" }} value={form.slug} onChange={e=>set("slug",e.target.value)} placeholder="auto-generated" />
//           </div>
//         </div>

//         <div style={{ marginBottom:14 }}>
//           <label style={lbl}>Description</label>
//           <textarea style={{ ...inp, minHeight:68, resize:"vertical" }} value={form.description} onChange={e=>set("description",e.target.value)} placeholder="Briefly describe this service category" />
//         </div>

//         <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
//           <div>
//             <label style={lbl}>Base Price (Rs.)</label>
//             <input type="number" style={inp} value={form.basePrice} onChange={e=>set("basePrice",e.target.value)} placeholder="0" />
//           </div>
//           <div>
//             <label style={lbl}>Price Unit</label>
//             <select style={{ ...inp, cursor:"pointer" }} value={form.priceUnit} onChange={e=>set("priceUnit",e.target.value)}>
//               {PRICE_UNITS.map(u=><option key={u} value={u}>{u}</option>)}
//             </select>
//           </div>
//         </div>

//         <div style={{ marginBottom:16 }}>
//           <label style={lbl}>Subcategories (comma separated)</label>
//           <input style={inp} value={form.subcategories} onChange={e=>set("subcategories",e.target.value)} placeholder="e.g. AC Cleaning, Gas Refill, Fan Repair" />
//         </div>

//         <div style={{ display:"flex", gap:24, marginBottom:22 }}>
//           {[["isActive","Active"],["isFeatured","Featured on homepage"]].map(([key,label])=>(
//             <label key={key} style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", fontSize:13, color:"#374151", fontFamily:"'Inter',sans-serif", fontWeight:500 }}>
//               <input type="checkbox" checked={form[key]} onChange={e=>set(key,e.target.checked)} style={{ accentColor:"#2563EB", width:15, height:15 }} />
//               {label}
//             </label>
//           ))}
//         </div>

//         <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
//           <button onClick={onClose} style={{ padding:"9px 18px", borderRadius:8, border:"1px solid #E5E7EB", background:"#fff", color:"#6B7280", fontSize:13, cursor:"pointer", fontFamily:"'Inter',sans-serif", fontWeight:500 }}>Cancel</button>
//           <button onClick={()=>{
//             if (!form.name.trim()) return;
//             onSave({ ...category, ...form, basePrice:Number(form.basePrice), subcategories:form.subcategories.split(",").map(s=>s.trim()).filter(Boolean), id:category.id||Date.now(), totalBookings:category.totalBookings||0, activeWorkers:category.activeWorkers||0, avgRating:category.avgRating||0, color:category.color||"#F9FAFB", accent:category.accent||"#6B7280", createdAt:category.createdAt||new Date().toISOString().slice(0,10) });
//           }} style={{ padding:"9px 22px", borderRadius:8, border:"none", background:"#2563EB", color:"#fff", fontSize:13, cursor:"pointer", fontWeight:700, fontFamily:"'Inter',sans-serif" }}>
//             {isNew?"Add Category":"Save Changes"}
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

// // ── Delete Confirm ────────────────────────────────────────────────────────────
// function ConfirmDelete({ category, onClose, onConfirm }) {
//   return (
//     <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.3)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }}
//       onClick={e=>e.target===e.currentTarget&&onClose()}>
//       <div style={{ background:"#fff", borderRadius:14, padding:28, width:380, boxShadow:"0 20px 60px rgba(0,0,0,0.15)", border:"1px solid #E5E7EB" }}>
//         <div style={{ width:44, height:44, borderRadius:10, background:"#FEE2E2", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:14 }}>
//           <Icon name="trash" size={20} color="#DC2626" />
//         </div>
//         <h3 style={{ margin:"0 0 8px", fontSize:17, fontWeight:800, color:"#111827", fontFamily:"'Inter',sans-serif" }}>Delete "{category.name}"?</h3>
//         <p style={{ margin:"0 0 22px", fontSize:13, color:"#6B7280", fontFamily:"'Inter',sans-serif", lineHeight:1.6 }}>
//           This will permanently remove this category and its {category.subcategories?.length} subcategories. Workers assigned here won't be affected.
//         </p>
//         <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
//           <button onClick={onClose} style={{ padding:"9px 18px", borderRadius:8, border:"1px solid #E5E7EB", background:"#fff", color:"#6B7280", fontSize:13, cursor:"pointer", fontFamily:"'Inter',sans-serif" }}>Cancel</button>
//           <button onClick={onConfirm} style={{ padding:"9px 18px", borderRadius:8, border:"none", background:"#EF4444", color:"#fff", fontSize:13, cursor:"pointer", fontWeight:700, fontFamily:"'Inter',sans-serif" }}>Delete</button>
//         </div>
//       </div>
//     </div>
//   );
// }

// // ── Toggle switch ─────────────────────────────────────────────────────────────
// function Toggle({ checked, onChange }) {
//   return (
//     <div onClick={onChange} style={{ width:38, height:22, borderRadius:11, background:checked?"#2563EB":"#D1D5DB", cursor:"pointer", position:"relative", transition:"background 0.2s", flexShrink:0 }}>
//       <div style={{ position:"absolute", top:3, left:checked?18:3, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.2)" }} />
//     </div>
//   );
// }

// // ── Main ──────────────────────────────────────────────────────────────────────
// export default function ServiceCategories() {
//   const [categories, setCategories] = useState(INITIAL_CATEGORIES);
//   const [search, setSearch] = useState("");
//   const [filterActive, setFilterActive] = useState("all");
//   const [viewMode, setViewMode] = useState("grid");
//   const [modalCat, setModalCat] = useState(null);
//   const [deleteCat, setDeleteCat] = useState(null);

//   const filtered = useMemo(() => {
//     let c = categories;
//     if (search) { const q=search.toLowerCase(); c=c.filter(x=>x.name.toLowerCase().includes(q)||x.description.toLowerCase().includes(q)||x.subcategories.some(s=>s.toLowerCase().includes(q))); }
//     if (filterActive==="active") c=c.filter(x=>x.isActive);
//     if (filterActive==="inactive") c=c.filter(x=>!x.isActive);
//     if (filterActive==="featured") c=c.filter(x=>x.isFeatured);
//     return c;
//   }, [categories, search, filterActive]);

//   const stats = useMemo(()=>({
//     total: categories.length,
//     active: categories.filter(c=>c.isActive).length,
//     featured: categories.filter(c=>c.isFeatured).length,
//     totalBookings: categories.reduce((s,c)=>s+c.totalBookings,0),
//   }),[categories]);

//   const saveCategory = (cat) => {
//     setCategories(prev => cat.id&&prev.find(c=>c.id===cat.id) ? prev.map(c=>c.id===cat.id?cat:c) : [...prev,cat]);
//     setModalCat(null);
//   };

//   const toggleActive   = (id) => setCategories(prev=>prev.map(c=>c.id===id?{...c,isActive:!c.isActive}:c));
//   const toggleFeatured = (id) => setCategories(prev=>prev.map(c=>c.id===id?{...c,isFeatured:!c.isFeatured}:c));

//   const pill = (active, onClick, label) => (
//     <button onClick={onClick} style={{
//       padding:"6px 14px", borderRadius:20,
//       border: active?"1px solid #BFDBFE":"1px solid #E5E7EB",
//       cursor:"pointer",
//       background: active?"#EFF6FF":"#fff",
//       color: active?"#1D4ED8":"#6B7280",
//       fontSize:13, fontWeight:active?700:500,
//       fontFamily:"'Inter',sans-serif", transition:"all 0.15s",
//     }}>{label}</button>
//   );

//   const th = { padding:"11px 16px", fontSize:11, color:"#9CA3AF", fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", textAlign:"left", fontFamily:"'Inter',sans-serif", background:"#F9FAFB", borderBottom:"1px solid #F3F4F6" };
//   const td = { padding:"14px 16px", fontSize:13, color:"#374151", fontFamily:"'Inter',sans-serif", verticalAlign:"middle" };

//   return (
//     <>
//       <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
//       <div style={{ minHeight:"100vh", background:"#F9FAFB", padding:"28px 32px", fontFamily:"'Inter',sans-serif" }}>

//         {/* Header */}
//         <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 }}>
//           <div>
//             <h1 style={{ fontSize:26, fontWeight:800, color:"#111827", margin:"0 0 6px", letterSpacing:"-0.02em" }}>Service Categories</h1>
//             <p style={{ color:"#6B7280", fontSize:14, margin:0 }}>Manage service types, base pricing, and subcategories offered on Kaam-ly</p>
//           </div>
//           <button onClick={()=>setModalCat({})} style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 18px", borderRadius:10, border:"none", background:"#2563EB", color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"'Inter',sans-serif", boxShadow:"0 1px 4px rgba(37,99,235,0.3)" }}>
//             <Icon name="plus" size={16} color="#fff" />
//             Add Category
//           </button>
//         </div>

//         {/* Stats */}
//         <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:28 }}>
//           {[
//             { label:"TOTAL CATEGORIES", value:stats.total, bg:"#EFF6FF", lc:"#3B82F6", vc:"#1D4ED8" },
//             { label:"ACTIVE", value:stats.active, bg:"#F0FDF4", lc:"#22C55E", vc:"#15803D" },
//             { label:"FEATURED", value:stats.featured, bg:"#FFFBEB", lc:"#F59E0B", vc:"#B45309" },
//             { label:"TOTAL BOOKINGS", value:stats.totalBookings.toLocaleString(), bg:"#F5F3FF", lc:"#A855F7", vc:"#7E22CE" },
//           ].map((s,i)=>(
//             <div key={i} style={{ background:s.bg, borderRadius:14, padding:"20px 22px" }}>
//               <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:s.lc, marginBottom:8 }}>{s.label}</div>
//               <div style={{ fontSize:32, fontWeight:800, color:s.vc, letterSpacing:"-0.02em", lineHeight:1 }}>{s.value}</div>
//             </div>
//           ))}
//         </div>

//         {/* Toolbar */}
//         <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20, flexWrap:"wrap" }}>
//           <div style={{ flex:1, minWidth:240, background:"#fff", borderRadius:10, border:"1px solid #E5E7EB", padding:"10px 14px", display:"flex", alignItems:"center", gap:10, boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
//             <Icon name="search" size={16} color="#9CA3AF" />
//             <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search categories or subcategories…"
//               style={{ flex:1, border:"none", outline:"none", fontSize:14, color:"#111827", fontFamily:"'Inter',sans-serif", background:"transparent" }} />
//             {search && <button onClick={()=>setSearch("")} style={{ background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", color:"#9CA3AF" }}><Icon name="close" size={14} color="#9CA3AF" /></button>}
//           </div>

//           <div style={{ display:"flex", gap:6 }}>
//             {pill(filterActive==="all",  ()=>setFilterActive("all"),      "All")}
//             {pill(filterActive==="active",   ()=>setFilterActive("active"),   "Active")}
//             {pill(filterActive==="inactive", ()=>setFilterActive("inactive"), "Inactive")}
//             {pill(filterActive==="featured", ()=>setFilterActive("featured"), "Featured")}
//           </div>

//           <div style={{ display:"flex", background:"#fff", borderRadius:8, border:"1px solid #E5E7EB", overflow:"hidden" }}>
//             {[["grid","grid"],["table","list"]].map(([v,icon])=>(
//               <button key={v} onClick={()=>setViewMode(v)} style={{ padding:"8px 12px", background:viewMode===v?"#EFF6FF":"#fff", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:viewMode===v?"#2563EB":"#6B7280" }}>
//                 <Icon name={icon} size={16} color={viewMode===v?"#2563EB":"#6B7280"} />
//               </button>
//             ))}
//           </div>
//         </div>

//         {/* GRID VIEW */}
//         {viewMode==="grid" && (
//           <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(300px,1fr))", gap:16 }}>
//             {filtered.map(cat=>(
//               <div key={cat.id} style={{ background:"#fff", borderRadius:14, border:"1px solid #E5E7EB", overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,0.04)", opacity:cat.isActive?1:0.65, transition:"box-shadow 0.15s" }}
//                 onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.09)"}
//                 onMouseLeave={e=>e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.04)"}
//               >
//                 {/* Top band */}
//                 <div style={{ background:cat.color, padding:"16px 18px", display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
//                   <div style={{ display:"flex", alignItems:"center", gap:12 }}>
//                     <div style={{ width:44, height:44, borderRadius:10, background:"#fff", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 1px 3px rgba(0,0,0,0.08)", flexShrink:0 }}>
//                       <Icon name={cat.iconKey} size={22} color={cat.accent} />
//                     </div>
//                     <div>
//                       <div style={{ fontSize:15, fontWeight:800, color:"#111827" }}>{cat.name}</div>
//                       <div style={{ fontSize:11, color:"#9CA3AF", marginTop:1, fontFamily:"'Inter',sans-serif" }}>/{cat.slug}</div>
//                     </div>
//                   </div>
//                   <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:5 }}>
//                     {cat.isFeatured && <span style={{ fontSize:10, background:"#FEF3C7", color:"#B45309", border:"1px solid #FDE68A", padding:"1px 7px", borderRadius:10, fontWeight:700, fontFamily:"'Inter',sans-serif" }}>Featured</span>}
//                     <span style={{ fontSize:11, background:cat.isActive?"#D1FAE5":"#FEE2E2", color:cat.isActive?"#059669":"#DC2626", border:`1px solid ${cat.isActive?"#A7F3D0":"#FECACA"}`, padding:"1px 8px", borderRadius:10, fontWeight:600, fontFamily:"'Inter',sans-serif" }}>
//                       {cat.isActive?"Active":"Inactive"}
//                     </span>
//                   </div>
//                 </div>

//                 <div style={{ padding:"14px 18px" }}>
//                   <p style={{ fontSize:13, color:"#6B7280", margin:"0 0 14px", lineHeight:1.5 }}>{cat.description}</p>

//                   {/* Stats */}
//                   <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:14 }}>
//                     {[{label:"Bookings",value:cat.totalBookings},{label:"Workers",value:cat.activeWorkers},{label:"Base Price",value:`Rs.${cat.basePrice}`}].map((s,i)=>(
//                       <div key={i} style={{ background:"#F9FAFB", borderRadius:8, padding:"8px 10px", border:"1px solid #F3F4F6" }}>
//                         <div style={{ fontSize:15, fontWeight:800, color:"#111827" }}>{s.value}</div>
//                         <div style={{ fontSize:10, color:"#9CA3AF", marginTop:2, fontFamily:"'Inter',sans-serif" }}>{s.label}</div>
//                       </div>
//                     ))}
//                   </div>

//                   <div style={{ marginBottom:12 }}><Stars rating={cat.avgRating} /></div>

//                   {/* Subcategory chips */}
//                   <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:14 }}>
//                     {cat.subcategories.map(s=>(
//                       <span key={s} style={{ fontSize:11, padding:"2px 8px", borderRadius:10, background:cat.color, color:cat.accent, fontWeight:500, border:`1px solid ${cat.accent}30`, fontFamily:"'Inter',sans-serif" }}>{s}</span>
//                     ))}
//                   </div>

//                   {/* Actions */}
//                   <div style={{ display:"flex", gap:8, borderTop:"1px solid #F3F4F6", paddingTop:12 }}>
//                     <button onClick={()=>setModalCat(cat)} style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6, padding:"7px", borderRadius:8, border:"1px solid #E5E7EB", background:"#fff", fontSize:12, fontWeight:600, cursor:"pointer", color:"#374151", fontFamily:"'Inter',sans-serif" }}>
//                       <Icon name="edit" size={13} color="#374151" /> Edit
//                     </button>
//                     <button onClick={()=>toggleActive(cat.id)} style={{ flex:1, padding:"7px", borderRadius:8, border:`1px solid ${cat.isActive?"#FECACA":"#A7F3D0"}`, background:cat.isActive?"#FEF2F2":"#F0FDF4", fontSize:12, fontWeight:600, cursor:"pointer", color:cat.isActive?"#DC2626":"#059669", fontFamily:"'Inter',sans-serif" }}>
//                       {cat.isActive?"Deactivate":"Activate"}
//                     </button>
//                     <button onClick={()=>setDeleteCat(cat)} style={{ padding:"7px 10px", borderRadius:8, border:"1px solid #E5E7EB", background:"#fff", fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }} title="Delete">
//                       <Icon name="trash" size={14} color="#9CA3AF" />
//                     </button>
//                   </div>
//                 </div>
//               </div>
//             ))}

//             {/* Add new card */}
//             <div onClick={()=>setModalCat({})} style={{ background:"#fff", borderRadius:14, border:"2px dashed #E5E7EB", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:200, cursor:"pointer", gap:10, transition:"all 0.15s" }}
//               onMouseEnter={e=>{e.currentTarget.style.borderColor="#2563EB"; e.currentTarget.querySelector("span").style.color="#2563EB";}}
//               onMouseLeave={e=>{e.currentTarget.style.borderColor="#E5E7EB"; e.currentTarget.querySelector("span").style.color="#9CA3AF";}}
//             >
//               <div style={{ width:44, height:44, borderRadius:10, background:"#F3F4F6", display:"flex", alignItems:"center", justifyContent:"center" }}>
//                 <Icon name="plus" size={20} color="#9CA3AF" />
//               </div>
//               <span style={{ fontSize:14, fontWeight:600, fontFamily:"'Inter',sans-serif", color:"#9CA3AF", transition:"color 0.15s" }}>Add New Category</span>
//             </div>
//           </div>
//         )}

//         {/* TABLE VIEW */}
//         {viewMode==="table" && (
//           <div style={{ background:"#fff", border:"1px solid #E5E7EB", borderRadius:14, overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
//             <table style={{ width:"100%", borderCollapse:"collapse" }}>
//               <thead>
//                 <tr>
//                   {["Category","Subcategories","Base Price","Bookings","Workers","Rating","Active","Featured","Actions"].map(h=>(
//                     <th key={h} style={{ ...th, textAlign:h==="Actions"?"center":th.textAlign }}>{h}</th>
//                   ))}
//                 </tr>
//               </thead>
//               <tbody>
//                 {filtered.length===0 && (
//                   <tr><td colSpan={9} style={{ padding:"40px", textAlign:"center", color:"#9CA3AF", fontSize:14, fontFamily:"'Inter',sans-serif" }}>No categories found.</td></tr>
//                 )}
//                 {filtered.map((cat,idx)=>(
//                   <tr key={cat.id} style={{ borderBottom: idx<filtered.length-1?"1px solid #F9FAFB":"none", opacity:cat.isActive?1:0.6 }}
//                     onMouseEnter={e=>e.currentTarget.style.background="#F9FAFB"}
//                     onMouseLeave={e=>e.currentTarget.style.background="#fff"}
//                   >
//                     <td style={td}>
//                       <div style={{ display:"flex", alignItems:"center", gap:10 }}>
//                         <div style={{ width:40, height:40, borderRadius:10, background:cat.color, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
//                           <Icon name={cat.iconKey} size={18} color={cat.accent} />
//                         </div>
//                         <div>
//                           <div style={{ fontWeight:700, color:"#111827", fontSize:14 }}>{cat.name}</div>
//                           <div style={{ fontSize:11, color:"#9CA3AF" }}>/{cat.slug}</div>
//                         </div>
//                       </div>
//                     </td>
//                     <td style={td}>
//                       <div style={{ display:"flex", gap:4, flexWrap:"wrap", maxWidth:200 }}>
//                         {cat.subcategories.slice(0,3).map(s=>(
//                           <span key={s} style={{ fontSize:11, padding:"1px 7px", borderRadius:10, background:"#F3F4F6", color:"#6B7280", fontFamily:"'Inter',sans-serif" }}>{s}</span>
//                         ))}
//                         {cat.subcategories.length>3 && <span style={{ fontSize:11, color:"#9CA3AF" }}>+{cat.subcategories.length-3}</span>}
//                       </div>
//                     </td>
//                     <td style={td}><span style={{ fontWeight:700, color:"#059669" }}>Rs. {cat.basePrice}</span><br/><span style={{ fontSize:11, color:"#9CA3AF" }}>{cat.priceUnit}</span></td>
//                     <td style={{ ...td, fontWeight:700 }}>{cat.totalBookings}</td>
//                     <td style={td}>{cat.activeWorkers}</td>
//                     <td style={td}><Stars rating={cat.avgRating} /></td>
//                     <td style={td}><Toggle checked={cat.isActive} onChange={()=>toggleActive(cat.id)} /></td>
//                     <td style={{ ...td, textAlign:"center" }}>
//                       <Toggle checked={cat.isFeatured} onChange={()=>toggleFeatured(cat.id)} />
//                     </td>
//                     <td style={{ ...td, textAlign:"center" }}>
//                       <div style={{ display:"flex", gap:6, justifyContent:"center" }}>
//                         <button onClick={()=>setModalCat(cat)} style={{ width:32, height:32, borderRadius:8, border:"1px solid #E5E7EB", background:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }} title="Edit">
//                           <Icon name="edit" size={14} color="#6B7280" />
//                         </button>
//                         <button onClick={()=>setDeleteCat(cat)} style={{ width:32, height:32, borderRadius:8, border:"1px solid #E5E7EB", background:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }} title="Delete">
//                           <Icon name="trash" size={14} color="#EF4444" />
//                         </button>
//                       </div>
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         )}

//         <div style={{ marginTop:14, fontSize:13, color:"#9CA3AF" }}>
//           Showing {filtered.length} of {categories.length} categories
//         </div>
//       </div>

//       {modalCat && <CategoryModal category={modalCat} onClose={()=>setModalCat(null)} onSave={saveCategory} />}
//       {deleteCat && <ConfirmDelete category={deleteCat} onClose={()=>setDeleteCat(null)} onConfirm={()=>{ setCategories(prev=>prev.filter(c=>c.id!==deleteCat.id)); setDeleteCat(null); }} />}
//     </>
//   );
// }
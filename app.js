(function () {
  "use strict";
  const events = [...window.TULALIP_EVENTS].sort((a,b) => new Date(a.start)-new Date(b.start));
  const list = document.querySelector("#eventList"), next = document.querySelector("#nextEvent"), filters = document.querySelector("#filters"), typeFilters = document.querySelector("#typeFilters");
  const summary = document.querySelector("#resultsSummary"), empty = document.querySelector("#emptyState"), clear = document.querySelector("#clearFilters");
  const dialog = document.querySelector("#eventDialog"), content = document.querySelector("#dialogContent"), toast = document.querySelector("#toast");
  let activeCategory = "All", activeType = "All types", deferredPrompt, closeTimer, touchStartY = 0;
  const categories = ["All", ...new Set(events.map(e => e.category))];
  const types = ["All types", ...new Set(events.map(e => e.type))];

  function el(tag, cls, text) { const node=document.createElement(tag); if(cls) node.className=cls; if(text!==undefined) node.textContent=text; return node; }
  function parseEventDate(iso) { return new Date(`${iso}${iso >= "2026-11-01" ? "-08:00" : "-07:00"}`); }
  function formatDate(iso, opts={weekday:"short",month:"short",day:"numeric"}) { return new Intl.DateTimeFormat("en-US",{...opts,timeZone:"America/Los_Angeles"}).format(parseEventDate(iso)); }
  function relative(event) { const now=new Date(), start=parseEventDate(event.start); const days=Math.ceil((start-now)/86400000); return days<=0?"Happening now":days===1?"Tomorrow":days<7?`In ${days} days`:formatDate(event.start); }
  function iconFor(c){ return ({Health:"✚",Government:"◆",Elders:"♥",Family:"●",Culture:"◐",Community:"◎",Business:"▦"})[c]||"•"; }

  function reminderButton(event, label="Add to calendar") { const b=el("button","calendar-button",label); b.type="button"; b.addEventListener("click",e=>{e.stopPropagation(); downloadICS(event);}); return b; }
  function eventCard(event) {
    const card=el("article","event-card"); card.tabIndex=0; card.setAttribute("role","button"); card.setAttribute("aria-label",`View ${event.title}`);
    const date=el("div","date-tile"); date.append(el("strong","",formatDate(event.start,{day:"numeric"})),el("span","",formatDate(event.start,{month:"short"})));
    const body=el("div","event-card-body"), meta=el("div","card-meta"); meta.append(el("span","category",`${iconFor(event.category)} ${event.category}`),el("span","type",event.type));
    body.append(meta,el("h3","",event.title),el("p","event-time",`${event.timeLabel} · ${event.location}`));
    const arrow=el("span","card-arrow","›"); arrow.setAttribute("aria-hidden","true"); card.append(date,body,arrow);
    const open=()=>openEvent(event); card.addEventListener("click",open); card.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open();}}); return card;
  }
  function renderNext(){ const now=new Date(), event=events.find(item=>parseEventDate(item.end)>=now); if(!event){const wrap=el("article","next-card");wrap.append(el("h2","","You’re all caught up"),el("p","event-time","No future dates remain in this newsletter issue."));next.replaceChildren(wrap);return;} const wrap=el("article","next-card"); const top=el("div","next-top"); top.append(el("span","next-badge",relative(event)),el("span","category light",`${iconFor(event.category)} ${event.category}`)); wrap.append(top,el("h2","",event.title)); const details=el("div","next-details"); details.append(el("div","","◷ "+event.timeLabel),el("div","","⌖ "+event.location)); wrap.append(details); const actions=el("div","next-actions"), view=el("button","secondary-button","View details"); view.addEventListener("click",()=>openEvent(event)); actions.append(reminderButton(event,"Remind me"),view); wrap.append(actions,el("p","calendar-note","Downloads an event to your device calendar, where you can choose the reminder time.")); next.replaceChildren(wrap); }
  function filterButtons(values, current, onChange){return values.map(value=>{const b=el("button",value===current?"filter active":"filter",value);b.type="button";b.setAttribute("aria-pressed",String(value===current));b.addEventListener("click",()=>onChange(value));return b;});}
  function renderFilters(){ filters.replaceChildren(...filterButtons(categories,activeCategory,value=>{activeCategory=value;renderFilters();renderList();})); typeFilters.replaceChildren(...filterButtons(types,activeType,value=>{activeType=value;renderFilters();renderList();})); }
  function renderList(){ const shown=events.filter(e=>(activeCategory==="All"||e.category===activeCategory)&&(activeType==="All types"||e.type===activeType)); const groups=new Map();shown.forEach(event=>{const month=formatDate(event.start,{month:"long",year:"numeric"});if(!groups.has(month))groups.set(month,[]);groups.get(month).push(event);});const nodes=[];groups.forEach((items,month)=>{const heading=el("h3","month-heading",month);const group=el("div","month-events");group.append(...items.map(eventCard));nodes.push(heading,group);});list.replaceChildren(...nodes); summary.textContent=`${shown.length} ${shown.length===1?"item":"items"} from the newsletter`; empty.hidden=shown.length>0; clear.hidden=activeCategory==="All"&&activeType==="All types"; }
  function detailRow(label,value){const row=el("div","detail-row");row.append(el("span","",label),el("strong","",value));return row;}
  function safeLink(label,href){const a=el("a","detail-link",label);a.href=href;a.target="_blank";a.rel="noopener noreferrer";return a;}
  function flyerButton(event){
    const button=el("button","detail-link flyer-button","View original flyer"); button.type="button"; button.setAttribute("aria-expanded","false");
    button.addEventListener("click",()=>{const viewer=document.querySelector("#flyerViewer");viewer.hidden=false;button.setAttribute("aria-expanded","true");button.textContent="Original flyer shown below";requestAnimationFrame(()=>viewer.scrollIntoView({behavior:"smooth",block:"start"}));});
    return button;
  }
  function openEvent(event){
    const head=el("div","dialog-head"); head.append(el("span","category",`${iconFor(event.category)} ${event.category}`),el("span","type",event.type));
    const title=el("h2","",event.title);title.id="dialogTitle"; content.replaceChildren(head,title,el("p","dialog-summary",event.summary));
    const details=el("div","detail-list"); details.append(detailRow("Date",event.dateLabel),detailRow("Time",event.timeLabel),detailRow("Location",event.location),detailRow("For",event.audience)); if(event.contact)details.append(detailRow("Contact",event.contact)); content.append(details);
    const actions=el("div","dialog-actions"); actions.append(reminderButton(event)); if(event.email)actions.append(safeLink("Email organizer",`mailto:${event.email}`)); if(event.url)actions.append(safeLink("Official link",event.url)); if(event.flyer)actions.append(flyerButton(event)); else actions.append(safeLink("View source newsletter",event.source));
    content.append(actions,el("p","calendar-note","Calendar reminders are handled by your device after the event file opens."));
    if(event.flyer){const viewer=el("section","flyer-viewer");viewer.id="flyerViewer";viewer.hidden=true;const image=el("img","flyer-image");image.src=event.flyer;image.alt=`Original flyer for ${event.title}`;image.loading="lazy";viewer.append(el("h3","","Original flyer"),image,safeLink("Open full-size image",event.flyer));content.append(viewer);}
    content.append(el("p","verify-note","Prototype data extracted from a flyer. Please verify details with the organizer before attending."));
    clearTimeout(closeTimer);dialog.classList.remove("is-closing");dialog.showModal();requestAnimationFrame(()=>dialog.classList.add("is-open"));if(location.hash!==`#${event.id}`)history.pushState({event:event.id},"",`#${event.id}`);
  }
  function escICS(value){return String(value||"").replace(/\\/g,"\\\\").replace(/\n/g,"\\n").replace(/,/g,"\\,").replace(/;/g,"\\;");}
  function icsDate(value){return value.replace(/[-:]/g,"").slice(0,15);}
  function foldLine(line){let out="",current="";for(const char of line){const candidate=current+char;if(new TextEncoder().encode(candidate).length>74){out+=current+"\r\n ";current=char;}else current=candidate;}return out+current;}
  function buildICS(event){const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Lane and Company//Tulalip Next Prototype//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH","BEGIN:VTIMEZONE","TZID:America/Los_Angeles","X-LIC-LOCATION:America/Los_Angeles","BEGIN:DAYLIGHT","TZOFFSETFROM:-0800","TZOFFSETTO:-0700","TZNAME:PDT","DTSTART:19700308T020000","RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU","END:DAYLIGHT","BEGIN:STANDARD","TZOFFSETFROM:-0700","TZOFFSETTO:-0800","TZNAME:PST","DTSTART:19701101T020000","RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU","END:STANDARD","END:VTIMEZONE","BEGIN:VEVENT",`UID:${event.id}-2026@tulalip-next.local`,`DTSTAMP:${icsDate(new Date().toISOString().replace(/\.\d{3}Z$/,""))}Z`,`DTSTART;TZID=America/Los_Angeles:${icsDate(event.start)}`,`DTEND;TZID=America/Los_Angeles:${icsDate(event.end)}`,`SUMMARY:${escICS(event.title)}`,`LOCATION:${escICS(event.location)}`,`DESCRIPTION:${escICS(event.summary+" Verify details: "+event.source)}`,"BEGIN:VALARM","TRIGGER:-PT2H","ACTION:DISPLAY",`DESCRIPTION:${escICS(event.title+" starts soon")}`,"END:VALARM","END:VEVENT","END:VCALENDAR"];return lines.map(foldLine).join("\r\n")+"\r\n";}
  function downloadICS(event){
    const blob=new Blob([buildICS(event)],{type:"text/calendar;charset=utf-8"}), a=document.createElement("a"); a.href=URL.createObjectURL(blob);a.download=`${event.id}.ics`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000); showToast("Calendar event downloaded");
  }
  function showToast(message){toast.textContent=message;toast.classList.add("show");setTimeout(()=>toast.classList.remove("show"),2400);}
  function closeDialog(){if(!dialog.open)return;dialog.classList.remove("is-open");dialog.classList.add("is-closing");clearTimeout(closeTimer);closeTimer=setTimeout(()=>{dialog.classList.remove("is-closing");dialog.close();},280);if(location.hash)history.replaceState({},"",location.pathname+location.search);}
  function navigateClose(){location.hash?history.back():closeDialog();}
  clear.addEventListener("click",()=>{activeCategory="All";activeType="All types";renderFilters();renderList();}); document.querySelector("#dialogClose").addEventListener("click",navigateClose); dialog.addEventListener("click",e=>{if(e.target===dialog)navigateClose();}); dialog.addEventListener("cancel",e=>{e.preventDefault();navigateClose();}); dialog.addEventListener("close",()=>{dialog.classList.remove("is-open","is-closing");if(location.hash)history.replaceState({},"",location.pathname+location.search);}); window.addEventListener("popstate",()=>{if(!location.hash&&dialog.open)closeDialog();});
  dialog.addEventListener("touchstart",e=>{touchStartY=dialog.scrollTop===0?e.touches[0].clientY:0;},{passive:true});dialog.addEventListener("touchend",e=>{if(touchStartY&&e.changedTouches[0].clientY-touchStartY>90)navigateClose();touchStartY=0;},{passive:true});
  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;document.querySelector("#installButton").hidden=false;}); document.querySelector("#installButton").addEventListener("click",async()=>{if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;}else showToast("Use your browser menu to add this app to your home screen");});
  window.TulalipICS={buildICS,foldLine}; if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js")); renderNext();renderFilters();renderList();
})();

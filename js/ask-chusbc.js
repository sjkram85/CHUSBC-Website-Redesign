/* John chat widget (CHUSBC) — v2 preview copy.
   Demo mode (canned answers) unless window.ASK_CHUSBC_GEMINI_API_KEY is set by a LOCAL-ONLY, git-ignored gemini-local.js.
   Never commit or deploy a key. Planned: retheme John to Grok (xAI) behind a server-side proxy so no key ever reaches the browser. */
(function(){
  var LOGO='assets/logo.jpg', MODEL=window.ASK_CHUSBC_GEMINI_MODEL||'gemini-3.5-flash';
  var SYS='You are John, the friendly assistant for the Cecil Harford USBC Association website (chusbc.org) in Maryland. Help visitors with association tournaments (Open Championship, Women\'s Championship, Senior Singles, Mixed, Lighthouse Ladies, Valentine events, Ultimate League), youth bowling programs, the association centers (Forest Hill Lanes, Harford Lanes, APG Brewner Lanes), results, bowl.com for averages/bowler lookup, and how to contact the association (association manager cecilharford@gmail.com, webmaster chusbcwebmaster@gmail.com). Be concise. If unsure, point them to the Contact Us page instead of guessing.';
  var history=[];
  function el(t,c,h){var e=document.createElement(t);if(c)e.className=c;if(h!=null)e.innerHTML=h;return e;}
  var btn=el('button','ac-btn','<img src="'+LOGO+'" alt="">');btn.setAttribute('aria-label','Open chat with John');
  var toast=el('div','ac-toast','<button class="ac-x" aria-label="Dismiss">×</button><h4>Welcome to CHUSBC! 🎳</h4><p>I\'m <b>John</b>, here to help with anything you need: tournaments, results, youth bowling, centers and more.</p><button class="ac-open">Chat with John</button>');
  toast.setAttribute('role','status');toast.hidden=true;
  var panel=el('div','ac-panel','<div class="ac-head"><img src="'+LOGO+'" alt=""><div><b>John</b><small>Powered by Gemini</small></div><button class="ac-close" aria-label="Close chat">×</button></div><div class="ac-msgs" aria-live="polite"></div><form class="ac-form"><input placeholder="Ask about tournaments, centers…" aria-label="Your question" required><button type="submit">Send</button></form>');
  panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Chat with John');
  document.body.append(btn,toast,panel);
  var msgs=panel.querySelector('.ac-msgs'),form=panel.querySelector('form'),input=form.querySelector('input');
  function esc(s){return s.replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]});}
  function add(txt,who,html){var m=el('div','ac-m ac-'+who);if(html)m.innerHTML=txt;else m.textContent=txt;msgs.appendChild(m);msgs.scrollTop=msgs.scrollHeight;return m;}
  var greeted=false;
  function open(){toast.hidden=true;panel.hidden=false;btn.setAttribute('aria-expanded','true');
    if(!greeted){greeted=true;add('Hi! I\'m John. How can I help you today?','bot');
      if(!window.ASK_CHUSBC_GEMINI_API_KEY)add('Demo mode: I\'m giving quick answers from the site. Ask me anything about CHUSBC.','bot');}
    input.focus();}
  function close(){panel.hidden=true;btn.setAttribute('aria-expanded','false');btn.focus();}
  btn.onclick=function(){panel.hidden?open():close();};
  panel.querySelector('.ac-close').onclick=close;
  toast.querySelector('.ac-x').onclick=function(){toast.hidden=true;};
  toast.querySelector('.ac-open').onclick=open;
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!panel.hidden)close();});
  try{if(!sessionStorage.getItem('acWelcomed')){sessionStorage.setItem('acWelcomed','1');setTimeout(function(){if(panel.hidden)toast.hidden=false;},1200);}}catch(e){}
  function canned(q){q=q.toLowerCase();
    if(/average|bowler|bowl\.com|usbc home/.test(q))return 'Look up USBC averages and bowler info on <a href="https://bowl.com" target="_blank" rel="noopener">bowl.com</a> — the official United States Bowling Congress site.';
    if(/youth|kid|junior|scholar|pepsi/.test(q))return 'Youth programs include the Youth Championship, Pepsi Regional Qualifying, High Average Invitational and Stars of Tomorrow Scholarship Tournament. See <a href="#tournaments/youth">Youth events</a>.';
    if(/result|standing|score|payout/.test(q))return 'Final results and standings are posted as PDFs in the <a href="#tournaments/results">Results Archive</a>. Results certified in Prism show up there automatically.';
    if(/women|ladies/.test(q))return 'The 63rd Annual Women\'s Championship has been <b>rescheduled to March 13–14, 2027</b> at APG Brewner Lanes. <a href="https://chusbc.org/wp-content/uploads/2026/08/2026-womens-championship.pdf" target="_blank" rel="noopener">Entry form &amp; rules</a>.';
    if(/open|tournament|entry|champion|calendar|when/.test(q))return 'The 69th Annual Open Championship is <b>Nov 14–15 &amp; 21–22, 2026</b> at Forest Hill Lanes. $35 per event, handicap 90% of 230. <a href="https://chusbc.org/wp-content/uploads/2026/08/2026-open-championship.pdf" target="_blank" rel="noopener">Entry form &amp; rules</a>. More on <a href="#tournaments/all">Tournaments &amp; Calendar</a>.';
    if(/center|lane|where|direction|address|forest|harford|apg|brewner/.test(q))return 'Association centers: Forest Hill Lanes (1 Maurice Dr, Forest Hill), Harford Lanes (20 Custis St, Aberdeen) and APG Brewner Lanes (Bldg 2342, Aberdeen Proving Ground). Directions and phone numbers are on the <a href="#association-centers">home page</a>.';
    if(/board|director|officer/.test(q))return 'See <a href="#about">About &amp; Board</a>, or email the association manager at <a href="mailto:cecilharford@gmail.com">cecilharford@gmail.com</a>.';
    if(/hall of fame|farro/.test(q))return 'See the <a href="#honors/hof">Hall of Fame</a> page.';
    if(/contact|email|manager|help|question/.test(q))return 'Reach the association manager at <a href="mailto:cecilharford@gmail.com">cecilharford@gmail.com</a>, or website issues at <a href="mailto:chusbcwebmaster@gmail.com">chusbcwebmaster@gmail.com</a>. <a href="#contact">Contact Us</a>.';
    return 'I can help with tournaments, results, youth bowling, association centers and contacts. Try asking "When is the Open Championship?" or visit <a href="#contact">Contact Us</a>.';}
  function gemini(q){history.push({role:'user',parts:[{text:q}]});
    return fetch('https://generativelanguage.googleapis.com/v1beta/models/'+MODEL+':generateContent?key='+encodeURIComponent(window.ASK_CHUSBC_GEMINI_API_KEY),
      {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:SYS}]},contents:history})})
     .then(function(r){if(!r.ok)throw new Error(r.status);return r.json();})
     .then(function(d){var t=((d.candidates||[])[0]||{}).content;t=t&&t.parts?t.parts.map(function(p){return p.text||'';}).join(''):'Sorry, I could not answer that.';history.push({role:'model',parts:[{text:t}]});return t;});}
  form.onsubmit=function(e){e.preventDefault();var q=input.value.trim();if(!q)return;input.value='';add(q,'user');
    var t=add('…','bot');
    if(window.ASK_CHUSBC_GEMINI_API_KEY){gemini(q).then(function(a){t.textContent=a;}).catch(function(){t.innerHTML='Sorry, I couldn\'t reach Gemini right now. '+canned(q);});}
    else setTimeout(function(){t.innerHTML=canned(q);},400);};
})();

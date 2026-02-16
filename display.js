// ============================================================================
// QUEUEAPP - DISPLAY.JS (WITH NOTIFICATIONS)
// ============================================================================

const DEFAULT_DISPLAY_SETTINGS = {
  qr: { position: { top: '', bottom: '1rem', left: '', right: '1rem' }, scale: 1, hidden: false },
  ui: { showStats: true, showPhoneNumbers: true, highlightTop3: true, cardStyle: 'enhanced', tableStyle: 'gradient', waitingLayout: 'list', servingDisplayCount: 10 }
};

const getDisplaySettings = (rid) => {
  const saved = localStorage.getItem(`display_settings_${rid}`);
  if (!saved) return JSON.parse(JSON.stringify(DEFAULT_DISPLAY_SETTINGS));
  try {
    const settings = JSON.parse(saved);
    return { qr: { ...DEFAULT_DISPLAY_SETTINGS.qr, ...(settings.qr || {}) }, ui: { ...DEFAULT_DISPLAY_SETTINGS.ui, ...(settings.ui || {}) } };
  } catch (e) {
    return JSON.parse(JSON.stringify(DEFAULT_DISPLAY_SETTINGS));
  }
};

const saveDisplaySettings = (rid, settings) => {
  try {
    localStorage.setItem(`display_settings_${rid}`, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save display settings:', e);
  }
};

// ============================================================================
// NOTIFICATION SYSTEM
// ============================================================================

function playNotificationBell() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const playTone = (freq, dur, start) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, audioContext.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + start + dur);
      osc.start(audioContext.currentTime + start);
      osc.stop(audioContext.currentTime + start + dur);
    };
    playTone(800, 0.2, 0);
    playTone(1000, 0.2, 0.25);
    playTone(1200, 0.3, 0.5);
  } catch (e) {
    console.error('Sound failed:', e);
  }
}

function triggerDeviceVibration() {
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200, 100, 400]);
    }
  } catch (e) {
    console.error('Vibration failed:', e);
  }
}

function showVisualBlast() {
  try {
    const blast = document.createElement('div');
    blast.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:radial-gradient(circle,rgba(251,191,36,0.9) 0%,rgba(249,115,22,0.7) 50%,transparent 100%);z-index:9999;pointer-events:none;animation:blastAnim 1s ease-out';
    
    if (!document.getElementById('blast-style')) {
      const style = document.createElement('style');
      style.id = 'blast-style';
      style.textContent = '@keyframes blastAnim{0%{opacity:0;transform:scale(0.5)}30%{opacity:1;transform:scale(1.2)}100%{opacity:0;transform:scale(2)}}@keyframes confettiAnim{0%{transform:translateY(0) rotate(0deg);opacity:1}100%{transform:translateY(-100vh) rotate(720deg);opacity:0}}';
      document.head.appendChild(style);
    }
    
    document.body.appendChild(blast);
    setTimeout(() => blast.remove(), 1000);
  } catch (e) {
    console.error('Blast failed:', e);
  }
}

function launchConfetti() {
  try {
    const colors = ['#fbbf24', '#f59e0b', '#ea580c', '#10b981', '#3b82f6', '#8b5cf6'];
    for (let i = 0; i < 50; i++) {
      setTimeout(() => {
        const c = document.createElement('div');
        c.style.cssText = `position:fixed;width:${Math.random()*10+5}px;height:${Math.random()*10+5}px;background:${colors[Math.floor(Math.random()*colors.length)]};top:50%;left:${Math.random()*100}%;z-index:9998;border-radius:${Math.random()>0.5?'50%':'0'};pointer-events:none;animation:confettiAnim ${Math.random()*2+2}s ease-out forwards`;
        document.body.appendChild(c);
        setTimeout(() => c.remove(), 4000);
      }, i * 20);
    }
  } catch (e) {
    console.error('Confetti failed:', e);
  }
}

function notifyTableAllocated() {
  console.log('🎉 TABLE ALLOCATED!');
  playNotificationBell();
  triggerDeviceVibration();
  showVisualBlast();
  launchConfetti();
}

// ============================================================================
// MAIN DISPLAY FUNCTION
// ============================================================================

async function showDisplay(rid, customerQueueNumber) {
  if (window.displayUnsubscribe) window.displayUnsubscribe();
  
  const settings = getDisplaySettings(rid);
  let wasAllocatedBefore = false;
  
  window.displayUnsubscribe = db.collection('restaurants').doc(rid).onSnapshot(doc => {
    if (!doc.exists) {
      render(`<div class="container text-center" style="padding-top:4rem"><h1 style="color:var(--danger)">Not found</h1></div>`);
      return;
    }
    
    const restaurant = doc.data();
    DB.restaurants[rid] = restaurant;
    DB.save();
    
    const waitingQueue = restaurant.queue.filter(q => q.status === 'waiting');
    const allocatedQueue = restaurant.queue.filter(q => q.status === 'allocated');
    const currentSettings = getDisplaySettings(rid);
    const maxCards = currentSettings.ui.servingDisplayCount || 10;
    const justCalled = allocatedQueue.slice(-maxCards);
    
    const displayWaitingQueue = customerQueueNumber ? waitingQueue.filter(q => q.queueNumber === customerQueueNumber) : waitingQueue;
    const displayAllocatedQueue = customerQueueNumber ? justCalled.filter(q => q.queueNumber === customerQueueNumber) : justCalled;
    
    // NOTIFICATION TRIGGER
    if (customerQueueNumber && displayAllocatedQueue.length > 0 && !wasAllocatedBefore) {
      wasAllocatedBefore = true;
      notifyTableAllocated();
    } else if (customerQueueNumber && displayAllocatedQueue.length === 0) {
      wasAllocatedBefore = false;
    }
    
    const cardSize = displayAllocatedQueue.length <= 3 ? 'min(400px,100%)' : displayAllocatedQueue.length <= 6 ? 'min(320px,100%)' : 'min(250px,100%)';
    const cardPadding = displayAllocatedQueue.length <= 3 ? 'clamp(1.5rem,3vw,3rem)' : displayAllocatedQueue.length <= 6 ? 'clamp(1.25rem,2.5vw,2.5rem)' : 'clamp(1rem,2vw,2rem)';
    const queueFontSize = displayAllocatedQueue.length <= 3 ? 'clamp(5rem,12vw,10rem)' : displayAllocatedQueue.length <= 6 ? 'clamp(4rem,10vw,8rem)' : 'clamp(3.5rem,8vw,7rem)';
    const nameFontSize = displayAllocatedQueue.length <= 3 ? 'clamp(1.75rem,4.5vw,3rem)' : displayAllocatedQueue.length <= 6 ? 'clamp(1.5rem,4vw,2.5rem)' : 'clamp(1.25rem,3.5vw,2rem)';
    const tableFontSize = displayAllocatedQueue.length <= 3 ? 'clamp(2.5rem,6vw,4.5rem)' : displayAllocatedQueue.length <= 6 ? 'clamp(2rem,5vw,3.5rem)' : 'clamp(1.75rem,4.5vw,3rem)';
    const guestFontSize = displayAllocatedQueue.length <= 3 ? 'clamp(1.25rem,3vw,2rem)' : displayAllocatedQueue.length <= 6 ? 'clamp(1.1rem,2.5vw,1.75rem)' : 'clamp(1rem,2.25vw,1.5rem)';
    const zoneFontSize = displayAllocatedQueue.length <= 3 ? 'clamp(1.25rem,3vw,2rem)' : displayAllocatedQueue.length <= 6 ? 'clamp(1.1rem,2.5vw,1.75rem)' : 'clamp(1rem,2.25vw,1.5rem)';
    
    const generateServingCard = (allocated, isMyTurn) => {
      const zoneHTML = allocated.zone ? `<div style="background:${isMyTurn?'rgba(0,0,0,0.2)':'linear-gradient(135deg,#ea580c 0%,#c2410c 100%)'};color:white;padding:clamp(0.5rem,1.2vw,1rem) clamp(1rem,2.2vw,1.75rem);border-radius:clamp(0.5rem,1.2vw,1rem);font-size:${zoneFontSize};font-weight:700;letter-spacing:0.05em;text-transform:uppercase;box-shadow:0 3px 12px rgba(0,0,0,0.3);border:2px solid rgba(255,255,255,0.25);margin-bottom:clamp(0.75rem,1.5vw,1.5rem)">🏢 ${allocated.zone}</div>` : '';
      
      if (currentSettings.ui.cardStyle === 'simple') {
        return `<div class="card text-center" style="background:${isMyTurn?'linear-gradient(135deg,#fbbf24 0%,#f59e0b 100%)':'white'};padding:${cardPadding};border:4px solid ${isMyTurn?'#f59e0b':'white'};${isMyTurn?'animation:pulse-badge 1s infinite;box-shadow:0 0 30px rgba(251,191,36,0.8)':''};min-height:280px;display:flex;flex-direction:column;justify-content:center;gap:clamp(0.5rem,1vw,1rem)">${zoneHTML}<div style="font-size:${queueFontSize};font-weight:900;color:${isMyTurn?'white':'var(--success)'};line-height:1;text-shadow:${isMyTurn?'0 4px 12px rgba(0,0,0,0.2)':'none'}">${allocated.queueNumber}</div><div style="font-size:${nameFontSize};font-weight:700;color:${isMyTurn?'white':'var(--gray-900)'};text-shadow:${isMyTurn?'0 2px 6px rgba(0,0,0,0.15)':'none'}">${allocated.name}</div><div style="font-size:${guestFontSize};color:${isMyTurn?'rgba(255,255,255,0.9)':'var(--gray-600)'};font-weight:600">👥 ${allocated.guests} Guest${allocated.guests!==1?'s':''}</div>${currentSettings.ui.tableStyle==='simple'?`<div style="font-size:${tableFontSize};font-weight:800;color:${isMyTurn?'rgba(255,255,255,0.95)':'var(--gray-900)'};margin-top:clamp(0.5rem,1vw,1rem)">Table ${allocated.tableNo}</div>`:`<div style="background:${isMyTurn?'white':'linear-gradient(135deg,var(--success) 0%,#059669 100%)'};color:${isMyTurn?'var(--primary)':'white'};padding:clamp(0.75rem,1.5vw,1.25rem);border-radius:clamp(.6rem,1.2vw,.9rem);box-shadow:0 4px 12px rgba(0,0,0,.2);margin-top:clamp(0.5rem,1vw,1rem)"><div style="font-size:clamp(.75rem,1.75vw,1.1rem);font-weight:700;margin-bottom:.25rem;opacity:0.9">TABLE</div><div style="font-size:${tableFontSize};font-weight:900">${allocated.tableNo}</div></div>`}${isMyTurn?'<div style="margin-top:clamp(0.5rem,1vw,1rem);background:white;color:var(--primary);padding:clamp(.6rem,1.2vw,.9rem);border-radius:clamp(.4rem,.8vw,.6rem);font-weight:900;font-size:clamp(1.1rem,2.5vw,1.75rem);animation:pulse 2s infinite;box-shadow:0 4px 12px rgba(0,0,0,0.15)">🎉 YOUR TURN! 🎉</div>':''}</div>`;
      } else {
        return `<div class="card text-center" style="background:${isMyTurn?'linear-gradient(135deg,#fbbf24 0%,#f59e0b 100%)':'white'};padding:${cardPadding};border:4px solid ${isMyTurn?'#f59e0b':'var(--success)'}${isMyTurn?';animation:pulse 2s infinite;box-shadow:0 0 40px rgba(251,191,36,.8)':''};display:flex;flex-direction:column;gap:clamp(0.5rem,1vw,1rem)">${zoneHTML}<div style="font-size:${queueFontSize};font-weight:900;color:${isMyTurn?'white':'var(--success)'};text-shadow:${isMyTurn?'0 4px 8px rgba(0,0,0,.3)':'none'};line-height:1">${allocated.queueNumber}</div><div style="background:${isMyTurn?'rgba(255,255,255,.25)':'var(--gray-50)'};padding:clamp(0.75rem,1.5vw,1.25rem);border-radius:clamp(.6rem,1.2vw,.9rem);border:2px solid ${isMyTurn?'rgba(255,255,255,0.3)':'transparent'}"><div style="font-size:${nameFontSize};font-weight:700;color:${isMyTurn?'white':'var(--gray-900)'};margin-bottom:clamp(.4rem,.8vw,.75rem);text-shadow:${isMyTurn?'0 2px 4px rgba(0,0,0,.2)':'none'}">${allocated.name}</div><div style="font-size:${guestFontSize};color:${isMyTurn?'rgba(255,255,255,.95)':'var(--gray-600)'};font-weight:600">👥 ${allocated.guests} Guest${allocated.guests!==1?'s':''}</div></div>${currentSettings.ui.tableStyle==='gradient'?`<div style="background:${isMyTurn?'white':'linear-gradient(135deg,var(--success) 0%,#059669 100%)'};color:${isMyTurn?'var(--primary)':'white'};padding:clamp(0.75rem,1.5vw,1.25rem);border-radius:clamp(.6rem,1.2vw,.9rem);box-shadow:0 4px 12px rgba(0,0,0,.2)"><div style="font-size:clamp(.75rem,1.75vw,1.1rem);font-weight:700;margin-bottom:.25rem;opacity:0.9">TABLE</div><div style="font-size:${tableFontSize};font-weight:900">${allocated.tableNo}</div></div>`:`<div style="font-size:${tableFontSize};font-weight:800;color:${isMyTurn?'white':'var(--gray-900)'}">Table ${allocated.tableNo}</div>`}${isMyTurn?'<div style="background:white;color:var(--primary);padding:clamp(.6rem,1.2vw,.9rem);border-radius:clamp(.4rem,.8vw,.6rem);font-weight:900;font-size:clamp(1.1rem,2.5vw,1.75rem);animation:pulse 2s infinite;box-shadow:0 4px 12px rgba(0,0,0,0.15)">🎉 YOUR TURN! 🎉</div>':''}</div>`;
      }
    };
    
    const generateWaitingQueue = () => {
      if (currentSettings.ui.waitingLayout === 'grid') {
        return `<div class="card" style="background:linear-gradient(135deg,rgba(249,115,22,.9),rgba(234,88,12,.9));border:4px solid var(--primary);padding:clamp(2rem,4vw,4rem)"><h2 class="text-center" style="font-size:clamp(2rem,5vw,4rem);margin-bottom:clamp(1rem,2vw,2rem)">⏳ WAITING QUEUE</h2><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(${cardSize},1fr));gap:clamp(1rem,2vw,2rem)">${displayWaitingQueue.map(w=>`<div class="card text-center" style="background:white;padding:${cardPadding};display:flex;flex-direction:column;gap:clamp(0.4rem,.8vw,.75rem)">${w.zone?`<div style="background:linear-gradient(135deg,#ea580c 0%,#c2410c 100%);color:white;padding:clamp(0.35rem,.7vw,.55rem) clamp(0.75rem,1.5vw,1.25rem);border-radius:clamp(0.35rem,.7vw,.55rem);font-size:clamp(0.9rem,2vw,1.4rem);font-weight:700;letter-spacing:0.03em;text-transform:uppercase;box-shadow:0 2px 8px rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.2)">🏢 ${w.zone}</div>`:''}<div style="font-size:${queueFontSize};font-weight:900;color:var(--primary)">${w.queueNumber}</div><div style="background:var(--gray-50);padding:clamp(0.75rem,1.5vw,1.25rem);border-radius:clamp(.6rem,1.2vw,.9rem)"><div style="font-size:${nameFontSize};font-weight:700;color:var(--gray-900);margin-bottom:clamp(.4rem,.8vw,.75rem)">${w.name}</div>${currentSettings.ui.showPhoneNumbers?`<div style="font-size:clamp(0.9rem,1.8vw,1.2rem);color:var(--gray-600);font-family:monospace;margin-bottom:clamp(.25rem,.5vw,.4rem)">${w.phone}</div>`:''}<div style="font-size:${guestFontSize};color:var(--gray-600);font-weight:600">👥 ${w.guests} Guest${w.guests!==1?'s':''}</div></div></div>`).join('')}</div></div>`;
      } else {
        return `<div class="card" style="background:rgba(249,115,22,.2);border:3px solid var(--primary);padding:clamp(1.5rem,3vw,3rem)"><h2 class="text-center" style="color:var(--primary);margin-bottom:clamp(1rem,2vw,2rem);font-size:clamp(2rem,5vw,4rem)">⏳ Waiting (${waitingQueue.length})</h2><div style="max-height:60vh;overflow-y:auto"><div class="space-y">${displayWaitingQueue.length>0?displayWaitingQueue.slice(0,15).map((w,i)=>{const isTop3=currentSettings.ui.highlightTop3&&i<3;return `<div class="card" style="background:${isTop3?'rgba(249,115,22,.9)':'rgba(55,65,81,.8)'};padding:clamp(1rem,2vw,2rem);border:${isTop3?'3px solid var(--primary)':'2px solid rgba(156,163,175,.3)'};display:flex;flex-direction:column;gap:clamp(0.4rem,.8vw,.75rem)">${w.zone?`<div style="background:${isTop3?'rgba(0,0,0,0.2)':'rgba(234,88,12,0.9)'};color:white;padding:clamp(0.35rem,.7vw,.55rem) clamp(0.75rem,1.5vw,1.25rem);border-radius:clamp(0.35rem,.7vw,.55rem);font-size:clamp(0.9rem,2vw,1.4rem);font-weight:700;letter-spacing:0.03em;text-transform:uppercase;display:inline-block;align-self:flex-start;box-shadow:0 2px 8px rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.2)">🏢 ${w.zone}</div>`:''}<div style="display:flex;justify-content:space-between;align-items:center;gap:clamp(.75rem,1.5vw,1rem);flex-wrap:wrap"><div style="flex:1"><div style="font-size:clamp(2.5rem,6vw,5rem);font-weight:900;color:${isTop3?'#fff':'var(--primary)'}">${w.queueNumber}</div><div style="font-size:clamp(1.15rem,2.3vw,1.65rem);font-weight:600;color:${isTop3?'#fff':'rgba(255,255,255,.9)'};margin-top:.4rem">${w.name}</div>${currentSettings.ui.showPhoneNumbers?`<div style="font-size:clamp(0.9rem,1.8vw,1.2rem);color:${isTop3?'rgba(255,255,255,.8)':'rgba(255,255,255,.6)'};font-family:monospace;margin-top:.25rem">${w.phone}</div>`:''}<div style="font-size:clamp(1rem,2vw,1.4rem);color:${isTop3?'rgba(255,255,255,.9)':'rgba(255,255,255,.7)'};margin-top:.25rem">👥 ${w.guests} guest${w.guests!==1?'s':''}</div></div></div></div>`;}).join(''):(customerQueueNumber?'<p class="text-center" style="color:rgba(255,255,255,.6);font-size:clamp(1.25rem,3vw,2rem);padding:2rem">Your queue details will appear here</p>':'<p class="text-center" style="color:rgba(255,255,255,.6);font-size:clamp(1.25rem,3vw,2rem);padding:2rem">No customers</p>')}</div></div></div>`;
      }
    };
    
    render(`
      <div class="display-screen" style="position:relative">
        ${customerQueueNumber?'':`
          <div class="qr-controls" id="qrControls">
            <button class="qr-toggle-btn" onclick="toggleQRControls()" style="position:absolute;top:.5rem;right:.5rem">⚙️</button>
            <div class="qr-controls-content">
              <h3>🎛️ Display Settings</h3>
              <div class="control-group">
                <label style="font-size:.875rem;display:block;margin-bottom:.5rem">QR Position:</label>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem">
                  <button class="qr-control-btn small" onclick="setQRPosition('${rid}','top-left')">↖ Top Left</button>
                  <button class="qr-control-btn small" onclick="setQRPosition('${rid}','top-right')">↗ Top Right</button>
                  <button class="qr-control-btn small" onclick="setQRPosition('${rid}','bottom-left')">↙ Bottom Left</button>
                  <button class="qr-control-btn small" onclick="setQRPosition('${rid}','bottom-right')">↘ Bottom Right</button>
                </div>
              </div>
              <div class="control-group qr-size-control">
                <label>QR Size: <span id="qrSizeLabel">${Math.round(currentSettings.qr.scale*250)}</span>px</label>
                <input type="range" class="qr-size-slider" id="qrSizeSlider" min="150" max="450" value="${Math.round(currentSettings.qr.scale*250)}" step="10" oninput="updateQRSize('${rid}',this.value)">
              </div>
              <div class="control-group">
                <button class="qr-control-btn" onclick="toggleQRVisibility('${rid}')" id="qrVisibilityBtn">${currentSettings.qr.hidden?'👁️ Show QR':'👁️ Hide QR'}</button>
              </div>
              <hr style="border:none;border-top:1px solid rgba(255,255,255,.2);margin:1rem 0">
              <div class="control-group qr-size-control">
                <label>Serving Display: <span id="servingCountLabel">${currentSettings.ui.servingDisplayCount||10}</span> cards</label>
                <input type="range" class="qr-size-slider" id="servingCountSlider" min="1" max="20" value="${currentSettings.ui.servingDisplayCount||10}" step="1" oninput="updateServingCount('${rid}',this.value)">
              </div>
              <hr style="border:none;border-top:1px solid rgba(255,255,255,.2);margin:1rem 0">
              <div class="control-group">
                <label style="font-size:.875rem;display:block;margin-bottom:.75rem;color:#fbbf24;font-weight:700">📊 UI Options:</label>
                <label style="display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem;cursor:pointer;font-size:.875rem">
                  <input type="checkbox" id="showStats" ${currentSettings.ui.showStats?'checked':''} onchange="toggleUISetting('${rid}','showStats',this.checked)">
                  <span>Show Stats Section</span>
                </label>
                <label style="display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem;cursor:pointer;font-size:.875rem">
                  <input type="checkbox" id="showPhoneNumbers" ${currentSettings.ui.showPhoneNumbers?'checked':''} onchange="toggleUISetting('${rid}','showPhoneNumbers',this.checked)">
                  <span>Show Phone Numbers</span>
                </label>
                <label style="display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem;cursor:pointer;font-size:.875rem">
                  <input type="checkbox" id="highlightTop3" ${currentSettings.ui.highlightTop3?'checked':''} onchange="toggleUISetting('${rid}','highlightTop3',this.checked)">
                  <span>Highlight Top 3 Waiting</span>
                </label>
              </div>
              <div class="control-group">
                <label style="font-size:.875rem;display:block;margin-bottom:.5rem">Card Style:</label>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem">
                  <button class="qr-control-btn small ${currentSettings.ui.cardStyle==='simple'?'active':''}" onclick="setUIOption('${rid}','cardStyle','simple')">Simple</button>
                  <button class="qr-control-btn small ${currentSettings.ui.cardStyle==='enhanced'?'active':''}" onclick="setUIOption('${rid}','cardStyle','enhanced')">Enhanced</button>
                </div>
              </div>
              <div class="control-group">
                <label style="font-size:.875rem;display:block;margin-bottom:.5rem">Table Style:</label>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem">
                  <button class="qr-control-btn small ${currentSettings.ui.tableStyle==='simple'?'active':''}" onclick="setUIOption('${rid}','tableStyle','simple')">Simple</button>
                  <button class="qr-control-btn small ${currentSettings.ui.tableStyle==='gradient'?'active':''}" onclick="setUIOption('${rid}','tableStyle','gradient')">Gradient</button>
                </div>
              </div>
              <div class="control-group">
                <label style="font-size:.875rem;display:block;margin-bottom:.5rem">Waiting Layout:</label>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem">
                  <button class="qr-control-btn small ${currentSettings.ui.waitingLayout==='list'?'active':''}" onclick="setUIOption('${rid}','waitingLayout','list')">List</button>
                  <button class="qr-control-btn small ${currentSettings.ui.waitingLayout==='grid'?'active':''}" onclick="setUIOption('${rid}','waitingLayout','grid')">Grid</button>
                </div>
              </div>
              <hr style="border:none;border-top:1px solid rgba(255,255,255,.2);margin:1rem 0">
              <div class="control-group">
                <button class="qr-control-btn" onclick="resetDisplaySettings('${rid}')" style="width:100%">🔄 Reset All Settings</button>
              </div>
            </div>
          </div>
          <div class="display-qr-fixed ${currentSettings.qr.hidden?'hidden':''}" id="displayQR" onmousedown="startDragQR(event)" ontouchstart="startDragQR(event)" style="${currentSettings.qr.position.top?`top:${currentSettings.qr.position.top}`:''}${currentSettings.qr.position.bottom?`bottom:${currentSettings.qr.position.bottom}`:''}${currentSettings.qr.position.left?`left:${currentSettings.qr.position.left}`:''}${currentSettings.qr.position.right?`right:${currentSettings.qr.position.right}`:''}">
            <div class="qr-card" style="background:linear-gradient(135deg,#fff7ed 0%,#ffedd5 100%);padding:clamp(1rem,3vw,2rem);border-radius:clamp(1rem,2vw,2rem);box-shadow:0 8px 32px rgba(0,0,0,.3);border:5px solid var(--primary);transform:scale(${currentSettings.qr.scale})">
              <div style="text-align:center;margin-bottom:1rem">
                <div class="qr-text" style="font-size:clamp(1.25rem,2.5vw,2.5rem);font-weight:900;color:var(--primary);margin-bottom:.5rem;animation:pulse-badge 1.5s infinite">👉 SCAN HERE 👈</div>
                <div class="qr-text" style="font-size:clamp(.875rem,1.5vw,1.5rem);font-weight:700;color:var(--gray-900);margin-bottom:.5rem">Welcome! 🎉</div>
                <div class="qr-text" style="font-size:clamp(.75rem,1.1vw,1.1rem);color:var(--gray-700);line-height:1.4">Join our queue instantly with your phone</div>
              </div>
              <div style="background:white;padding:clamp(1rem,2vw,1.5rem);border-radius:clamp(1rem,1.5vw,1.5rem);box-shadow:0 4px 12px rgba(0,0,0,.1);position:relative;display:flex;justify-content:center">
                <div id="display-qr" style="background:white;display:inline-block"></div>
              </div>
              <div style="text-align:center;margin-top:1rem">
                <div class="qr-text" style="font-size:clamp(.875rem,1.3vw,1.3rem);color:var(--primary);font-weight:700">📱 Open Camera & Scan</div>
                <div class="qr-text" style="font-size:clamp(.65rem,1vw,1rem);color:var(--gray-600);margin-top:.3rem">No app needed!</div>
              </div>
            </div>
          </div>
        `}
        <div class="container">
          <div class="text-center mb" style="padding-bottom:clamp(1rem,2vw,2rem);border-bottom:4px solid var(--primary);position:relative">
            ${customerQueueNumber?'':`<div style="position:absolute;top:0;left:0;right:0;display:flex;justify-content:flex-end;padding:.5rem"><button onclick="navigate('/r/${rid}/admin')" class="btn btn-primary" style="font-size:clamp(.75rem,2vw,1rem);padding:clamp(.5rem,1.5vw,1rem) clamp(1rem,2.5vw,1.5rem);display:flex;align-items:center;gap:.5rem;background:var(--primary);color:white;font-weight:700;box-shadow:0 4px 12px rgba(249,115,22,.4)"><span style="font-size:clamp(1.1rem,2.5vw,1.5rem)">🏠</span><span>Home</span></button></div>`}
            <h1 style="color:var(--primary);margin-top:${customerQueueNumber?'0':'clamp(2.5rem,5vw,4rem)'}">${restaurant.name}</h1>
            <p style="font-size:clamp(1.25rem,3vw,2rem);color:rgba(255,255,255,.7)">Queue Management</p>
            <div style="font-size:clamp(2rem,5vw,3rem);color:var(--primary);font-weight:700;margin-top:.5rem">${new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</div>
            <div style="font-size:clamp(1rem,2vw,1.25rem);color:#10b981;margin-top:.5rem">🔥 Live</div>
          </div>
          ${currentSettings.ui.showStats&&!customerQueueNumber?`<div class="card mb" style="background:rgba(168,85,247,.2);border:3px solid #9333ea;padding:clamp(1.5rem,3vw,3rem)"><h2 class="text-center" style="color:#c084fc;margin-bottom:clamp(1rem,2vw,2rem);font-size:clamp(1.75rem,4vw,3rem)">📊 Stats</h2><div class="grid grid-2" style="gap:clamp(1rem,2vw,2rem)"><div class="card text-center" style="background:rgba(255,255,255,.1);padding:clamp(1.25rem,2.5vw,2rem)"><div style="font-size:clamp(3.5rem,9vw,7rem);font-weight:900;color:var(--primary)">${waitingQueue.length}</div><div style="font-size:clamp(1.1rem,2vw,1.5rem);color:white;margin-top:.5rem">Waiting</div></div><div class="card text-center" style="background:rgba(255,255,255,.1);padding:clamp(1.25rem,2.5vw,2rem)"><div style="font-size:clamp(3.5rem,9vw,7rem);font-weight:900;color:var(--success)">${allocatedQueue.length}</div><div style="font-size:clamp(1.1rem,2vw,1.5rem);color:white;margin-top:.5rem">Seated</div></div></div></div>`:''}
          ${displayAllocatedQueue.length>0?`<div class="card mb" style="background:linear-gradient(135deg,rgba(22,163,74,.9),rgba(21,128,61,.9));border:4px solid var(--success);padding:clamp(2rem,4vw,4rem)"><h2 class="text-center" style="font-size:clamp(2.5rem,6vw,5rem);margin-bottom:clamp(1rem,2vw,2rem)"><span style="font-size:clamp(4rem,10vw,8rem);animation:pulse 2s infinite">🔔</span><br>NOW SERVING</h2><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(${cardSize},1fr));gap:clamp(1rem,2vw,2rem)">${displayAllocatedQueue.map(allocated=>{const isMyTurn=customerQueueNumber&&allocated.queueNumber===customerQueueNumber;return generateServingCard(allocated,isMyTurn);}).join('')}</div></div>`:''}
          ${displayWaitingQueue.length>0?generateWaitingQueue():displayAllocatedQueue.length===0?'<div class="card text-center" style="background:rgba(255,255,255,.1);padding:clamp(3rem,6vw,6rem)"><div style="font-size:clamp(4rem,12vw,8rem);margin-bottom:clamp(1rem,2vw,2rem)">😊</div><h2 style="font-size:clamp(2rem,6vw,4rem);color:white">No Queue</h2><p style="font-size:clamp(1.25rem,3vw,2rem);color:rgba(255,255,255,.7);margin-top:1rem">All customers served!</p></div>':''}
        </div>
      </div>
    `);
    
    if (!customerQueueNumber) {
      setTimeout(() => generateQRCode('display-qr', rid), 100);
    }
  });
}

// QR CONTROLS
const toggleQRControls = () => {
  const controls = document.getElementById('qrControls');
  if (controls) controls.classList.toggle('minimized');
};

const setQRPosition = (rid, position) => {
  const qr = document.getElementById('displayQR');
  if (!qr) return;
  const settings = getDisplaySettings(rid);
  switch(position) {
    case 'top-left': settings.qr.position = { top: '1rem', bottom: '', left: '1rem', right: '' }; break;
    case 'top-right': settings.qr.position = { top: '1rem', bottom: '', left: '', right: '1rem' }; break;
    case 'bottom-left': settings.qr.position = { top: '', bottom: '1rem', left: '1rem', right: '' }; break;
    case 'bottom-right': settings.qr.position = { top: '', bottom: '1rem', left: '', right: '1rem' }; break;
  }
  saveDisplaySettings(rid, settings);
  Object.entries(settings.qr.position).forEach(([key, value]) => qr.style[key] = value);
};

const updateQRSize = (rid, size) => {
  const label = document.getElementById('qrSizeLabel');
  const qrCard = document.querySelector('#displayQR .qr-card');
  const scale = size / 250;
  if (label) label.textContent = size;
  if (qrCard) qrCard.style.transform = `scale(${scale})`;
  const settings = getDisplaySettings(rid);
  settings.qr.scale = scale;
  saveDisplaySettings(rid, settings);
};

const updateServingCount = (rid, count) => {
  const label = document.getElementById('servingCountLabel');
  if (label) label.textContent = count;
  const settings = getDisplaySettings(rid);
  settings.ui.servingDisplayCount = parseInt(count);
  saveDisplaySettings(rid, settings);
};

const toggleQRVisibility = (rid) => {
  const qr = document.getElementById('displayQR');
  const btn = document.getElementById('qrVisibilityBtn');
  if (!qr) return;
  const settings = getDisplaySettings(rid);
  settings.qr.hidden = !settings.qr.hidden;
  saveDisplaySettings(rid, settings);
  if (settings.qr.hidden) {
    qr.classList.add('hidden');
    if (btn) btn.textContent = '👁️ Show QR';
  } else {
    qr.classList.remove('hidden');
    if (btn) btn.textContent = '👁️ Hide QR';
  }
};

const toggleUISetting = (rid, setting, value) => {
  const settings = getDisplaySettings(rid);
  settings.ui[setting] = value;
  saveDisplaySettings(rid, settings);
};

const setUIOption = (rid, option, value) => {
  const settings = getDisplaySettings(rid);
  settings.ui[option] = value;
  saveDisplaySettings(rid, settings);
  document.querySelectorAll(`button[onclick*="${option}"]`).forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
};

const resetDisplaySettings = (rid) => {
  if (!confirm('Reset all display settings to default?')) return;
  saveDisplaySettings(rid, JSON.parse(JSON.stringify(DEFAULT_DISPLAY_SETTINGS)));
  location.reload();
};

// QR DRAG
let isDraggingQR = false;
let qrOffsetX = 0;
let qrOffsetY = 0;

const startDragQR = (e) => {
  if (e.target.closest('.qr-toggle-btn')) return;
  const qr = document.getElementById('displayQR');
  if (!qr) return;
  isDraggingQR = true;
  qr.classList.add('dragging');
  const touch = e.touches ? e.touches[0] : e;
  const rect = qr.getBoundingClientRect();
  qrOffsetX = touch.clientX - rect.left;
  qrOffsetY = touch.clientY - rect.top;
  document.addEventListener('mousemove', dragQR);
  document.addEventListener('mouseup', stopDragQR);
  document.addEventListener('touchmove', dragQR);
  document.addEventListener('touchend', stopDragQR);
  e.preventDefault();
};

const dragQR = (e) => {
  if (!isDraggingQR) return;
  const qr = document.getElementById('displayQR');
  if (!qr) return;
  const touch = e.touches ? e.touches[0] : e;
  qr.style.top = `${touch.clientY - qrOffsetY}px`;
  qr.style.bottom = '';
  qr.style.left = `${touch.clientX - qrOffsetX}px`;
  qr.style.right = '';
  e.preventDefault();
};

const stopDragQR = () => {
  if (!isDraggingQR) return;
  isDraggingQR = false;
  const qr = document.getElementById('displayQR');
  if (qr) {
    qr.classList.remove('dragging');
    const rid = window.location.hash.split('/')[2];
    const settings = getDisplaySettings(rid);
    settings.qr.position = { top: qr.style.top, bottom: '', left: qr.style.left, right: '' };
    saveDisplaySettings(rid, settings);
  }
  document.removeEventListener('mousemove', dragQR);
  document.removeEventListener('mouseup', stopDragQR);
  document.removeEventListener('touchmove', dragQR);
  document.removeEventListener('touchend', stopDragQR);
};

// EXPORTS
window.showDisplay = showDisplay;
window.toggleQRControls = toggleQRControls;
window.setQRPosition = setQRPosition;
window.updateQRSize = updateQRSize;
window.updateServingCount = updateServingCount;
window.toggleQRVisibility = toggleQRVisibility;
window.toggleUISetting = toggleUISetting;
window.setUIOption = setUIOption;
window.resetDisplaySettings = resetDisplaySettings;
window.startDragQR = startDragQR;
window.dragQR = dragQR;
window.stopDragQR = stopDragQR;

console.log('✅ QueueApp Display with Notifications Loaded');

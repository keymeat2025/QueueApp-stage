// ============================================================================
// QUEUEAPP - DISPLAY.JS
// Live Display Screen & QR Controls Module
// ============================================================================

// ============================================================================
// LIVE DISPLAY SCREEN
// ============================================================================

async function showDisplay(rid, customerQueueNumber) {
  // Cleanup previous listener
  if (window.displayUnsubscribe) {
    window.displayUnsubscribe();
  }
  
  // Set up real-time listener
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
    
    const maxCards = window.innerWidth < 768 ? 5 : window.innerWidth < 1024 ? 7 : 10;
    const justCalled = allocatedQueue.slice(-maxCards);
    
    // Filter waiting queue if customer-specific view
    const displayWaitingQueue = customerQueueNumber 
      ? waitingQueue.filter(q => q.queueNumber === customerQueueNumber)
      : waitingQueue;
    
    // Responsive card sizing
    const cardSize = justCalled.length <= 3 ? 'min(400px,100%)' : justCalled.length <= 6 ? 'min(320px,100%)' : 'min(250px,100%)';
    const cardPadding = justCalled.length <= 3 ? 'clamp(2rem,4vw,4rem)' : justCalled.length <= 6 ? 'clamp(1.5rem,3vw,3rem)' : 'clamp(1rem,2vw,2rem)';
    const queueFontSize = justCalled.length <= 3 ? 'clamp(6rem,15vw,12rem)' : justCalled.length <= 6 ? 'clamp(5rem,12vw,10rem)' : 'clamp(4rem,10vw,8rem)';
    const nameFontSize = justCalled.length <= 3 ? 'clamp(2rem,6vw,4rem)' : justCalled.length <= 6 ? 'clamp(1.75rem,5vw,3.5rem)' : 'clamp(1.5rem,4vw,3rem)';
    const tableFontSize = justCalled.length <= 3 ? 'clamp(3rem,8vw,6rem)' : justCalled.length <= 6 ? 'clamp(2.5rem,7vw,5rem)' : 'clamp(2rem,6vw,4rem)';
    const guestFontSize = justCalled.length <= 3 ? 'clamp(1.5rem,4vw,3rem)' : justCalled.length <= 6 ? 'clamp(1.25rem,3.5vw,2.5rem)' : 'clamp(1rem,3vw,2rem)';
    
    render(`
      <div class="display-screen" style="position:relative">
        ${customerQueueNumber ? '' : `
          <div class="qr-controls" id="qrControls">
            <button class="qr-toggle-btn" onclick="toggleQRControls()" style="position:absolute;top:.5rem;right:.5rem">⚙️</button>
            <div class="qr-controls-content">
              <h3>🎛️ QR Settings</h3>
              <div class="control-group">
                <label style="font-size:.875rem;display:block;margin-bottom:.5rem">Position:</label>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem">
                  <button class="qr-control-btn small" onclick="setQRPosition('top-left')">↖ Top Left</button>
                  <button class="qr-control-btn small" onclick="setQRPosition('top-right')">↗ Top Right</button>
                  <button class="qr-control-btn small" onclick="setQRPosition('bottom-left')">↙ Bottom Left</button>
                  <button class="qr-control-btn small" onclick="setQRPosition('bottom-right')">↘ Bottom Right</button>
                </div>
              </div>
              <div class="control-group qr-size-control">
                <label>Size: <span id="qrSizeLabel">250</span>px</label>
                <input type="range" class="qr-size-slider" id="qrSizeSlider" min="150" max="450" value="250" step="10" oninput="updateQRSize(this.value)">
              </div>
              <div class="control-group" style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem">
                <button class="qr-control-btn" onclick="toggleQRVisibility()">👁️ Hide QR</button>
                <button class="qr-control-btn" onclick="resetQRSettings()">🔄 Reset</button>
              </div>
              <div style="margin-top:.75rem;padding-top:.75rem;border-top:1px solid rgba(255,255,255,.2);font-size:.75rem;color:rgba(255,255,255,.7);text-align:center">
                💡 Drag QR to move freely
              </div>
            </div>
          </div>
        `}
        
        ${customerQueueNumber ? '' : `
          <div class="display-qr-fixed" id="displayQR" onmousedown="startDragQR(event)" ontouchstart="startDragQR(event)">
            <div class="qr-card" style="background:linear-gradient(135deg,#fff7ed 0%,#ffedd5 100%);padding:clamp(1rem,3vw,2rem);border-radius:clamp(1rem,2vw,2rem);box-shadow:0 8px 32px rgba(0,0,0,.3);border:5px solid var(--primary)">
              <div style="text-align:center;margin-bottom:1rem">
                <div class="qr-text" style="font-size:clamp(1.25rem,2.5vw,2.5rem);font-weight:900;color:var(--primary);margin-bottom:.5rem;animation:pulse-badge 1.5s infinite">
                  👉 SCAN HERE 👈
                </div>
                <div class="qr-text" style="font-size:clamp(.875rem,1.5vw,1.5rem);font-weight:700;color:var(--gray-900);margin-bottom:.5rem">
                  Welcome! 🎉
                </div>
                <div class="qr-text" style="font-size:clamp(.75rem,1.1vw,1.1rem);color:var(--gray-700);line-height:1.4">
                  Join our queue instantly with your phone
                </div>
              </div>
              <div style="background:white;padding:clamp(1rem,2vw,1.5rem);border-radius:clamp(1rem,1.5vw,1.5rem);box-shadow:0 4px 12px rgba(0,0,0,.1);position:relative;display:flex;justify-content:center">
                <div id="display-qr" style="background:white;display:inline-block"></div>
              </div>
              <div style="text-align:center;margin-top:1rem">
                <div class="qr-text" style="font-size:clamp(.875rem,1.3vw,1.3rem);color:var(--primary);font-weight:700">
                  📱 Open Camera & Scan
                </div>
                <div class="qr-text" style="font-size:clamp(.65rem,1vw,1rem);color:var(--gray-600);margin-top:.3rem">
                  No app needed!
                </div>
              </div>
            </div>
          </div>
        `}
        
        <div class="container">
          <div class="text-center mb" style="padding-bottom:clamp(1rem,2vw,2rem);border-bottom:4px solid var(--primary)">
            <h1 style="color:var(--primary)">${restaurant.name}</h1>
            <p style="font-size:clamp(1.25rem,3vw,2rem);color:rgba(255,255,255,.7)">Queue Management</p>
            <div style="font-size:clamp(2rem,5vw,3rem);color:var(--primary);font-weight:700;margin-top:.5rem">
              ${new Date().toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'})}
            </div>
            <div style="font-size:clamp(1rem,2vw,1.25rem);color:#10b981;margin-top:.5rem">🔥 Live</div>
          </div>
          
          ${justCalled.length > 0 ? `
            <div class="card mb" style="background:linear-gradient(135deg,rgba(22,163,74,.9),rgba(21,128,61,.9));border:4px solid var(--success);padding:clamp(2rem,4vw,4rem)">
              <h2 class="text-center" style="font-size:clamp(2.5rem,6vw,5rem);margin-bottom:clamp(1rem,2vw,2rem)">
                <span style="font-size:clamp(4rem,10vw,8rem);animation:pulse 2s infinite">🔔</span><br>
                NOW SERVING
              </h2>
              <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(${cardSize},1fr));gap:clamp(1rem,2vw,2rem)">
                ${justCalled.map(allocated => {
                  const isMyTurn = customerQueueNumber && allocated.queueNumber === customerQueueNumber;
                  return `
                    <div class="card text-center" style="background:${isMyTurn ? 'linear-gradient(135deg,#fbbf24 0%,#f59e0b 100%)' : 'white'};padding:${cardPadding};border:4px solid ${isMyTurn ? '#f59e0b' : 'var(--success)'}${isMyTurn ? ';animation:pulse 2s infinite;box-shadow:0 0 40px rgba(251,191,36,.8)' : ''}">
                      <div style="font-size:${queueFontSize};font-weight:900;color:${isMyTurn ? 'white' : 'var(--success)'};margin-bottom:clamp(.5rem,1vw,1rem);text-shadow:${isMyTurn ? '0 4px 8px rgba(0,0,0,.3)' : 'none'}">
                        ${allocated.queueNumber}
                      </div>
                      <div style="background:${isMyTurn ? 'rgba(255,255,255,.3)' : 'var(--gray-50)'};padding:clamp(1rem,2vw,1.5rem);border-radius:clamp(.75rem,1.5vw,1rem);margin-bottom:clamp(.75rem,1.5vw,1rem)">
                        <div style="font-size:${nameFontSize};font-weight:700;color:${isMyTurn ? 'white' : 'var(--gray-900)'};margin-bottom:clamp(.5rem,1vw,1rem);text-shadow:${isMyTurn ? '0 2px 4px rgba(0,0,0,.2)' : 'none'}">
                          ${allocated.name}
                        </div>
                        <div style="font-size:${guestFontSize};color:${isMyTurn ? 'rgba(255,255,255,.9)' : 'var(--gray-600)'};font-weight:600">
                          👥 ${allocated.guests} Guest${allocated.guests !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div style="background:${isMyTurn ? 'white' : 'linear-gradient(135deg,var(--success) 0%,#059669 100%)'};color:${isMyTurn ? 'var(--primary)' : 'white'};padding:clamp(1rem,2vw,1.5rem);border-radius:clamp(.75rem,1.5vw,1rem);box-shadow:0 4px 12px rgba(0,0,0,.2)">
                        <div style="font-size:clamp(.875rem,2vw,1.25rem);font-weight:700;margin-bottom:.25rem">TABLE</div>
                        <div style="font-size:${tableFontSize};font-weight:900">${allocated.tableNo}</div>
                      </div>
                      ${isMyTurn ? `
                        <div style="margin-top:clamp(1rem,2vw,1.5rem);background:white;color:var(--primary);padding:clamp(.75rem,1.5vw,1rem);border-radius:clamp(.5rem,1vw,.75rem);font-weight:900;font-size:clamp(1.25rem,3vw,2rem);animation:pulse 2s infinite">
                          🎉 YOUR TURN! 🎉
                        </div>
                      ` : ''}
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          ` : ''}
          
          ${displayWaitingQueue.length > 0 ? `
            <div class="card" style="background:linear-gradient(135deg,rgba(249,115,22,.9),rgba(234,88,12,.9));border:4px solid var(--primary);padding:clamp(2rem,4vw,4rem)">
              <h2 class="text-center" style="font-size:clamp(2rem,5vw,4rem);margin-bottom:clamp(1rem,2vw,2rem)">
                ⏳ WAITING QUEUE
              </h2>
              <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(${cardSize},1fr));gap:clamp(1rem,2vw,2rem)">
                ${displayWaitingQueue.map(w => `
                  <div class="card text-center" style="background:white;padding:${cardPadding}">
                    <div style="font-size:${queueFontSize};font-weight:900;color:var(--primary);margin-bottom:clamp(.5rem,1vw,1rem)">
                      ${w.queueNumber}
                    </div>
                    <div style="background:var(--gray-50);padding:clamp(1rem,2vw,1.5rem);border-radius:clamp(.75rem,1.5vw,1rem)">
                      <div style="font-size:${nameFontSize};font-weight:700;color:var(--gray-900);margin-bottom:clamp(.5rem,1vw,1rem)">
                        ${w.name}
                      </div>
                      <div style="font-size:${guestFontSize};color:var(--gray-600);font-weight:600">
                        👥 ${w.guests} Guest${w.guests !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : justCalled.length === 0 ? `
            <div class="card text-center" style="background:rgba(255,255,255,.1);padding:clamp(3rem,6vw,6rem)">
              <div style="font-size:clamp(4rem,12vw,8rem);margin-bottom:clamp(1rem,2vw,2rem)">😊</div>
              <h2 style="font-size:clamp(2rem,6vw,4rem);color:white">No Queue</h2>
              <p style="font-size:clamp(1.25rem,3vw,2rem);color:rgba(255,255,255,.7);margin-top:1rem">
                All customers served!
              </p>
            </div>
          ` : ''}
        </div>
      </div>
    `);
    
    // Generate QR code if not customer view
    if (!customerQueueNumber) {
      setTimeout(() => {
        generateQRCode('display-qr', rid);
        loadQRSettings(rid);
      }, 100);
    }
  });
}

// ============================================================================
// QR CONTROLS & CUSTOMIZATION
// ============================================================================

const toggleQRControls = () => {
  const controls = document.getElementById('qrControls');
  if (controls) {
    controls.classList.toggle('minimized');
  }
};

const setQRPosition = (position) => {
  const qr = document.getElementById('displayQR');
  if (!qr) return;
  
  qr.style.top = '';
  qr.style.bottom = '';
  qr.style.left = '';
  qr.style.right = '';
  
  switch(position) {
    case 'top-left':
      qr.style.top = '1rem';
      qr.style.left = '1rem';
      break;
    case 'top-right':
      qr.style.top = '1rem';
      qr.style.right = '1rem';
      break;
    case 'bottom-left':
      qr.style.bottom = '1rem';
      qr.style.left = '1rem';
      break;
    case 'bottom-right':
      qr.style.bottom = '1rem';
      qr.style.right = '1rem';
      break;
  }
  
  saveQRSettings();
};

const updateQRSize = (size) => {
  const label = document.getElementById('qrSizeLabel');
  const qrContainer = document.querySelector('#displayQR .qr-card');
  
  if (label) label.textContent = size;
  if (qrContainer) {
    qrContainer.style.transform = `scale(${size / 250})`;
  }
  
  saveQRSettings();
};

const toggleQRVisibility = () => {
  const qr = document.getElementById('displayQR');
  if (!qr) return;
  
  if (qr.classList.contains('hidden')) {
    qr.classList.remove('hidden');
    event.target.textContent = '👁️ Hide QR';
  } else {
    qr.classList.add('hidden');
    event.target.textContent = '👁️ Show QR';
  }
  
  saveQRSettings();
};

const resetQRSettings = () => {
  const qr = document.getElementById('displayQR');
  const slider = document.getElementById('qrSizeSlider');
  
  if (qr) {
    qr.style.top = '';
    qr.style.bottom = '1rem';
    qr.style.left = '';
    qr.style.right = '1rem';
    qr.classList.remove('hidden');
    
    const qrContainer = qr.querySelector('.qr-card');
    if (qrContainer) {
      qrContainer.style.transform = 'scale(1)';
    }
  }
  
  if (slider) {
    slider.value = 250;
    document.getElementById('qrSizeLabel').textContent = '250';
  }
  
  const hideBtn = document.querySelector('.qr-control-btn:nth-child(1)');
  if (hideBtn) hideBtn.textContent = '👁️ Hide QR';
  
  saveQRSettings();
};

// QR Drag functionality
let isDraggingQR = false;
let qrOffsetX = 0;
let qrOffsetY = 0;

const startDragQR = (e) => {
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
  
  qr.style.top = '';
  qr.style.bottom = '';
  qr.style.left = `${touch.clientX - qrOffsetX}px`;
  qr.style.top = `${touch.clientY - qrOffsetY}px`;
  qr.style.right = '';
  
  e.preventDefault();
};

const stopDragQR = (e) => {
  if (!isDraggingQR) return;
  
  isDraggingQR = false;
  const qr = document.getElementById('displayQR');
  if (qr) {
    qr.classList.remove('dragging');
  }
  
  document.removeEventListener('mousemove', dragQR);
  document.removeEventListener('mouseup', stopDragQR);
  document.removeEventListener('touchmove', dragQR);
  document.removeEventListener('touchend', stopDragQR);
  
  saveQRSettings();
};

const saveQRSettings = () => {
  const qr = document.getElementById('displayQR');
  if (!qr) return;
  
  const settings = {
    top: qr.style.top,
    bottom: qr.style.bottom,
    left: qr.style.left,
    right: qr.style.right,
    hidden: qr.classList.contains('hidden'),
    scale: qr.querySelector('.qr-card')?.style.transform || 'scale(1)'
  };
  
  localStorage.setItem('qr-settings', JSON.stringify(settings));
};

const loadQRSettings = (rid) => {
  const savedSettings = localStorage.getItem('qr-settings');
  if (!savedSettings) return;
  
  try {
    const settings = JSON.parse(savedSettings);
    const qr = document.getElementById('displayQR');
    if (!qr) return;
    
    if (settings.top) qr.style.top = settings.top;
    if (settings.bottom) qr.style.bottom = settings.bottom;
    if (settings.left) qr.style.left = settings.left;
    if (settings.right) qr.style.right = settings.right;
    
    if (settings.hidden) {
      qr.classList.add('hidden');
      const hideBtn = document.querySelector('.qr-control-btn:nth-child(1)');
      if (hideBtn) hideBtn.textContent = '👁️ Show QR';
    }
    
    const qrContainer = qr.querySelector('.qr-card');
    if (qrContainer && settings.scale) {
      qrContainer.style.transform = settings.scale;
      const scaleValue = parseFloat(settings.scale.match(/[\d.]+/)?.[0] || 1);
      const size = Math.round(scaleValue * 250);
      const slider = document.getElementById('qrSizeSlider');
      const label = document.getElementById('qrSizeLabel');
      if (slider) slider.value = size;
      if (label) label.textContent = size;
    }
  } catch (e) {
    console.error('Failed to load QR settings:', e);
  }
};

// ============================================================================
// EXPORT TO WINDOW
// ============================================================================

window.showDisplay = showDisplay;
window.toggleQRControls = toggleQRControls;
window.setQRPosition = setQRPosition;
window.updateQRSize = updateQRSize;
window.toggleQRVisibility = toggleQRVisibility;
window.resetQRSettings = resetQRSettings;
window.startDragQR = startDragQR;
window.dragQR = dragQR;
window.stopDragQR = stopDragQR;
window.saveQRSettings = saveQRSettings;
window.loadQRSettings = loadQRSettings;

console.log('✅ QueueApp Display Module Loaded');

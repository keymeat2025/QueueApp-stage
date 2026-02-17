// ============================================================================
// QUEUEAPP - QUEUE.JS (WITH ZONE DISPLAY + CELEBRATION EFFECTS)
// Customer Queue Operations Module
// FIX 1: Zone dropdown not showing on first iPhone scan (cold start)
// FIX 2: Stale cache showing deleted zones (e.g. private/incognito tabs)
// ============================================================================

// ============================================================================
// JOIN QUEUE FLOW
// ============================================================================

async function showJoinQueue(rid) {
  // ── ALWAYS fetch fresh data from Firebase for customer join page ──────────
  // WHY: This page is public-facing and must show accurate zone data.
  //
  // Two bugs were caused by trusting localStorage cache:
  //
  // BUG 1 (Cold start): On first scan, zones.list was undefined/empty in cache
  //   because the nested Firebase array hadn't synced yet → dropdown missing.
  //
  // BUG 2 (Stale cache): Admin deletes a zone → cache still has old zone →
  //   private/incognito tabs (with isolated localStorage) showed deleted zones
  //   → customers joined queue with a zone that no longer exists.
  //
  // FIX: Always fetch from Firebase for this page. Cache is only used as a
  //   fallback if Firebase is unreachable (offline scenario).
  //   Admin pages are unaffected — they manage their own cache separately.
  // ─────────────────────────────────────────────────────────────────────────

  let restaurant = null;

  const freshResult = await FirebaseDB.getRestaurant(rid);
  if (freshResult.success) {
    // Always use fresh Firebase data → zones are always current
    restaurant = freshResult.data;
    DB.restaurants[rid] = restaurant;  // update cache with fresh data
    DB.save();
  } else {
    // Firebase unreachable → fall back to cache so offline still works
    restaurant = DB.restaurants[rid];
  }

  if (!restaurant) {
    render(`<div class="container text-center" style="padding-top:4rem"><h1 style="color:var(--danger)">Restaurant Not Found</h1><button onclick="navigate('/')" class="btn btn-primary mt">Go Home</button></div>`);
    return;
  }

  const zonesEnabledFinal = restaurant.zones && restaurant.zones.enabled;
  const zones = zonesEnabledFinal ? (restaurant.zones.list || []) : [];
  const activeFilter = (typeof getZoneFilter === 'function') ? getZoneFilter() : null;
  const preselectedZone = activeFilter || '';

  render(`
    <div style="min-height:100vh;background:linear-gradient(135deg,var(--primary) 0%,var(--secondary) 100%);display:flex;align-items:center;justify-content:center;padding:clamp(1rem,3vw,2rem)">
      <div class="card" style="max-width:500px;width:100%">
        <h2 class="text-center mb" style="display:flex;align-items:center;justify-content:center;gap:0.5rem"><span style="font-size:1.5rem">📱</span> Add Customer</h2>
        <p class="text-center mb" style="color:var(--gray-600)">${restaurant.name}</p>
        ${preselectedZone ? `<div style="background:#dbeafe;padding:1rem;border-radius:0.75rem;margin-bottom:1rem"><p style="margin:0;font-size:0.875rem;color:#1e40af">✓ Adding to: <strong>${(zones.find(function(z) { return z.id === preselectedZone; }) || {}).name || 'Selected Zone'}</strong></p></div>` : ''}
        <div class="space-y">
          ${zonesEnabledFinal && zones.length > 0 ? `<div><label style="display:block;font-weight:700;margin-bottom:0.5rem;color:#1f2937">Select Floor/Zone:</label><select id="customerZone" style="width:100%;padding:0.75rem;border:2px solid #e5e7eb;border-radius:0.5rem;font-size:1rem;font-weight:600;color:#1f2937;background:white;cursor:pointer">${zones.map(function(zone) { return `<option value="${zone.id}" ${zone.id === preselectedZone ? 'selected' : ''}>${zone.emoji} ${zone.name}</option>`; }).join('')}</select></div>` : ''}
          <input type="text" id="customerName" placeholder="Your Name">
          <input type="tel" id="customerPhone" placeholder="Mobile" maxlength="10">
          <div><label style="display:block;font-weight:600;margin-bottom:.75rem;text-align:center">Number of Guests</label><div class="wheel-picker-container"><div class="wheel-picker-overlay"></div><div class="wheel-picker-highlight"></div><div class="wheel-picker" id="guestPicker">${Array.from({length: 30}, function(_, i) { return i + 1; }).map(function(n) { return `<div class="wheel-item" data-value="${n}">${n}</div>`; }).join('')}</div><div class="wheel-selected-value" id="selectedGuestCount">2</div></div></div>
          <button onclick="handleJoinQueue('${rid}', ${zonesEnabledFinal})" class="btn btn-primary w-full">Add to Queue</button>
        </div>
      </div>
    </div>
    <style>.wheel-picker-container{position:relative;height:200px;overflow:hidden;background:var(--gray-50);border-radius:1rem;margin:1rem auto;max-width:300px}.wheel-picker{height:100%;overflow-y:scroll;scroll-snap-type:y mandatory;scrollbar-width:none;-ms-overflow-style:none;padding:80px 0;cursor:grab}.wheel-picker::-webkit-scrollbar{display:none}.wheel-picker:active{cursor:grabbing}.wheel-item{height:40px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;font-weight:600;scroll-snap-align:center;transition:all 0.3s ease;color:var(--gray-400);user-select:none}.wheel-item.active{color:var(--primary);font-size:2rem;font-weight:900;transform:scale(1.2)}.wheel-picker-highlight{position:absolute;top:50%;left:50%;transform:translate(-50%, -50%);width:90%;height:40px;background:linear-gradient(135deg, var(--primary), var(--secondary));opacity:0.15;border-radius:0.5rem;pointer-events:none;z-index:1}.wheel-picker-overlay{position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(to bottom,var(--gray-50) 0%,transparent 25%,transparent 75%,var(--gray-50) 100%);pointer-events:none;z-index:2}.wheel-selected-value{position:absolute;bottom:1rem;left:50%;transform:translateX(-50%);background:linear-gradient(135deg, var(--primary), var(--secondary));color:white;padding:0.5rem 1.5rem;border-radius:999px;font-weight:700;font-size:0.875rem;z-index:3;pointer-events:none}@media (max-width: 767px){.wheel-picker-container{height:180px}.wheel-item{height:36px;font-size:1.25rem}.wheel-item.active{font-size:1.75rem}}</style>
  `);
  setTimeout(function() { initWheelPicker(); }, 100);
}

function initWheelPicker() {
  const picker = document.getElementById('guestPicker');
  const items = picker.querySelectorAll('.wheel-item');
  const selectedDisplay = document.getElementById('selectedGuestCount');
  window.selectedGuests = 2;
  function updateActiveItem() {
    const pickerRect = picker.getBoundingClientRect();
    const centerY = pickerRect.top + pickerRect.height / 2;
    let closestItem = null;
    let closestDistance = Infinity;
    items.forEach(item => {
      const itemRect = item.getBoundingClientRect();
      const itemCenterY = itemRect.top + itemRect.height / 2;
      const distance = Math.abs(centerY - itemCenterY);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestItem = item;
      }
      item.classList.remove('active');
    });
    if (closestItem) {
      closestItem.classList.add('active');
      const value = parseInt(closestItem.dataset.value);
      window.selectedGuests = value;
      selectedDisplay.textContent = `${value} Guest${value !== 1 ? 's' : ''}`;
    }
  }
  const defaultIndex = 1;
  picker.scrollTop = defaultIndex * 40;
  picker.addEventListener('scroll', updateActiveItem);
  let isScrolling;
  picker.addEventListener('scroll', () => {
    clearTimeout(isScrolling);
    isScrolling = setTimeout(() => { updateActiveItem(); }, 50);
  });
  setTimeout(() => { updateActiveItem(); }, 50);
}

async function handleJoinQueue(rid, zonesEnabled) {
  const name = document.getElementById('customerName').value.trim();
  const phone = document.getElementById('customerPhone').value.trim();
  const guests = window.selectedGuests || 2;
  let zone = null;
  if (zonesEnabled) {
    const zoneSelect = document.getElementById('customerZone');
    zone = zoneSelect ? zoneSelect.value : null;
  } else {
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    zone = urlParams.get('zone');
  }
  if (!name || !phone) {
    alert('⚠️ Fill all fields');
    return;
  }
  if (zonesEnabled && !zone) {
    alert('⚠️ Please select a floor/zone');
    return;
  }
  const btn = event.target;
  btn.textContent = 'Joining...';
  btn.disabled = true;
  try {
    const result = await FirebaseDB.addToQueue(rid, {
      name: name,
      phone: phone,
      guests: guests,
      zone: zone
    });
    if (result.success) {
      const restaurant = DB.restaurants[rid];
      if (restaurant) {
        const today = new Date().toISOString().slice(0, 10);
        const currentMonth = new Date().toISOString().slice(0, 7);
        if (!restaurant.analytics) {
          restaurant.analytics = {
            currentMonth: currentMonth,
            customersThisMonth: 0,
            lastResetDate: today,
            dailyStats: {}
          };
        }
        restaurant.queue.push({
          name: name,
          phone: phone,
          guests: guests,
          zone: zone,
          queueNumber: result.queueNumber,
          status: 'waiting',
          joinedAt: new Date().toISOString()
        });
        restaurant.analytics.customersThisMonth += 1;
        restaurant.analytics.dailyStats[today] = (restaurant.analytics.dailyStats[today] || 0) + 1;
        DB.save();
      }
      showLoadingSuccess(rid, result.queueNumber, result.customersThisMonth, result.limit, zone, guests);
    } else if (result.error === 'LIMIT_REACHED') {
      showUpgradeModal(rid, result);
      btn.textContent = 'Add to Queue';
      btn.disabled = false;
    } else {
      throw new Error(result.error);
    }
  } catch (err) {
    alert(`❌ Error: ${err.message}`);
    btn.textContent = 'Add to Queue';
    btn.disabled = false;
  }
}

function showLoadingSuccess(rid, queueNumber, customersThisMonth, limit, zone, guests) {
  const restaurant = DB.restaurants[rid];
  const zonesEnabled = restaurant.zones && restaurant.zones.enabled;
  let zoneInfo = '';
  if (zone && zonesEnabled) {
    const zoneObj = restaurant.zones.list.find(function(z) { return z.id === zone; });
    if (zoneObj) {
      zoneInfo = `<div style="background:#f59e0b;color:white;display:inline-block;padding:0.75rem 1.5rem;border-radius:999px;margin-bottom:1.5rem;font-weight:700;font-size:clamp(0.875rem,2vw,1.125rem);box-shadow:0 4px 12px rgba(245,158,11,0.4);animation:pulse 2s infinite">${zoneObj.emoji} ${zoneObj.name}</div>`;
    }
  }
  render(`<div style="min-height:100vh;background:linear-gradient(135deg,var(--success) 0%,#059669 100%);display:flex;align-items:center;justify-content:center;color:white;padding:2rem"><div class="text-center" style="max-width:600px;margin:0 auto"><div style="font-size:clamp(5rem,15vw,8rem);margin-bottom:2rem;animation:bounce 1s">✅</div><h1 style="margin-bottom:2rem;font-size:clamp(2rem,6vw,3rem)">You're In!</h1>${zoneInfo}<div class="card" style="background:white;color:var(--gray-900);margin-bottom:2rem"><div style="font-size:clamp(4rem,12vw,6rem);font-weight:900;color:var(--success);margin-bottom:1rem">${queueNumber}</div><p style="font-size:clamp(1.25rem,3vw,1.5rem);font-weight:600">Your Queue Number</p><p style="font-size:clamp(1rem,2.5vw,1.25rem);color:var(--gray-600);margin-top:0.75rem">Table for ${guests} guest${guests !== 1 ? 's' : ''}</p>${limit !== 'unlimited' ? `<p style="font-size:.875rem;color:var(--gray-600);margin-top:1rem">Usage: ${customersThisMonth}/${limit} this month</p>` : ''}</div><div style="background:rgba(255,255,255,.2);padding:clamp(1rem,3vw,1.5rem);border-radius:1rem"><p style="font-size:clamp(1rem,2.5vw,1.25rem);margin-bottom:1rem">📺 Watch the display for your number</p><p style="font-size:clamp(.875rem,2vw,1rem);opacity:.9">Loading your status in <span id="countdown" style="font-weight:900">3</span> seconds...</p></div></div></div><style>@keyframes bounce{0%, 100%{transform:translateY(0)}50%{transform:translateY(-20px)}}</style>`);
  let seconds = 3;
  const countdownInterval = setInterval(() => {
    seconds--;
    const countdownEl = document.getElementById('countdown');
    if (countdownEl) {
      countdownEl.textContent = seconds;
    }
    if (seconds <= 0) {
      clearInterval(countdownInterval);
      navigate(`/r/${rid}/status/${queueNumber}`);
    }
  }, 1000);
}

function showUpgradeModal(rid, result) {
  render(`<div style="min-height:100vh;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;padding:2rem"><div class="card" style="max-width:600px;border:3px solid var(--warning)"><div class="text-center"><div style="font-size:clamp(3rem,10vw,5rem)">🚫</div><h2 style="color:var(--warning);margin:1rem 0;font-size:clamp(1.25rem,4vw,2rem)">Monthly Limit Reached</h2><p style="font-size:clamp(1rem,2.5vw,1.25rem);margin-bottom:1rem">Free plan limit of <strong>500 customers/month</strong> reached.</p><div class="card" style="background:#fef9c3;margin:2rem 0"><div style="font-size:clamp(2rem,6vw,3rem);font-weight:900;color:var(--warning)">${result.customersUsed} / ${result.limit}</div><p>Customers this month</p></div><p style="margin-bottom:2rem;color:var(--gray-600)">Restaurant needs Premium for unlimited customers.</p><div class="flex gap-1 flex-wrap justify-center"><button onclick="navigate('/r/${rid}/join')" class="btn btn-secondary">← Back</button><button onclick="navigate('/pricing')" class="btn btn-primary">Learn More</button></div></div></div></div>`);
}

// ============================================================================
// QUEUE STATUS PAGE (WITH ZONE DISPLAY + CELEBRATION)
// ============================================================================

async function showQueueStatus(rid, queueNumber) {
  render(`<div style="min-height:100vh;background:var(--primary);display:flex;align-items:center;justify-content:center;color:white;padding:2rem"><div class="text-center"><div style="font-size:clamp(2.5rem,8vw,4rem);margin-bottom:1rem;animation:pulse 2s infinite">⏳</div><h2 style="font-size:clamp(1.25rem,4vw,2rem)">Loading your queue status...</h2></div></div>`);
  await new Promise(resolve => setTimeout(resolve, 500));
  if (window.statusUnsubscribe) {
    window.statusUnsubscribe();
  }
  window.statusUnsubscribe = db.collection('restaurants').doc(rid).onSnapshot(doc => {
    if (!doc.exists) {
      render(`<div class="container text-center" style="padding-top:4rem"><h1 style="color:var(--danger)">Restaurant Not Found</h1><button onclick="navigate('/')" class="btn btn-primary mt">Go Home</button></div>`);
      return;
    }
    const restaurant = doc.data();
    DB.restaurants[rid] = restaurant;
    DB.save();
    const myQueue = restaurant.queue.find(q => q.queueNumber === queueNumber);
    if (!myQueue) {
      render(`<div class="container text-center" style="padding-top:4rem"><h1>Queue Number Not Found</h1><p style="color:var(--gray-600);margin:2rem 0">Queue #${queueNumber} not found. It may have been served or the queue was reset.</p><button onclick="navigate('/r/${rid}/join')" class="btn btn-primary mt">Join Queue Again</button><button onclick="navigate('/r/${rid}/display')" class="btn btn-secondary mt">View Display</button></div>`);
      return;
    }

    // ✅ GET ZONE INFORMATION
    const zonesEnabled = restaurant.zones && restaurant.zones.enabled;
    let zoneDisplay = '';
    if (myQueue.zone && zonesEnabled) {
      const zoneObj = restaurant.zones.list.find(function(z) { return z.id === myQueue.zone; });
      if (zoneObj) {
        zoneDisplay = `${zoneObj.emoji} ${zoneObj.name}`;
      }
    }

    const allocationKey = `allocated_${rid}_${queueNumber}`;
    const wasAllocated = sessionStorage.getItem(allocationKey);
    if (myQueue.status === 'allocated' && !wasAllocated) {
      sessionStorage.setItem(allocationKey, 'true');
      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200, 100, 200, 100, 200]);
      }
      playBellSound();
      triggerConfetti();
    }
    const isAllocated = myQueue.status === 'allocated';
    const statusText = isAllocated ? 'Seated' : 'Waiting';
    const bgColor = isAllocated ? 'var(--success)' : 'var(--primary)';

    if (isAllocated) {
      // ✅ ALLOCATED STATE (GREEN) - WITH ZONE IN HEADER AND TABLE DISPLAY
      render(`
        <div style="min-height:100vh;background:${bgColor};position:relative">
          <div id="confetti-container" style="position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999"></div>
          <div style="position:sticky;top:0;background:rgba(0,0,0,.3);backdrop-filter:blur(10px);padding:1rem;z-index:100;border-bottom:3px solid white">
            <div style="max-width:1200px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap">
              <div style="color:white">
                <div style="font-size:clamp(1rem,2.5vw,1.5rem);font-weight:700">
                  Status: ${statusText} ${zoneDisplay ? '| ' + zoneDisplay : ''} | Queue: #${queueNumber}
                </div>
              </div>
              <div style="display:flex;gap:.5rem;flex-wrap:wrap">
                <button onclick="navigate('/r/${rid}/display/${queueNumber}')" class="btn btn-secondary" style="font-size:.875rem;padding:.5rem 1rem;background:white;color:var(--success)">📺 Display</button>
              </div>
            </div>
          </div>
          <div style="display:flex;align-items:center;justify-content:center;color:white;padding:2rem;min-height:calc(100vh - 100px)">
            <div class="text-center" style="max-width:600px;margin:0 auto">
              <div style="font-size:clamp(5rem,15vw,8rem);margin-bottom:2rem;animation:pulse 1.5s infinite">🎉</div>
              <h1 style="margin-bottom:2rem;font-size:clamp(2rem,6vw,3rem)">Table Ready!</h1>
              ${zoneDisplay ? `<div style="background:rgba(255,255,255,0.2);color:white;display:inline-block;padding:0.75rem 1.5rem;border-radius:999px;margin-bottom:1.5rem;font-weight:700;font-size:clamp(0.875rem,2vw,1.125rem);box-shadow:0 4px 12px rgba(0,0,0,0.2)">${zoneDisplay}</div>` : ''}
              <div class="card" style="background:white;color:var(--gray-900)">
                <div style="font-size:clamp(6rem,20vw,12rem);font-weight:900;color:var(--success);margin-bottom:1rem">${myQueue.tableNo}</div>
                <p style="font-size:clamp(1.25rem,4vw,2rem);margin-bottom:1rem">Table Number</p>
                <div style="padding:1rem;background:var(--gray-50);border-radius:1rem;margin-top:1rem">
                  <p style="font-size:clamp(1.125rem,3vw,1.375rem);font-weight:600;color:var(--gray-700)">Queue: ${queueNumber}</p>
                  <p style="font-size:clamp(1rem,2.5vw,1.25rem);font-weight:600;color:var(--gray-700);margin-top:0.5rem">${myQueue.name}</p>
                  <p style="font-size:clamp(.875rem,2vw,1rem);color:var(--gray-600)">${myQueue.guests} guest${myQueue.guests !== 1 ? 's' : ''}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      `);
    } else {
      // ✅ WAITING STATE (ORANGE) - WITH ZONE IN HEADER AND BELOW QUEUE NUMBER
      render(`
        <div style="min-height:100vh;background:${bgColor};position:relative">
          <div style="position:sticky;top:0;background:rgba(0,0,0,.3);backdrop-filter:blur(10px);padding:1rem;z-index:100;border-bottom:3px solid white">
            <div style="max-width:1200px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap">
              <div style="color:white">
                <div style="font-size:clamp(1rem,2.5vw,1.5rem);font-weight:700">
                  Status: ${statusText} ${zoneDisplay ? '| ' + zoneDisplay : ''} | Queue: #${queueNumber}
                </div>
              </div>
              <div style="display:flex;gap:.5rem;flex-wrap:wrap">
                <button onclick="navigate('/r/${rid}/display/${queueNumber}')" class="btn btn-secondary" style="font-size:.875rem;padding:.5rem 1rem;background:white;color:var(--primary)">📺 Display</button>
              </div>
            </div>
          </div>
          <div style="display:flex;align-items:center;justify-content:center;color:white;padding:2rem;min-height:calc(100vh - 100px)">
            <div class="text-center" style="max-width:600px;margin:0 auto">
              <h1 style="margin-bottom:2rem;font-size:clamp(1.5rem,5vw,2.5rem)">Still in Queue</h1>
              ${zoneDisplay ? `<div style="background:rgba(255,255,255,0.2);color:white;display:inline-block;padding:0.75rem 1.5rem;border-radius:999px;margin-bottom:1.5rem;font-weight:700;font-size:clamp(0.875rem,2vw,1.125rem);box-shadow:0 4px 12px rgba(0,0,0,0.2)">${zoneDisplay}</div>` : ''}
              <div class="card" style="background:white;color:var(--gray-900)">
                <div style="font-size:clamp(6rem,20vw,12rem);font-weight:900;color:var(--primary);margin-bottom:1rem">${queueNumber}</div>
                <p style="font-size:clamp(1.25rem,4vw,2rem);margin-bottom:1rem">Your Queue Number</p>
                <div style="padding:1rem;background:var(--gray-50);border-radius:1rem;margin-top:1rem">
                  <p style="font-size:clamp(1.25rem,3vw,1.5rem);font-weight:600;color:var(--gray-700)">${myQueue.name}</p>
                  <p style="font-size:clamp(.875rem,2vw,1rem);color:var(--gray-600)">${myQueue.guests} guest${myQueue.guests !== 1 ? 's' : ''}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      `);
    }
  });
}

// ============================================================================
// CELEBRATION EFFECTS
// ============================================================================

function playBellSound() {
  try {
    const audio = new Audio('data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAASAAAeMAAUFBQUFCIiIiIiIjAwMDAwPj4+Pj4+TExMTExZWVlZWVlnZ2dnZ3V1dXV1dYODg4ODkZGRkZGRn5+fn5+frKysrKy6urq6urrIyMjIyNbW1tbW1uTk5OTk8vLy8vLy//////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAB4wf9IAAAAAAAAAAAAAAAAAAP/7kGQAAADggBVwQFHECfBDgP7/PgAAI0yfgAAA04AABpBgAABGQYPBgYGBgYGBgY4ODg4PDw8PDw8PDw8PDw8PDw8PDw8QEBAQEBAQEBAQEREREREREhISEhISEhMTExMTExMUFBQUFBQVFRUVFRUVFhYWFhYWFhcXFxcXFxgYGBgYGBgZGRkZGRkaGhoaGhobGxsbGxscHBwcHBwdHR0dHR0eHh4eHh4fHx8fHx//+xBkA4AA1cAXU8Y5w4pAAer/DzgDQwBd7xzpDgMAA734PMMAgICAg4SEhISEhYaGhoaGh4iIiIiIiYqKioqKi4yMjIyMjY6Ojo6Oj5CQkJCQkZKSkpKSk5SVlZWVlpeYmJiYmJqbm5ubm52enp6en6ChoaGho6SkpKSlpqenp6epqqqqq6ytra2tr7CwsLCxsrKysrO0tbW1tbe4uLi4uru8vLy9vr+/v7/A');
    audio.play().catch(() => {});
  } catch (e) {}
}

function triggerConfetti() {
  const container = document.getElementById('confetti-container');
  if (!container) return;
  const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffa500', '#ff1493'];
  for (let i = 0; i < 150; i++) {
    setTimeout(() => {
      const confetti = document.createElement('div');
      confetti.style.cssText = `position:absolute;width:10px;height:10px;background:${colors[Math.floor(Math.random()*colors.length)]};top:-20px;left:${Math.random()*100}%;opacity:1;border-radius:${Math.random()>0.5?'50%':'0'};animation:confettiFall ${2+Math.random()*3}s linear forwards;transform:rotate(${Math.random()*360}deg)`;
      container.appendChild(confetti);
      setTimeout(() => confetti.remove(), 5000);
    }, i * 30);
  }
  const style = document.createElement('style');
  style.textContent = '@keyframes confettiFall{0%{transform:translateY(0) rotate(0deg)}100%{transform:translateY(100vh) rotate(720deg);opacity:0}}';
  document.head.appendChild(style);
}

// ============================================================================
// EXPORT TO WINDOW
// ============================================================================

window.showJoinQueue=showJoinQueue;window.handleJoinQueue=handleJoinQueue;window.showLoadingSuccess=showLoadingSuccess;window.showUpgradeModal=showUpgradeModal;window.showQueueStatus=showQueueStatus;window.initWheelPicker=initWheelPicker;window.playBellSound=playBellSound;window.triggerConfetti=triggerConfetti;
console.log('✅ QueueApp Queue Module Loaded (with Zone Display + Celebration)');
console.log('✅ Fix 1: Zone dropdown now loads correctly on first iPhone scan (cold start)');
console.log('✅ Fix 2: Customer join page always fetches fresh Firebase data - stale cache eliminated');

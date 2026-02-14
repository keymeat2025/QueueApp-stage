// ============================================================================
// QUEUEAPP - MULTIZONE.JS (COMPLETE & TESTED)
// Multi-Zone Queue Management Module (Premium Feature)
// Version: 1.0 - Production Ready
// ============================================================================

console.log('🏢 Loading Multi-Zone Module...');

// ============================================================================
// ZONE HELPER FUNCTIONS
// ============================================================================

/**
 * Generate zone-specific QR code URL
 */
function getZoneQRCode(rid, zoneId) {
  return window.location.origin + "/#/r/" + rid + "/join?zone=" + zoneId;
}

/**
 * Generate sanitized zone ID from zone name
 */
function generateZoneId(zoneName) {
  return zoneName.toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 20);
}

/**
 * Get zone name from zone ID
 */
function getZoneName(rid, zoneId) {
  const restaurant = DB.restaurants[rid];
  if (!restaurant || !restaurant.zones || !restaurant.zones.enabled) {
    return '';
  }
  
  const zone = restaurant.zones.list.find(function(z) {
    return z.id === zoneId;
  });
  return zone ? zone.name : '';
}

/**
 * Get zone object from zone ID
 */
function getZone(rid, zoneId) {
  const restaurant = DB.restaurants[rid];
  if (!restaurant || !restaurant.zones || !restaurant.zones.enabled) {
    return null;
  }
  
  return restaurant.zones.list.find(function(z) {
    return z.id === zoneId;
  }) || null;
}

/**
 * Check if multi-zone is enabled for restaurant
 */
function isMultiZoneEnabled(restaurant) {
  return restaurant.zones && restaurant.zones.enabled === true;
}

/**
 * Get max zones allowed for plan
 */
function getMaxZonesForPlan(planPrice) {
  planPrice = planPrice || 1999;
  
  if (planPrice === 1999) return 3;
  if (planPrice === 2598) return 5;
  if (planPrice === 2998) return 10;
  if (planPrice >= 3000) return 999;
  
  return 3; // Fallback
}

/**
 * Get upgrade message for next tier
 */
function getUpgradeMessage(planPrice) {
  planPrice = planPrice || 1999;
  
  if (planPrice === 1999) {
    return 'Upgrade to ₹2,598/quarter for up to 5 zones (4-5 zones addon +₹599)';
  }
  if (planPrice === 2598) {
    return 'Upgrade to ₹2,998/quarter for up to 10 zones (6-10 zones addon +₹999)';
  }
  if (planPrice === 2998) {
    return 'Contact us for Enterprise plan (11+ zones) - Custom pricing';
  }
  
  return 'Contact us for more zones';
}

// ============================================================================
// ACTIVE ZONE FILTER STATE
// ============================================================================

let activeZoneFilter = null;

/**
 * Set active zone filter
 */
function setZoneFilter(rid, zoneId) {
  activeZoneFilter = zoneId;
  console.log('[ZONE FILTER] Set to:', zoneId || 'all');
}

/**
 * Get currently active zone filter
 */
function getZoneFilter() {
  return activeZoneFilter;
}

/**
 * Clear zone filter (show all)
 */
function clearZoneFilter() {
  activeZoneFilter = null;
}

// ============================================================================
// MULTI-ZONE UI GENERATOR (For Admin Dashboard)
// ============================================================================

/**
 * Generate Multi-Zone UI HTML for QR Code section
 */
function generateMultiZoneUI(rid, restaurant) {
  const isPremium = isPremiumActive(restaurant);
  const zonesEnabled = isMultiZoneEnabled(restaurant);
  
  // FREE USER - Show teaser
  if (!isPremium) {
    return `
      <!-- MULTI-ZONE TEASER (FREE USER) -->
      <div style="background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%);padding:1.5rem;border-radius:1rem;border:3px dashed #f59e0b;position:relative;overflow:hidden;margin-top:1.5rem">
        
        <!-- Premium Badge -->
        <div style="position:absolute;top:0.75rem;right:0.75rem;background:#dc2626;color:white;padding:0.25rem 0.75rem;border-radius:999px;font-size:0.75rem;font-weight:700">
          🔒 PREMIUM
        </div>

        <h4 style="margin:0 0 0.75rem 0;color:#92400e">🏢 Multi-Zone Queue Management</h4>
        <p style="margin:0 0 1rem 0;font-size:0.875rem;color:#92400e">Manage multiple floors with separate QR codes</p>
        
        <!-- Blurred Preview -->
        <div style="opacity:0.4;filter:blur(3px);margin-bottom:1rem;pointer-events:none">
          <div style="background:white;padding:1rem;border-radius:0.5rem">
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
              <div style="background:#f59e0b;color:white;padding:0.5rem 1rem;border-radius:0.5rem;font-size:0.75rem">🏢 Ground Floor</div>
              <div style="background:#f59e0b;color:white;padding:0.5rem 1rem;border-radius:0.5rem;font-size:0.75rem">🏢 First Floor</div>
              <div style="background:#f59e0b;color:white;padding:0.5rem 1rem;border-radius:0.5rem;font-size:0.75rem">🌳 Garden</div>
            </div>
          </div>
        </div>

        <!-- Unlock Button -->
        <button 
          onclick="sessionStorage.setItem('upgrade_source','multizone_teaser');navigate('/pricing')" 
          style="background:linear-gradient(135deg,#f97316 0%,#ec4899 100%);color:white;border:none;padding:1rem 1.5rem;border-radius:0.75rem;cursor:pointer;font-weight:700;width:100%;font-size:1rem;box-shadow:0 4px 12px rgba(249,115,22,0.4)"
        >
          ⚡ Unlock Multi-Zone (from ₹1,999/3mo)
        </button>
        
        <p style="margin:0.75rem 0 0 0;text-align:center;font-size:0.75rem;color:#92400e">Includes: Unlimited customers • Auto cleanup • Analytics</p>
      </div>
    `;
  }
  
  // PREMIUM USER - Zones NOT configured yet
  if (!zonesEnabled) {
    return `
      <!-- MULTI-ZONE SETUP (PREMIUM - NOT CONFIGURED) -->
      <div style="background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%);padding:1.5rem;border-radius:1rem;border:3px solid #f59e0b;margin-top:1.5rem">
        
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
          <div>
            <h4 style="margin:0;color:#92400e">🏢 Multi-Zone Management</h4>
            <p style="margin:0.25rem 0 0 0;font-size:0.75rem;color:#92400e">✨ Premium Feature Available</p>
          </div>
          <span style="background:#22c55e;color:white;padding:0.25rem 0.75rem;border-radius:999px;font-size:0.75rem;font-weight:700">PREMIUM</span>
        </div>

        <p style="margin:0 0 1rem 0;font-size:0.875rem;color:#92400e">
          Create separate QR codes for different floors or zones (Ground Floor, First Floor, Garden, etc.)
        </p>

        <button 
          onclick="showZoneConfigModal('${rid}')" 
          style="background:#f59e0b;color:white;border:none;padding:1rem 1.5rem;border-radius:0.75rem;cursor:pointer;font-weight:700;width:100%;font-size:1rem"
        >
          ⚙️ Configure Zones
        </button>
      </div>
    `;
  }
  
  // PREMIUM USER - Zones CONFIGURED and ENABLED
  const zones = restaurant.zones.list || [];
  const currentFilter = getZoneFilter();
  const currentZone = currentFilter ? zones.find(z => z.id === currentFilter) : null;
  
  return `
    <!-- MULTI-ZONE MANAGEMENT (PREMIUM - ACTIVE) -->
    <div style="background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%);padding:1.5rem;border-radius:1rem;margin-top:1.5rem;border:3px solid #f59e0b">
      
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:0.5rem">
        <div>
          <h4 style="margin:0;color:#92400e">🏢 Multi-Zone Management</h4>
          <p style="margin:0.25rem 0 0 0;font-size:0.75rem;color:#92400e">✨ Premium Feature Active</p>
        </div>
        <button 
          onclick="showZoneConfigModal('${rid}')" 
          style="background:#f59e0b;color:white;border:none;padding:0.5rem 1rem;border-radius:0.5rem;cursor:pointer;font-weight:700;font-size:0.875rem"
        >
          ⚙️ Manage Zones
        </button>
      </div>

      <!-- Zone Filter Buttons -->
      <div style="background:white;padding:1rem;border-radius:0.75rem;margin-bottom:1rem">
        <p style="margin:0 0 0.75rem 0;font-weight:700;font-size:0.875rem;color:#4b5563">FILTER VIEW:</p>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
          ${zones.map(zone => `
            <button 
              onclick="filterZone('${rid}', '${zone.id}')" 
              id="zone-btn-${zone.id}"
              class="zone-filter-btn"
              style="background:${currentFilter === zone.id ? '#f59e0b' : '#d1d5db'};color:${currentFilter === zone.id ? 'white' : '#1f2937'};border:none;padding:0.5rem 1rem;border-radius:0.5rem;cursor:pointer;font-weight:700;font-size:0.75rem;transition:all 0.2s"
            >
              ${zone.emoji} ${zone.name} <span style="background:rgba(${currentFilter === zone.id ? '255,255,255' : '0,0,0'},0.2);padding:0.15rem 0.4rem;border-radius:999px;margin-left:0.25rem">${zone.scansToday || 0}</span>
            </button>
          `).join('')}
          <button 
            onclick="filterZone('${rid}', null)" 
            id="zone-btn-all"
            class="zone-filter-btn"
            style="background:${!currentFilter ? '#6b7280' : '#d1d5db'};color:white;border:none;padding:0.5rem 1rem;border-radius:0.5rem;cursor:pointer;font-weight:700;font-size:0.75rem"
          >
            🔄 All
          </button>
        </div>
      </div>

      <!-- Current Zone QR Display -->
      ${currentZone ? `
        <div style="background:white;padding:1.25rem;border-radius:0.75rem;text-align:center">
          <div style="background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);color:white;display:inline-block;padding:0.5rem 1rem;border-radius:999px;margin-bottom:1rem">
            <p style="margin:0;font-weight:700;font-size:0.875rem">${currentZone.emoji} ${currentZone.name.toUpperCase()} QR CODE</p>
          </div>
          
          <div style="background:white;padding:1rem;border-radius:1rem;display:inline-block;box-shadow:0 4px 12px rgba(0,0,0,0.1);margin-bottom:1rem">
            <div id="zone-qr-${currentZone.id}"></div>
          </div>
          
          <p style="margin:0 0 0.5rem 0;font-size:0.875rem;color:#6b7280">Scans today: <strong style="color:#f59e0b">${currentZone.scansToday || 0}</strong></p>
          <p style="margin:0;font-size:0.75rem;color:#6b7280;font-family:monospace;word-break:break-all">${getZoneQRCode(rid, currentZone.id)}</p>
          
          <div style="display:flex;gap:0.5rem;justify-content:center;margin-top:1rem;flex-wrap:wrap">
            <button onclick="downloadZoneQR('${rid}','${currentZone.id}')" style="background:#4b5563;color:white;border:none;padding:0.5rem 1rem;border-radius:0.5rem;cursor:pointer;font-weight:700;font-size:0.75rem">
              💾 Download
            </button>
            <button onclick="copyZoneQRLink('${rid}','${currentZone.id}')" style="background:#3b82f6;color:white;border:none;padding:0.5rem 1rem;border-radius:0.5rem;cursor:pointer;font-weight:700;font-size:0.75rem">
              🔗 Copy Link
            </button>
            <button onclick="printZoneQR('${currentZone.id}')" style="background:#22c55e;color:white;border:none;padding:0.5rem 1rem;border-radius:0.5rem;cursor:pointer;font-weight:700;font-size:0.75rem">
              🖨️ Print
            </button>
          </div>
        </div>
      ` : `
        <div style="background:#dbeafe;padding:1rem;border-radius:0.75rem;text-align:center">
          <p style="margin:0;font-size:0.875rem;color:#1e40af">
            👆 Click a zone button above to view that zone's QR code
          </p>
        </div>
      `}

    </div>
  `;
}

// ============================================================================
// ZONE FILTERING LOGIC
// ============================================================================

/**
 * Filter queue and refresh dashboard
 */
function filterZone(rid, zoneId) {
  setZoneFilter(rid, zoneId);
  
  // Refresh dashboard to apply filter
  showRestaurantAdmin(rid);
}

/**
 * Apply zone filter to queue array
 */
function applyZoneFilter(queue, zoneFilter) {
  if (!zoneFilter) {
    return queue; // Show all
  }
  return queue.filter(function(item) {
    return item.zone === zoneFilter;
  });
}

// ============================================================================
// ZONE QR CODE ACTIONS
// ============================================================================

/**
 * Download zone-specific QR code
 */
function downloadZoneQR(rid, zoneId) {
  const qrContainer = document.getElementById('zone-qr-' + zoneId);
  const canvas = qrContainer ? qrContainer.querySelector('canvas') : null;
  
  if (!canvas) {
    // QR not generated yet, generate it first
    alert('❌ QR code not ready. Generating now...');
    
    if (qrContainer) {
      qrContainer.innerHTML = '';
      new QRCode(qrContainer, {
        text: getZoneQRCode(rid, zoneId),
        width: 200,
        height: 200,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
      });
      
      // Retry download after generation
      setTimeout(function() {
        downloadZoneQR(rid, zoneId);
      }, 500);
    }
    return;
  }
  
  const restaurant = DB.restaurants[rid];
  const zoneName = getZoneName(rid, zoneId);
  
  const link = document.createElement('a');
  link.download = 'QueueApp-' + restaurant.name + '-' + zoneName + '-QR.png';
  link.href = canvas.toDataURL();
  link.click();
  
  alert('✅ QR code downloaded!');
}

/**
 * Copy zone-specific QR link
 */
function copyZoneQRLink(rid, zoneId) {
  const url = getZoneQRCode(rid, zoneId);
  navigator.clipboard.writeText(url).then(function() {
    alert('✅ Zone link copied to clipboard!\n\n' + url);
  }).catch(function() {
    prompt('Copy this link:', url);
  });
}

/**
 * Print zone QR code
 */
function printZoneQR(zoneId) {
  // Create a hidden print container with ONLY the zone QR
  const canvas = document.querySelector('#zone-qr-' + zoneId + ' canvas');
  if (!canvas) {
    alert('❌ QR code not found. Please try again.');
    return;
  }
  
  // Create printable HTML
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Zone QR Code - Print</title>
      <style>
        body {
          margin: 0;
          padding: 20px;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
        }
        .print-container {
          text-align: center;
        }
        img {
          max-width: 400px;
          height: auto;
        }
        @media print {
          body {
            margin: 0;
            padding: 0;
          }
        }
      </style>
    </head>
    <body>
      <div class="print-container">
        <img src="${canvas.toDataURL()}" />
      </div>
      <script>
        window.onload = function() {
          window.print();
          setTimeout(function() {
            window.close();
          }, 100);
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// ============================================================================
// ZONE CONFIGURATION MODAL
// ============================================================================

/**
 * Show zone configuration modal
 */
function showZoneConfigModal(rid) {
  const restaurant = DB.restaurants[rid];
  const zonesEnabled = isMultiZoneEnabled(restaurant);
  const existingZones = zonesEnabled ? restaurant.zones.list : [];
  const planPrice = restaurant.planPrice || 1999;
  const maxZones = getMaxZonesForPlan(planPrice);
  
  let tierName;
  if (planPrice === 1999) tierName = 'Base Premium';
  else if (planPrice === 2598) tierName = '4-5 Zones Addon';
  else if (planPrice === 2998) tierName = '6-10 Zones Addon';
  else tierName = 'Enterprise';
  
  const modalHTML = `
    <div id="zoneConfigModal" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:10000;padding:1rem">
      
      <div style="background:white;border-radius:1rem;padding:2rem;max-width:600px;width:100%;max-height:90vh;overflow-y:auto">
        
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem">
          <h2 style="margin:0;color:#f97316">⚙️ Configure Zones</h2>
          <button onclick="closeZoneConfigModal()" style="background:#ef4444;color:white;border:none;padding:0.5rem 1rem;border-radius:0.5rem;cursor:pointer;font-weight:700">✕ Close</button>
        </div>

        <!-- Enable/Disable Toggle -->
        <div style="background:${zonesEnabled ? '#f0fdf4' : '#f9fafb'};padding:1.25rem;border-radius:0.75rem;margin-bottom:1.5rem;border:2px solid ${zonesEnabled ? '#22c55e' : '#e5e7eb'}">
          <label style="display:flex;align-items:center;gap:1rem;cursor:pointer">
            <input type="checkbox" id="enableZonesCheckbox" ${zonesEnabled ? 'checked' : ''} onchange="toggleZonesEnabled('${rid}')" style="width:24px;height:24px;cursor:pointer;accent-color:#22c55e">
            <div>
              <p style="margin:0;font-weight:700;font-size:1rem">${zonesEnabled ? '✅' : '☐'} Enable Multi-Zone QR Codes</p>
              <p style="margin:0.25rem 0 0 0;font-size:0.875rem;color:#6b7280">Create separate QR codes for different floors/zones</p>
            </div>
          </label>
        </div>

        <!-- Zones List -->
        <div id="zonesListContainer">
          ${zonesEnabled && existingZones.length > 0 ? `
            <div style="background:#dbeafe;padding:1rem;border-radius:0.75rem;margin-bottom:1rem;text-align:center">
              <p style="margin:0 0 0.5rem 0;font-size:0.875rem;color:#1e40af">
                <strong>Current Tier:</strong> ${tierName} (₹${planPrice}/quarter)
              </p>
              <p style="margin:0;font-size:0.875rem;color:#1e40af">
                <strong>Zones Used:</strong> ${existingZones.length} / ${maxZones}
              </p>
            </div>
            
            <h3 style="margin:0 0 1rem 0;font-size:1.125rem">Active Zones:</h3>
            <div id="zonesList">
              ${existingZones.map((zone, index) => `
                <div style="background:#f9fafb;padding:1.25rem;border-radius:0.75rem;margin-bottom:1rem;border:2px solid #e5e7eb">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;flex-wrap:wrap;gap:0.75rem">
                    <div style="flex:1">
                      <p style="margin:0;font-weight:700;font-size:1rem">${zone.emoji} ${zone.name}</p>
                      <p style="margin:0.25rem 0 0 0;font-size:0.875rem;color:#6b7280">Scans today: ${zone.scansToday || 0}</p>
                    </div>
                    <div style="display:flex;gap:0.5rem">
                      <button 
                        onclick="editZone('${rid}', ${index})" 
                        style="background:#3b82f6;color:white;border:none;padding:0.5rem 1rem;border-radius:0.5rem;cursor:pointer;font-weight:700;font-size:0.875rem"
                      >
                        ✏️ Edit
                      </button>
                      <button 
                        onclick="deleteZone('${rid}', ${index})" 
                        style="background:#ef4444;color:white;border:none;padding:0.5rem 1rem;border-radius:0.5rem;cursor:pointer;font-weight:700;font-size:0.875rem"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : zonesEnabled ? `
            <div style="background:#fef9c3;padding:1.5rem;border-radius:0.75rem;text-align:center;margin-bottom:1.5rem">
              <p style="margin:0;font-size:0.875rem;color:#854d0e">
                No zones configured yet. Click "Add New Zone" below to get started.
              </p>
            </div>
          ` : ''}
        </div>

        <!-- Add New Zone Button -->
        ${zonesEnabled ? `
          <button 
            onclick="showAddZoneForm('${rid}')" 
            style="background:#22c55e;color:white;border:none;padding:1rem 1.5rem;border-radius:0.75rem;cursor:pointer;font-weight:700;width:100%;margin-bottom:1.5rem;font-size:1rem"
          >
            ➕ Add New Zone
          </button>
        ` : ''}

        <!-- Close Button -->
        <button 
          onclick="closeZoneConfigModal()" 
          style="background:#6b7280;color:white;border:none;padding:1rem;border-radius:0.75rem;cursor:pointer;font-weight:700;width:100%"
        >
          Done
        </button>

      </div>

    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

/**
 * Close zone configuration modal
 */
function closeZoneConfigModal() {
  const modal = document.getElementById('zoneConfigModal');
  if (modal) modal.remove();
  
  const addModal = document.getElementById('addZoneModal');
  if (addModal) addModal.remove();
}

/**
 * Toggle zones enabled/disabled
 */
async function toggleZonesEnabled(rid) {
  const checkbox = document.getElementById('enableZonesCheckbox');
  const enabled = checkbox.checked;
  
  const restaurant = DB.restaurants[rid];
  
  if (enabled) {
    // Enable zones
    if (!restaurant.zones) {
      restaurant.zones = {
        enabled: true,
        mode: 'filter',
        list: [],
        createdAt: new Date().toISOString()
      };
    } else {
      restaurant.zones.enabled = true;
    }
  } else {
    // Disable zones
    if (restaurant.zones) {
      restaurant.zones.enabled = false;
    }
  }
  
  // Save to Firebase
  try {
    await db.collection('restaurants').doc(rid).update({
      zones: restaurant.zones
    });
  } catch (err) {
    console.error('Error saving zones:', err);
  }
  
  // Save to localStorage
  DB.restaurants[rid] = restaurant;
  DB.save();
  
  // Refresh modal
  closeZoneConfigModal();
  setTimeout(function() {
    showZoneConfigModal(rid);
  }, 100);
}

/**
 * Show add zone form
 */
function showAddZoneForm(rid) {
  const formHTML = `
    <div id="addZoneModal" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;z-index:10001;padding:1rem">
      
      <div style="background:white;border-radius:1rem;padding:2rem;max-width:500px;width:100%">
        
        <h3 style="margin:0 0 1.5rem 0;color:#f97316">➕ Add New Zone</h3>

        <div style="margin-bottom:1.5rem">
          <label style="display:block;font-weight:700;margin-bottom:0.5rem;font-size:0.875rem">Zone Name:</label>
          <input 
            type="text" 
            id="newZoneName" 
            placeholder="e.g., Ground Floor, First Floor, Garden" 
            style="width:100%;padding:0.75rem;border:2px solid #e5e7eb;border-radius:0.5rem;font-size:1rem"
          >
        </div>

        <div style="margin-bottom:1.5rem">
          <label style="display:block;font-weight:700;margin-bottom:0.5rem;font-size:0.875rem">Zone Icon:</label>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
            ${['🏢', '🏬', '🏪', '🌳', '🏖️', '🍽️', '🎪', '🏰', '🌺', '☕'].map(emoji => `
              <button 
                onclick="selectZoneEmoji('${emoji}')" 
                class="emoji-select-btn"
                style="background:#f3f4f6;border:2px solid #e5e7eb;padding:0.75rem;border-radius:0.5rem;cursor:pointer;font-size:1.5rem;transition:all 0.2s"
              >
                ${emoji}
              </button>
            `).join('')}
          </div>
          <input type="hidden" id="selectedEmoji" value="🏢">
        </div>

        <div style="display:flex;gap:0.75rem">
          <button 
            onclick="document.getElementById('addZoneModal').remove()" 
            style="background:#6b7280;color:white;border:none;padding:1rem;border-radius:0.75rem;cursor:pointer;font-weight:700;flex:1"
          >
            Cancel
          </button>
          <button 
            onclick="saveNewZone('${rid}')" 
            style="background:#22c55e;color:white;border:none;padding:1rem;border-radius:0.75rem;cursor:pointer;font-weight:700;flex:2"
          >
            💾 Save Zone
          </button>
        </div>

      </div>

    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', formHTML);
}

/**
 * Select emoji for new zone
 */
function selectZoneEmoji(emoji) {
  document.getElementById('selectedEmoji').value = emoji;
  
  // Update button states
  document.querySelectorAll('.emoji-select-btn').forEach(function(btn) {
    btn.style.background = '#f3f4f6';
    btn.style.borderColor = '#e5e7eb';
  });
  
  event.target.style.background = '#fef3c7';
  event.target.style.borderColor = '#f59e0b';
}

/**
 * Save new zone (WITH TIER LIMITS)
 */
async function saveNewZone(rid) {
  const zoneName = document.getElementById('newZoneName').value.trim();
  const emoji = document.getElementById('selectedEmoji').value;
  
  if (!zoneName) {
    alert('⚠️ Please enter a zone name');
    return;
  }
  
  const restaurant = DB.restaurants[rid];
  
  // ✅ ENFORCE ZONE LIMITS WITH PRICING TIERS
  const currentZoneCount = restaurant.zones.list.length;
  const planPrice = restaurant.planPrice || 1999;
  const maxZones = getMaxZonesForPlan(planPrice);
  
  if (currentZoneCount >= maxZones) {
    const upgradeMsg = getUpgradeMessage(planPrice);
    alert(
      `⚠️ Zone Limit Reached!\n\n` +
      `Your current plan (₹${planPrice}/quarter) allows maximum ${maxZones} zones.\n\n` +
      `You currently have ${currentZoneCount} zones configured.\n\n` +
      `📈 ${upgradeMsg}`
    );
    return;
  }
  
  const zoneId = generateZoneId(zoneName);
  
  // Check for duplicate
  const exists = restaurant.zones.list.some(function(z) {
    return z.id === zoneId;
  });
  
  if (exists) {
    alert('⚠️ A zone with this name already exists');
    return;
  }
  
  const newZone = {
    id: zoneId,
    name: zoneName,
    emoji: emoji,
    scansToday: 0,
    enabled: true,
    qrCode: getZoneQRCode(rid, zoneId),
    createdAt: new Date().toISOString()
  };
  
  restaurant.zones.list.push(newZone);
  
  // Save to Firebase
  try {
    await db.collection('restaurants').doc(rid).update({
      zones: restaurant.zones
    });
  } catch (err) {
    console.error('Error saving zone:', err);
    alert('❌ Error saving zone. Please try again.');
    return;
  }
  
  // Save to localStorage
  DB.restaurants[rid] = restaurant;
  DB.save();
  
  // ✅ SHOW UPGRADE PROMPT IF APPROACHING LIMIT
  const remainingZones = maxZones - currentZoneCount - 1;
  if (remainingZones <= 1 && remainingZones > 0) {
    const upgradeMsg = getUpgradeMessage(planPrice);
    alert(
      `✅ Zone added successfully!\n\n` +
      `⚠️ Note: You have ${remainingZones} zone slot${remainingZones !== 1 ? 's' : ''} remaining.\n\n` +
      `${upgradeMsg}`
    );
  } else {
    alert('✅ Zone added successfully!');
  }
  
  // Refresh modal
  document.getElementById('addZoneModal').remove();
  closeZoneConfigModal();
  setTimeout(function() {
    showZoneConfigModal(rid);
  }, 100);
}

/**
 * Edit existing zone
 */
function editZone(rid, index) {
  const restaurant = DB.restaurants[rid];
  const zone = restaurant.zones.list[index];
  
  const newName = prompt('Edit Zone Name:', zone.name);
  if (!newName || newName.trim() === '') return;
  
  zone.name = newName.trim();
  
  // Save to Firebase
  db.collection('restaurants').doc(rid).update({
    zones: restaurant.zones
  }).catch(function(err) {
    console.error('Error updating zone:', err);
  });
  
  // Save to localStorage
  DB.restaurants[rid] = restaurant;
  DB.save();
  
  // Refresh modal
  closeZoneConfigModal();
  setTimeout(function() {
    showZoneConfigModal(rid);
  }, 100);
}

/**
 * Delete zone
 */
async function deleteZone(rid, index) {
  const restaurant = DB.restaurants[rid];
  const zone = restaurant.zones.list[index];
  
  if (!confirm('Delete zone "' + zone.name + '"?\n\nThis cannot be undone.')) {
    return;
  }
  
  restaurant.zones.list.splice(index, 1);
  
  // Save to Firebase
  try {
    await db.collection('restaurants').doc(rid).update({
      zones: restaurant.zones
    });
  } catch (err) {
    console.error('Error deleting zone:', err);
  }
  
  // Save to localStorage
  DB.restaurants[rid] = restaurant;
  DB.save();
  
  alert('✅ Zone deleted');
  
  // Refresh modal
  closeZoneConfigModal();
  setTimeout(function() {
    showZoneConfigModal(rid);
  }, 100);
}

// ============================================================================
// EXPORT TO WINDOW
// ============================================================================

window.getZoneQRCode = getZoneQRCode;
window.generateZoneId = generateZoneId;
window.getZoneName = getZoneName;
window.getZone = getZone;
window.isMultiZoneEnabled = isMultiZoneEnabled;
window.getMaxZonesForPlan = getMaxZonesForPlan;
window.getUpgradeMessage = getUpgradeMessage;
window.generateMultiZoneUI = generateMultiZoneUI;
window.filterZone = filterZone;
window.applyZoneFilter = applyZoneFilter;
window.setZoneFilter = setZoneFilter;
window.getZoneFilter = getZoneFilter;
window.clearZoneFilter = clearZoneFilter;
window.downloadZoneQR = downloadZoneQR;
window.copyZoneQRLink = copyZoneQRLink;
window.printZoneQR = printZoneQR;
window.showZoneConfigModal = showZoneConfigModal;
window.closeZoneConfigModal = closeZoneConfigModal;
window.toggleZonesEnabled = toggleZonesEnabled;
window.showAddZoneForm = showAddZoneForm;
window.selectZoneEmoji = selectZoneEmoji;
window.saveNewZone = saveNewZone;
window.editZone = editZone;
window.deleteZone = deleteZone;

console.log('✅ QueueApp Multi-Zone Module Loaded (v1.0)');

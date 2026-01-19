// ========================================
// CONFIGURATION
// ========================================
// Set the path to your customer-menu-display.html file
const CUSTOMER_DISPLAY_PATH = 'customer-menu-display.html';

// ========================================
// MAIN CODE
// ========================================
let manualMenuData = {
  specials: {
    today: { enabled: false, items: [] },
    chef: { enabled: false, items: [] },
    new: { enabled: false, items: [] },
    week: { enabled: false, items: [] },
    festive: { enabled: false, name: '', items: [] }
  },
  categories: []
};

let categoryCounter = 0;
let itemCounter = 0;
let currentEditItem = { categoryIndex: null, itemIndex: null };

// ========================================
// INITIALIZE EVENT LISTENERS
// ========================================
document.addEventListener('DOMContentLoaded', function() {
  console.log('✅ Menu Management JS Loaded');
  
  // Setup special section toggles
  document.getElementById('enableTodaySpecial')?.addEventListener('change', function() {
    toggleSpecialSection('today');
  });
  
  document.getElementById('enableChefSpecial')?.addEventListener('change', function() {
    toggleSpecialSection('chef');
  });
  
  document.getElementById('enableNewItems')?.addEventListener('change', function() {
    toggleSpecialSection('new');
  });
  
  document.getElementById('enableWeekSpecial')?.addEventListener('change', function() {
    toggleSpecialSection('week');
  });
  
  document.getElementById('enableFestiveSpecial')?.addEventListener('change', function() {
    toggleSpecialSection('festive');
  });
});

// ========================================
// NAVIGATION FUNCTIONS
// ========================================
function goBackToAdmin() {
  if (window.parent && window.parent.navigate && window.currentRestaurantId) {
    window.parent.navigate('/r/' + window.currentRestaurantId + '/admin');
  } else if (typeof navigate !== 'undefined' && window.currentRestaurantId) {
    navigate('/r/' + window.currentRestaurantId + '/admin');
  } else {
    window.history.back();
  }
}

// ========================================
// SPECIAL SECTIONS TOGGLE
// ========================================
function toggleSpecialSection(type) {
  const checkboxId = 'enable' + (type === 'festive' ? 'Festive' : type.charAt(0).toUpperCase() + type.slice(1)) + 'Special';
  const checkbox = document.getElementById(checkboxId);
  const form = document.getElementById(`${type}SpecialForm`);
  
  if (checkbox && form) {
    if (checkbox.checked) {
      form.style.display = 'block';
      manualMenuData.specials[type].enabled = true;
    } else {
      form.style.display = 'none';
      manualMenuData.specials[type].enabled = false;
    }
  }
}

// ========================================
// ADD ITEM TO SPECIAL CATEGORY
// ========================================
function addItemToCategory(categoryType) {
  const itemId = `item-${categoryType}-${itemCounter++}`;
  const container = document.getElementById(`${categoryType}SpecialItems`);
  
  if (!container) {
    console.error('Container not found for:', categoryType);
    return;
  }
  
  const itemDiv = document.createElement('div');
  itemDiv.id = itemId;
  itemDiv.style.cssText = 'background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 10px; border: 2px solid #e0e0e0;';
  itemDiv.innerHTML = `
    <div style="display: grid; gap: 10px;">
      <input type="text" placeholder="Item Name *" id="${itemId}-name" style="width: 100%; padding: 8px; border: 2px solid #e0e0e0; border-radius: 6px;">
      <input type="text" placeholder="Price (e.g., ₹150)" id="${itemId}-price" style="width: 100%; padding: 8px; border: 2px solid #e0e0e0; border-radius: 6px;">
      <textarea placeholder="Description (optional)" id="${itemId}-desc" style="width: 100%; padding: 8px; border: 2px solid #e0e0e0; border-radius: 6px; min-height: 60px; resize: vertical;"></textarea>
      <div style="display: flex; gap: 10px;">
        <button onclick="saveItemToCategory('${categoryType}', '${itemId}')" style="flex: 1; padding: 8px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
          ✓ Save Item
        </button>
        <button onclick="removeItemForm('${itemId}')" style="padding: 8px 16px; background: #dc3545; color: white; border: none; border-radius: 6px; cursor: pointer;">
          🗑️
        </button>
      </div>
    </div>
  `;
  
  container.appendChild(itemDiv);
}

// ========================================
// SAVE ITEM TO CATEGORY
// ========================================
function saveItemToCategory(categoryType, itemId) {
  const name = document.getElementById(`${itemId}-name`)?.value.trim();
  const price = document.getElementById(`${itemId}-price`)?.value.trim();
  const desc = document.getElementById(`${itemId}-desc`)?.value.trim();
  
  if (!name) {
    alert('Item name is required!');
    return;
  }
  
  const item = { name, price, description: desc };
  manualMenuData.specials[categoryType].items.push(item);
  
  // Convert form to saved item display
  const itemDiv = document.getElementById(itemId);
  if (itemDiv) {
    itemDiv.style.background = 'white';
    itemDiv.style.border = '2px solid #28a745';
    itemDiv.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <div style="flex: 1;">
          <div style="font-weight: 600; color: #333; font-size: 15px;">${name}</div>
          ${price ? `<div style="color: #667eea; font-weight: 600; margin-top: 4px;">${price}</div>` : ''}
          ${desc ? `<div style="color: #666; font-size: 13px; margin-top: 6px;">${desc}</div>` : ''}
        </div>
        <div style="display: flex; gap: 8px;">
          <button onclick="editSavedItem('${categoryType}', '${itemId}')" style="padding: 6px 12px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px;">
            ✏️ Edit
          </button>
          <button onclick="deleteSavedItem('${categoryType}', '${itemId}')" style="padding: 6px 12px; background: #dc3545; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px;">
            🗑️
          </button>
        </div>
      </div>
    `;
  }
}

// ========================================
// REMOVE/DELETE/EDIT ITEMS
// ========================================
function removeItemForm(itemId) {
  const element = document.getElementById(itemId);
  if (element) element.remove();
}

function deleteSavedItem(categoryType, itemId) {
  if (!confirm('Delete this item?')) return;
  
  const itemDiv = document.getElementById(itemId);
  if (!itemDiv) return;
  
  const name = itemDiv.querySelector('div > div')?.textContent;
  const index = manualMenuData.specials[categoryType].items.findIndex(item => item.name === name);
  if (index > -1) {
    manualMenuData.specials[categoryType].items.splice(index, 1);
  }
  itemDiv.remove();
}

function editSavedItem(categoryType, itemId) {
  const itemDiv = document.getElementById(itemId);
  if (!itemDiv) return;
  
  const nameEl = itemDiv.querySelector('div > div:first-child');
  const priceEl = itemDiv.querySelector('div > div:nth-child(2)');
  const descEl = itemDiv.querySelector('div > div:nth-child(3)');
  
  const name = nameEl?.textContent || '';
  const price = priceEl?.textContent || '';
  const desc = descEl?.textContent || '';
  
  // Remove from data
  const index = manualMenuData.specials[categoryType].items.findIndex(item => item.name === name);
  if (index > -1) {
    manualMenuData.specials[categoryType].items.splice(index, 1);
  }
  
  // Convert back to form
  itemDiv.style.background = '#f8f9fa';
  itemDiv.style.border = '2px solid #e0e0e0';
  itemDiv.innerHTML = `
    <div style="display: grid; gap: 10px;">
      <input type="text" placeholder="Item Name *" id="${itemId}-name" value="${name}" style="width: 100%; padding: 8px; border: 2px solid #e0e0e0; border-radius: 6px;">
      <input type="text" placeholder="Price (e.g., ₹150)" id="${itemId}-price" value="${price}" style="width: 100%; padding: 8px; border: 2px solid #e0e0e0; border-radius: 6px;">
      <textarea placeholder="Description (optional)" id="${itemId}-desc" style="width: 100%; padding: 8px; border: 2px solid #e0e0e0; border-radius: 6px; min-height: 60px; resize: vertical;">${desc}</textarea>
      <div style="display: flex; gap: 10px;">
        <button onclick="saveItemToCategory('${categoryType}', '${itemId}')" style="flex: 1; padding: 8px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
          ✓ Save Item
        </button>
        <button onclick="removeItemForm('${itemId}')" style="padding: 8px 16px; background: #dc3545; color: white; border: none; border-radius: 6px; cursor: pointer;">
          🗑️
        </button>
      </div>
    </div>
  `;
}

// ========================================
// REGULAR CATEGORY MANAGEMENT
// ========================================
function addNewCategory() {
  const catId = `category-${categoryCounter++}`;
  const container = document.getElementById('manualCategoriesContainer');
  
  if (!container) {
    console.error('Categories container not found');
    return;
  }
  
  const catDiv = document.createElement('div');
  catDiv.id = catId;
  catDiv.style.cssText = 'background: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; border: 2px solid #e0e0e0;';
  catDiv.innerHTML = `
    <div style="margin-bottom: 15px;">
      <input type="text" placeholder="Category Name (e.g., Appetizers, Main Course)" id="${catId}-name" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 6px; font-size: 16px; font-weight: 600;">
    </div>
    <button onclick="addItemToRegularCategory('${catId}')" style="padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; margin-bottom: 15px;">
      ➕ Add Item
    </button>
    <button onclick="deleteCategory('${catId}')" style="padding: 8px 16px; background: #dc3545; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; margin-bottom: 15px; margin-left: 10px;">
      🗑️ Delete Category
    </button>
    <div id="${catId}-items"></div>
  `;
  
  container.appendChild(catDiv);
  manualMenuData.categories.push({ id: catId, name: '', items: [] });
}

function addItemToRegularCategory(catId) {
  const itemId = `item-${catId}-${itemCounter++}`;
  const container = document.getElementById(`${catId}-items`);
  
  if (!container) {
    console.error('Items container not found for:', catId);
    return;
  }
  
  const itemDiv = document.createElement('div');
  itemDiv.id = itemId;
  itemDiv.style.cssText = 'background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 10px; border: 2px solid #e0e0e0;';
  itemDiv.innerHTML = `
    <div style="display: grid; gap: 10px;">
      <input type="text" placeholder="Item Name *" id="${itemId}-name" style="width: 100%; padding: 8px; border: 2px solid #e0e0e0; border-radius: 6px;">
      <input type="text" placeholder="Price (e.g., ₹150)" id="${itemId}-price" style="width: 100%; padding: 8px; border: 2px solid #e0e0e0; border-radius: 6px;">
      <textarea placeholder="Description (optional)" id="${itemId}-desc" style="width: 100%; padding: 8px; border: 2px solid #e0e0e0; border-radius: 6px; min-height: 60px; resize: vertical;"></textarea>
      <div style="display: flex; gap: 10px;">
        <button onclick="saveItemToRegularCategory('${catId}', '${itemId}')" style="flex: 1; padding: 8px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
          ✓ Save Item
        </button>
        <button onclick="removeItemForm('${itemId}')" style="padding: 8px 16px; background: #dc3545; color: white; border: none; border-radius: 6px; cursor: pointer;">
          🗑️
        </button>
      </div>
    </div>
  `;
  
  container.appendChild(itemDiv);
}

function saveItemToRegularCategory(catId, itemId) {
  const name = document.getElementById(`${itemId}-name`)?.value.trim();
  const price = document.getElementById(`${itemId}-price`)?.value.trim();
  const desc = document.getElementById(`${itemId}-desc`)?.value.trim();
  
  if (!name) {
    alert('Item name is required!');
    return;
  }
  
  const item = { name, price, description: desc };
  const category = manualMenuData.categories.find(cat => cat.id === catId);
  if (category) {
    category.items.push(item);
  }
  
  // Convert form to saved item display
  const itemDiv = document.getElementById(itemId);
  if (itemDiv) {
    itemDiv.style.background = 'white';
    itemDiv.style.border = '2px solid #28a745';
    itemDiv.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <div style="flex: 1;">
          <div style="font-weight: 600; color: #333; font-size: 15px;">${name}</div>
          ${price ? `<div style="color: #667eea; font-weight: 600; margin-top: 4px;">${price}</div>` : ''}
          ${desc ? `<div style="color: #666; font-size: 13px; margin-top: 6px;">${desc}</div>` : ''}
        </div>
        <div style="display: flex; gap: 8px;">
          <button onclick="editRegularItem('${catId}', '${itemId}')" style="padding: 6px 12px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px;">
            ✏️ Edit
          </button>
          <button onclick="deleteRegularItem('${catId}', '${itemId}')" style="padding: 6px 12px; background: #dc3545; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px;">
            🗑️
          </button>
        </div>
      </div>
    `;
  }
}

function deleteRegularItem(catId, itemId) {
  if (!confirm('Delete this item?')) return;
  
  const itemDiv = document.getElementById(itemId);
  if (!itemDiv) return;
  
  const name = itemDiv.querySelector('div > div')?.textContent;
  const category = manualMenuData.categories.find(cat => cat.id === catId);
  if (category) {
    const index = category.items.findIndex(item => item.name === name);
    if (index > -1) {
      category.items.splice(index, 1);
    }
  }
  itemDiv.remove();
}

function editRegularItem(catId, itemId) {
  const itemDiv = document.getElementById(itemId);
  if (!itemDiv) return;
  
  const nameEl = itemDiv.querySelector('div > div:first-child');
  const priceEl = itemDiv.querySelector('div > div:nth-child(2)');
  const descEl = itemDiv.querySelector('div > div:nth-child(3)');
  
  const name = nameEl?.textContent || '';
  const price = priceEl?.textContent || '';
  const desc = descEl?.textContent || '';
  
  // Remove from data
  const category = manualMenuData.categories.find(cat => cat.id === catId);
  if (category) {
    const index = category.items.findIndex(item => item.name === name);
    if (index > -1) {
      category.items.splice(index, 1);
    }
  }
  
  // Convert back to form
  itemDiv.style.background = '#f8f9fa';
  itemDiv.style.border = '2px solid #e0e0e0';
  itemDiv.innerHTML = `
    <div style="display: grid; gap: 10px;">
      <input type="text" placeholder="Item Name *" id="${itemId}-name" value="${name}" style="width: 100%; padding: 8px; border: 2px solid #e0e0e0; border-radius: 6px;">
      <input type="text" placeholder="Price (e.g., ₹150)" id="${itemId}-price" value="${price}" style="width: 100%; padding: 8px; border: 2px solid #e0e0e0; border-radius: 6px;">
      <textarea placeholder="Description (optional)" id="${itemId}-desc" style="width: 100%; padding: 8px; border: 2px solid #e0e0e0; border-radius: 6px; min-height: 60px; resize: vertical;">${desc}</textarea>
      <div style="display: flex; gap: 10px;">
        <button onclick="saveItemToRegularCategory('${catId}', '${itemId}')" style="flex: 1; padding: 8px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
          ✓ Save Item
        </button>
        <button onclick="removeItemForm('${itemId}')" style="padding: 8px 16px; background: #dc3545; color: white; border: none; border-radius: 6px; cursor: pointer;">
          🗑️
        </button>
      </div>
    </div>
  `;
}

function deleteCategory(catId) {
  if (!confirm('Delete this entire category and all its items?')) return;
  
  const index = manualMenuData.categories.findIndex(cat => cat.id === catId);
  if (index > -1) {
    manualMenuData.categories.splice(index, 1);
  }
  const element = document.getElementById(catId);
  if (element) element.remove();
}

// ========================================
// PREVIEW MANUAL MENU
// ========================================
function previewManualMenu() {
  // Update category names from input fields
  manualMenuData.categories.forEach(cat => {
    const nameInput = document.getElementById(`${cat.id}-name`);
    if (nameInput) {
      cat.name = nameInput.value.trim() || 'Untitled Category';
    }
  });
  
  // Get festive name if enabled
  if (manualMenuData.specials.festive.enabled) {
    const festiveName = document.getElementById('festiveSpecialName');
    if (festiveName) {
      manualMenuData.specials.festive.name = festiveName.value.trim() || 'Festive Special';
    }
  }
  
  // Validate - check if there are any items
  let hasItems = false;
  
  // Check specials
  for (const key in manualMenuData.specials) {
    if (manualMenuData.specials[key].enabled && manualMenuData.specials[key].items.length > 0) {
      hasItems = true;
      break;
    }
  }
  
  // Check categories
  if (!hasItems) {
    for (const cat of manualMenuData.categories) {
      if (cat.items.length > 0) {
        hasItems = true;
        break;
      }
    }
  }
  
  if (!hasItems) {
    alert('⚠️ Please add at least one menu item before previewing!');
    return;
  }
  
  // Convert to final format and save
  const finalData = {
    lastUpdated: new Date().toISOString(),
    restaurantName: window.currentRestaurant?.name || "Your Restaurant",
    specialCategories: [],
    regularCategories: []
  };
  
  // Add special menus
  const iconMap = {
    today: '🌅',
    chef: '👨‍🍳',
    new: '🆕',
    week: '📅',
    festive: '🎉'
  };
  
  const gradientMap = {
    today: { start: '#f093fb', end: '#f5576c' },
    chef: { start: '#fa709a', end: '#fee140' },
    new: { start: '#a8edea', end: '#fed6e3' },
    week: { start: '#ffecd2', end: '#fcb69f' },
    festive: { start: '#ff9a9e', end: '#fecfef' }
  };
  
  const nameMap = {
    today: "Today's Special",
    chef: "Chef's Special",
    new: "New Items",
    week: "This Week's Special",
    festive: manualMenuData.specials.festive.name || 'Festive Special'
  };
  
  for (const key in manualMenuData.specials) {
    if (manualMenuData.specials[key].enabled && manualMenuData.specials[key].items.length > 0) {
      finalData.specialCategories.push({
        type: key,
        name: nameMap[key],
        priority: finalData.specialCategories.length + 1,
        icon: iconMap[key],
        gradientStart: gradientMap[key].start,
        gradientEnd: gradientMap[key].end,
        items: manualMenuData.specials[key].items
      });
    }
  }
  
  // Add regular categories
  const defaultGradients = [
    { start: '#667eea', end: '#764ba2' },
    { start: '#f093fb', end: '#f5576c' },
    { start: '#a8edea', end: '#fed6e3' },
    { start: '#ffecd2', end: '#fcb69f' }
  ];
  
  manualMenuData.categories.forEach((cat, idx) => {
    if (cat.items.length > 0) {
      const gradient = defaultGradients[idx % defaultGradients.length];
      finalData.regularCategories.push({
        name: cat.name,
        priority: finalData.specialCategories.length + finalData.regularCategories.length + 1,
        icon: '🍽️',
        gradientStart: gradient.start,
        gradientEnd: gradient.end,
        items: cat.items
      });
    }
  });
  
  // Save to localStorage
  try {
    localStorage.setItem('restaurantMenu', JSON.stringify(finalData));
    localStorage.setItem('menuLastUpdated', finalData.lastUpdated);
    
    console.log('✅ Menu saved successfully:', finalData);
    
    // If in QueueApp context, also save to Firebase
    if (window.currentRestaurantId && window.parent.DB && window.parent.db) {
      window.parent.DB.restaurants[window.currentRestaurantId].menuData = finalData;
      window.parent.DB.save();
      
      window.parent.db.collection('restaurants').doc(window.currentRestaurantId).update({
        menuData: finalData,
        menuLastUpdated: new Date().toISOString()
      }).then(() => {
        console.log('✅ Menu saved to Firebase');
        alert('✅ Menu saved successfully!\n\nYou can now share this menu with your customers.');
        
        // Redirect back to admin
        setTimeout(() => {
          goBackToAdmin();
        }, 2000);
      }).catch(err => {
        console.error('❌ Firebase save error:', err);
        alert('✅ Menu saved locally!\n\n⚠️ Could not sync to cloud. Please check your internet connection.');
      });
    } else {
      // Standalone mode
      alert('✅ Menu saved successfully!\n\nYou can now preview it.');
      
      // Open customer display
      window.open(CUSTOMER_DISPLAY_PATH, '_blank');
    }
  } catch (error) {
    console.error('❌ Error saving menu:', error);
    alert('❌ Error saving menu: ' + error.message);
  }
}

// ========================================
// EDIT MODAL FUNCTIONS
// ========================================
function openEditModal(catIndex, itemIndex) {
  currentEditItem = { categoryIndex: catIndex, itemIndex: itemIndex };
  document.getElementById('editModal')?.classList.add('active');
}

function closeEditModal() {
  document.getElementById('editModal')?.classList.remove('active');
  currentEditItem = { categoryIndex: null, itemIndex: null };
}

function saveEditedItem() {
  const { categoryIndex, itemIndex } = currentEditItem;
  if (categoryIndex === null || itemIndex === null) return;
  
  const name = document.getElementById('editItemName')?.value.trim();
  const price = document.getElementById('editItemPrice')?.value.trim();
  const description = document.getElementById('editItemDescription')?.value.trim();
  
  if (!name) {
    alert('Item name is required!');
    return;
  }
  
  closeEditModal();
}

console.log('✅ Menu Management JavaScript Loaded Successfully');

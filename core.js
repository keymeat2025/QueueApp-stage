// ============================================================================
// QUEUEAPP - CORE.JS (UPDATED WITH EXPIRY LIFECYCLE)
// Foundation Layer: Firebase, Database, Utilities, Routing
// CHANGES: Added expiry snapshot tracking + dynamic limit enforcement
// ============================================================================

// ============================================================================
// FIREBASE CONFIGURATION & INITIALIZATION
// ============================================================================

const firebaseConfig = {
  apiKey: "AIzaSyBQRfA1_qgG9x4w4aiDqAzAPghMEc5zE6Q",
  authDomain: "queueapp-97728.firebaseapp.com",
  projectId: "queueapp-97728",
  storageBucket: "queueapp-97728.firebasestorage.app",
  messagingSenderId: "41156558140",
  appId: "1:41156558140:web:f3277e7018176d0870f239",
  measurementId: "G-QSP7ZXNSFT"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// ============================================================================
// FIREBASE ADMIN WRAPPER
// ============================================================================

const FirebaseAdmin = {
  async signIn(email, password) {
    try {
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      return { success: true, user: userCredential.user };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async signOut() {
    try {
      await auth.signOut();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  getCurrentUser() {
    return auth.currentUser;
  },

  onAuthStateChanged(callback) {
    return auth.onAuthStateChanged(callback);
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if Premium plan is currently active (not expired)
 */
function isPremiumActive(restaurant) {
  return restaurant.plan === 'premium'
    && restaurant.planStatus === 'active'
    && (!restaurant.planExpiryDate || restaurant.planExpiryDate > Date.now());
}

/**
 * Calculate effective monthly limit based on plan status
 */
function calculateMonthlyLimit(restaurant, analytics) {
  const now = Date.now();
  const currentMonth = new Date().toISOString().slice(0, 7);
  
  // Check if Premium is currently active
  if (isPremiumActive(restaurant)) {
    return { limit: Infinity, display: 'unlimited' };
  }
  
  // Check if Premium expired mid-month (freemium grace period)
  if (restaurant.plan === 'premium' && restaurant.planExpiryDate) {
    const expiryMonth = new Date(restaurant.planExpiryDate).toISOString().slice(0, 7);
    
    if (expiryMonth === currentMonth && analytics.customersAtExpiry !== undefined) {
      // Expired this month: Base usage + 500 freemium
      const freemiumLimit = analytics.customersAtExpiry + 500;
      return { limit: freemiumLimit, display: freemiumLimit };
    }
  }
  
  // Free plan or new month after expiry
  return { limit: 500, display: 500 };
}

// ============================================================================
// FIREBASE DATABASE WRAPPER
// ============================================================================

const FirebaseDB = {
  // Add new restaurant
  async addRestaurant(rid, data) {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const today = new Date().toISOString().slice(0, 10);
      
      await db.collection('restaurants').doc(rid).set({
        ...data,
        queue: [],
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        plan: 'free',
        planStatus: 'active',
        analytics: {
          currentMonth: currentMonth,
          customersThisMonth: 0,
          lastResetDate: today,
          dailyStats: {}
        },
        monthlyHistory: [],
        queueArchive: {},
        lastCleanupDate: today
      });
      
      return { success: true, id: rid };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // Get restaurant by ID
  async getRestaurant(rid) {
    try {
      const doc = await db.collection('restaurants').doc(rid).get();
      return doc.exists 
        ? { success: true, data: doc.data() }
        : { success: false, error: 'Not found' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // Get all restaurants (platform admin)
  async getAllRestaurants() {
    try {
      const snapshot = await db.collection('restaurants').get();
      const restaurants = {};
      snapshot.forEach(doc => {
        restaurants[doc.id] = doc.data();
      });
      return { success: true, data: restaurants };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // Add customer to queue (UPDATED WITH EXPIRY LOGIC)
  async addToQueue(rid, customer) {
    try {
      const restaurantRef = db.collection('restaurants').doc(rid);
      const doc = await restaurantRef.get();
      
      if (!doc.exists) {
        return { success: false, error: 'Restaurant not found' };
      }
      
      const restaurant = doc.data();
      const currentMonth = new Date().toISOString().slice(0, 7);
      const today = new Date().toISOString().slice(0, 10);
      const now = Date.now();
      
      // Initialize or get analytics
      let analytics = restaurant.analytics || {
        currentMonth: currentMonth,
        customersThisMonth: 0,
        lastResetDate: today,
        dailyStats: {}
      };
      
      // Reset analytics if new month
      if (analytics.currentMonth !== currentMonth) {
        const monthlyHistory = restaurant.monthlyHistory || [];
        monthlyHistory.push({
          month: analytics.currentMonth,
          totalCustomers: analytics.customersThisMonth,
          dailyStats: analytics.dailyStats,
          archivedAt: new Date().toISOString()
        });
        
        // Clear expiry snapshot on new month
        analytics = {
          currentMonth: currentMonth,
          customersThisMonth: 0,
          lastResetDate: today,
          dailyStats: {},
          customersAtExpiry: undefined,
          expiredAt: undefined
        };
        
        await restaurantRef.update({
          monthlyHistory: monthlyHistory,
          analytics: analytics
        });
      }
      
      // ===== EXPIRY SNAPSHOT LOGIC =====
      // Take snapshot when Premium expires (first customer after expiry)
      if (restaurant.plan === 'premium' && 
          restaurant.planExpiryDate && 
          restaurant.planExpiryDate < now && 
          analytics.customersAtExpiry === undefined) {
        
        // Check if expiry was this month
        const expiryMonth = new Date(restaurant.planExpiryDate).toISOString().slice(0, 7);
        if (expiryMonth === currentMonth) {
          // Take snapshot of customers at expiry
          analytics.customersAtExpiry = analytics.customersThisMonth;
          analytics.expiredAt = restaurant.planExpiryDate;
          
          console.log(`[EXPIRY SNAPSHOT] ${rid}: ${analytics.customersAtExpiry} customers at expiry`);
          
          // Update snapshot in Firestore
          await restaurantRef.update({
            'analytics.customersAtExpiry': analytics.customersAtExpiry,
            'analytics.expiredAt': analytics.expiredAt
          });
        }
      }
      
      // ===== CALCULATE EFFECTIVE LIMIT =====
      const { limit: effectiveLimit, display: displayLimit } = calculateMonthlyLimit(restaurant, analytics);
      
      // Check limit
      if (analytics.customersThisMonth >= effectiveLimit) {
        // Determine appropriate message
        let message;
        if (restaurant.plan === 'premium' && analytics.customersAtExpiry !== undefined) {
          message = `Freemium limit reached (${analytics.customersAtExpiry} before expiry + 500 grace). Renew Premium for unlimited customers.`;
        } else if (restaurant.plan === 'free') {
          message = 'Monthly limit reached. Upgrade to Premium for unlimited customers.';
        } else {
          message = 'Monthly limit reached. Renew Premium for unlimited customers.';
        }
        
        return {
          success: false,
          error: 'LIMIT_REACHED',
          message: message,
          customersUsed: analytics.customersThisMonth,
          limit: displayLimit
        };
      }
      
      // Generate queue number
      const queueNumber = `A-${Math.floor(Math.random() * 900) + 100}`;
      
      // Create queue item
      const queueItem = {
        ...customer,
        queueNumber: queueNumber,
        status: 'waiting',
        joinedAt: new Date().toISOString()
      };
      
      // Update analytics
      analytics.customersThisMonth += 1;
      analytics.dailyStats[today] = (analytics.dailyStats[today] || 0) + 1;
      
      // Update Firestore
      await restaurantRef.update({
        queue: firebase.firestore.FieldValue.arrayUnion(queueItem),
        analytics: analytics
      });
      
      return {
        success: true,
        queueNumber: queueNumber,
        customersThisMonth: analytics.customersThisMonth,
        limit: displayLimit
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // Allocate table to customer
  async allocateTable(rid, queueNumber, tableNo) {
    try {
      const result = await this.getRestaurant(rid);
      if (!result.success) return result;
      
      const updatedQueue = result.data.queue.map(q => 
        q.queueNumber === queueNumber 
          ? { ...q, status: 'allocated', tableNo: tableNo, allocatedAt: new Date().toISOString() }
          : q
      );
      
      await db.collection('restaurants').doc(rid).update({ queue: updatedQueue });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // Get analytics
  async getAnalytics(rid) {
    try {
      const doc = await db.collection('restaurants').doc(rid).get();
      if (!doc.exists) {
        return { success: false, error: 'Not found' };
      }
      const restaurant = doc.data();
      return {
        success: true,
        analytics: restaurant.analytics || {},
        monthlyHistory: restaurant.monthlyHistory || []
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // Daily cleanup (delegates to archival.js)
  dailyCleanup: (rid, isManual = false) => {
    if (window.FirebaseCleanup) {
      return window.FirebaseCleanup.dailyCleanup(rid, isManual);
    }
    return Promise.resolve({ success: false, error: 'Cleanup module not loaded' });
  },

  // Save payment proof
  async savePaymentProof(rid, paymentData) {
    try {
      await db.collection('restaurants').doc(rid).update({
        paymentProof: {
          ...paymentData,
          uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
        },
        planStatus: 'pending'
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // Approve premium
  async approvePremium(rid, approvalData) {
    try {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);
      
      const updateData = {
        plan: 'premium',
        planStatus: 'active',
        planExpiryDate: expiryDate.getTime()
      };
      
      if (approvalData) {
        updateData['paymentProof.approvedAt'] = firebase.firestore.FieldValue.serverTimestamp();
        updateData['paymentProof.approvedBy'] = approvalData.approvedBy || 'platform_admin';
        updateData['paymentProof.approvalReason'] = approvalData.approvalReason || 'Approved';
      }
      
      await db.collection('restaurants').doc(rid).update(updateData);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // Reject premium
  async rejectPremium(rid, reason, rejectionData) {
    try {
      const updateData = {
        planStatus: 'rejected',
        'paymentProof.rejectedAt': firebase.firestore.FieldValue.serverTimestamp(),
        'paymentProof.rejectionReason': reason
      };
      
      if (rejectionData) {
        updateData['paymentProof.rejectedBy'] = rejectionData.rejectedBy || 'platform_admin';
        updateData['paymentProof.rejectedTimestamp'] = rejectionData.rejectedTimestamp;
      }
      
      await db.collection('restaurants').doc(rid).update(updateData);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};

// ============================================================================
// LOCAL STORAGE DATABASE (BACKUP) - UPDATED
// ============================================================================

const DB = {
  restaurants: JSON.parse(localStorage.getItem('restaurants') || '{}'),

  save() {
    localStorage.setItem('restaurants', JSON.stringify(this.restaurants));
  },

  addRestaurant(id, data) {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const today = new Date().toISOString().slice(0, 10);
    
    this.restaurants[id] = {
      ...data,
      queue: [],
      plan: 'free',
      planStatus: 'active',
      analytics: {
        currentMonth: currentMonth,
        customersThisMonth: 0,
        lastResetDate: today,
        dailyStats: {}
      },
      monthlyHistory: [],
      lastCleanupDate: today
    };
    
    this.save();
    return id;
  },

  addToQueue(rid, customer) {
    const restaurant = this.restaurants[rid];
    if (!restaurant) return null;
    
    const currentMonth = new Date().toISOString().slice(0, 7);
    const today = new Date().toISOString().slice(0, 10);
    const now = Date.now();
    
    if (!restaurant.analytics) {
      restaurant.analytics = {
        currentMonth: currentMonth,
        customersThisMonth: 0,
        lastResetDate: today,
        dailyStats: {}
      };
    }
    
    // Reset analytics if new month
    if (restaurant.analytics.currentMonth !== currentMonth) {
      if (!restaurant.monthlyHistory) restaurant.monthlyHistory = [];
      restaurant.monthlyHistory.push({
        month: restaurant.analytics.currentMonth,
        totalCustomers: restaurant.analytics.customersThisMonth
      });
      
      restaurant.analytics = {
        currentMonth: currentMonth,
        customersThisMonth: 0,
        lastResetDate: today,
        dailyStats: {},
        customersAtExpiry: undefined,
        expiredAt: undefined
      };
    }
    
    // Take expiry snapshot
    if (restaurant.plan === 'premium' && 
        restaurant.planExpiryDate && 
        restaurant.planExpiryDate < now && 
        restaurant.analytics.customersAtExpiry === undefined) {
      
      const expiryMonth = new Date(restaurant.planExpiryDate).toISOString().slice(0, 7);
      if (expiryMonth === currentMonth) {
        restaurant.analytics.customersAtExpiry = restaurant.analytics.customersThisMonth;
        restaurant.analytics.expiredAt = restaurant.planExpiryDate;
      }
    }
    
    // Calculate effective limit
    const { limit: effectiveLimit } = calculateMonthlyLimit(restaurant, restaurant.analytics);
    
    // Check limit
    if (restaurant.analytics.customersThisMonth >= effectiveLimit) {
      return null;
    }
    
    const queueNumber = `A-${Math.floor(Math.random() * 900) + 100}`;
    
    restaurant.queue.push({
      ...customer,
      queueNumber: queueNumber,
      status: 'waiting',
      joinedAt: new Date().toISOString()
    });
    
    restaurant.analytics.customersThisMonth += 1;
    restaurant.analytics.dailyStats[today] = (restaurant.analytics.dailyStats[today] || 0) + 1;
    
    this.save();
    return queueNumber;
  },

  allocateTable(rid, queueNumber, tableNo) {
    const restaurant = this.restaurants[rid];
    if (!restaurant) return false;
    
    const queueItem = restaurant.queue.find(q => q.queueNumber === queueNumber);
    if (queueItem) {
      queueItem.status = 'allocated';
      queueItem.tableNo = tableNo;
      queueItem.allocatedAt = new Date().toISOString();
      this.save();
      return true;
    }
    return false;
  },

  savePaymentProof(rid, paymentData) {
    const restaurant = this.restaurants[rid];
    if (restaurant) {
      restaurant.paymentProof = {
        ...paymentData,
        uploadedAt: Date.now()
      };
      restaurant.planStatus = 'pending';
      this.save();
      return true;
    }
    return false;
  },

  approvePremium(rid) {
    const restaurant = this.restaurants[rid];
    if (restaurant) {
      restaurant.plan = 'premium';
      restaurant.planStatus = 'active';
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);
      restaurant.planExpiryDate = expiryDate.getTime();
      this.save();
      return true;
    }
    return false;
  },

  rejectPremium(rid, reason) {
    const restaurant = this.restaurants[rid];
    if (restaurant) {
      restaurant.planStatus = 'rejected';
      if (restaurant.paymentProof) {
        restaurant.paymentProof.rejectedAt = Date.now();
        restaurant.paymentProof.rejectionReason = reason;
      }
      this.save();
      return true;
    }
    return false;
  },

  dailyCleanup: (rid, isManual = false) => {
    if (window.LocalStorageCleanup) {
      return window.LocalStorageCleanup.dailyCleanup(rid, isManual);
    }
    return { success: false, error: 'Cleanup module not loaded' };
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Check internet connection
const checkInternet = () => {
  if (!navigator.onLine) {
    alert('⚠️ No Internet Connection\n\nPlease connect to the internet to continue.');
    return false;
  }
  return true;
};

// Get today's QR code URL
const getTodayQRCode = (rid) => {
  return `${window.location.origin}/#/r/${rid}/join`;
};

// Generate QR code with responsive sizing
const generateQRCode = (elementId, rid) => {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  element.innerHTML = '';
  
  const screenWidth = window.innerWidth;
  let size;
  
  if (screenWidth < 768) {
    size = 120;
  } else if (screenWidth < 1024) {
    size = 160;
  } else if (screenWidth < 1920) {
    size = 220;
  } else if (screenWidth < 2560) {
    size = 280;
  } else {
    size = 350;
  }
  
  new QRCode(element, {
    text: getTodayQRCode(rid),
    width: size,
    height: size,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });
};

// Get currently logged in restaurant
const getLoggedInRest = () => {
  for (let id of Object.keys(DB.restaurants)) {
    if (sessionStorage.getItem(`loggedIn_${id}`)) {
      return {
        id: id,
        data: DB.restaurants[id]
      };
    }
  }
  return null;
};

// Navigate to home (either landing or admin dashboard)
const navigateHome = () => {
  const loggedIn = getLoggedInRest();
  if (loggedIn) {
    navigate(`/r/${loggedIn.id}/admin`);
  } else {
    navigate('/');
  }
};

// Render HTML to app container
const render = (html) => {
  document.getElementById('app').innerHTML = html;
};

// Navigate to route
const navigate = (path) => {
  window.location.hash = path;
};

// Toggle mobile menu
const toggleMobileMenu = () => {
  const menu = document.querySelector('.nav-buttons.mobile-menu');
  if (menu) {
    menu.classList.toggle('active');
  }
};

// ============================================================================
// GLOBAL STATE MANAGEMENT
// ============================================================================

// Listener cleanup variables (used by admin/display modules)
let platformAdminListener = null;
let adminUnsubscribe = null;
let displayUnsubscribe = null;

// ============================================================================
// EXPORT TO WINDOW (GLOBAL SCOPE)
// ============================================================================

window.auth = auth;
window.db = db;
window.FirebaseAdmin = FirebaseAdmin;
window.FirebaseDB = FirebaseDB;
window.DB = DB;
window.isPremiumActive = isPremiumActive;
window.calculateMonthlyLimit = calculateMonthlyLimit;
window.checkInternet = checkInternet;
window.getTodayQRCode = getTodayQRCode;
window.generateQRCode = generateQRCode;
window.getLoggedInRest = getLoggedInRest;
window.navigateHome = navigateHome;
window.render = render;
window.navigate = navigate;
window.toggleMobileMenu = toggleMobileMenu;

// Export global state variables
window.platformAdminListener = platformAdminListener;
window.adminUnsubscribe = adminUnsubscribe;
window.displayUnsubscribe = displayUnsubscribe;

console.log('✅ QueueApp Core Module Loaded');
console.log('✅ Expiry Lifecycle Logic: ENABLED');

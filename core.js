// ============================================================================
// QUEUEAPP - CORE.JS (3-TIER PRICING: FREE + PREMIUM + PRO)
// Foundation Layer: Firebase, Database, Utilities, Routing
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
// PLAN CONFIGURATION
// ============================================================================

const PLAN_CATALOG = {
  ACTIVE_PLAN: 'intro_quarterly',
  
  PLANS: {
    intro_quarterly: {
      id: 'intro_quarterly_2026',
      duration: 90,
      price: 1999,
      displayName: 'Quarterly Premium',
      displayPrice: '₹1,999 for 3 months',
      description: 'Limited time offer'
    },
    
    pro_quarterly: {
      id: 'pro_quarterly_2026',
      duration: 90,
      price: 2698,
      displayName: 'Quarterly Pro',
      displayPrice: '₹2,698 for 3 months',
      description: 'Premium + WhatsApp Marketing'
    },
    
    monthly: {
      id: 'monthly_standard',
      duration: 30,
      price: 1999,
      displayName: 'Monthly Premium',
      displayPrice: '₹1,999/month',
      description: 'Standard monthly plan'
    },
    
    quarterly: {
      id: 'quarterly_standard',
      duration: 90,
      price: 5499,
      displayName: 'Quarterly Premium',
      displayPrice: '₹5,499/quarter',
      description: 'Best value - 3 months'
    },
    
    yearly: {
      id: 'yearly_standard',
      duration: 365,
      price: 19999,
      displayName: 'Yearly Premium',
      displayPrice: '₹19,999/year',
      description: 'Maximum savings'
    }
  }
};

const getActivePlan = () => {
  return PLAN_CATALOG.PLANS[PLAN_CATALOG.ACTIVE_PLAN];
};

const calculateTotalDays = (restaurant) => {
  if (restaurant.planDuration) {
    return restaurant.planDuration;
  }
  
  const start = restaurant.planStartDate || restaurant.uploadedTimestamp;
  const expiry = restaurant.planExpiryDate;
  
  if (start && expiry) {
    const calculatedDays = Math.ceil((expiry - start) / (1000 * 60 * 60 * 24));
    return calculatedDays;
  }
  
  return getActivePlan().duration;
};

const generateSubscriptionId = (restaurantId) => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 6).toUpperCase();
  return `SUB-${restaurantId}-${timestamp}-${random}`;
};

const getSubscriptionId = (restaurant, rid) => {
  if (restaurant.subscriptionId) {
    return restaurant.subscriptionId;
  }
  return generateSubscriptionId(rid);
};

const getNextCycleNumber = (restaurant) => {
  return (restaurant.subscriptionCycleNumber || 0) + 1;
};

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
 * Check if Premium OR Pro plan is currently active (not expired)
 */
function isPremiumActive(restaurant) {
  return (restaurant.plan === 'premium' || restaurant.plan === 'pro')
    && restaurant.planStatus === 'active'
    && (!restaurant.planExpiryDate || restaurant.planExpiryDate > Date.now());
}

/**
 * Check if Pro plan is currently active
 */
function isProActive(restaurant) {
  return restaurant.plan === 'pro'
    && restaurant.planStatus === 'active'
    && (!restaurant.planExpiryDate || restaurant.planExpiryDate > Date.now());
}

/**
 * Calculate effective monthly limit based on plan status
 */
function calculateMonthlyLimit(restaurant, analytics) {
  const now = Date.now();
  const currentMonth = new Date().toISOString().slice(0, 7);
  
  if (isPremiumActive(restaurant)) {
    return { limit: Infinity, display: 'unlimited' };
  }
  
  if ((restaurant.plan === 'premium' || restaurant.plan === 'pro') && restaurant.planExpiryDate) {
    const expiryMonth = new Date(restaurant.planExpiryDate).toISOString().slice(0, 7);
    
    if (expiryMonth === currentMonth && analytics.customersAtExpiry !== undefined) {
      const freemiumLimit = analytics.customersAtExpiry + 500;
      return { limit: freemiumLimit, display: freemiumLimit };
    }
  }
  
  return { limit: 500, display: 500 };
}

// ============================================================================
// FIREBASE DATABASE WRAPPER
// ============================================================================

const FirebaseDB = {
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
      
      let analytics = restaurant.analytics || {
        currentMonth: currentMonth,
        customersThisMonth: 0,
        lastResetDate: today,
        dailyStats: {}
      };
      
      if (analytics.currentMonth !== currentMonth) {
        const monthlyHistory = restaurant.monthlyHistory || [];
        
        const historyEntry = {
          month: analytics.currentMonth,
          totalCustomers: analytics.customersThisMonth,
          dailyStats: analytics.dailyStats,
          archivedAt: new Date().toISOString()
        };
        
        if (analytics.customersAtExpiry !== undefined) {
          historyEntry.customersAtExpiry = analytics.customersAtExpiry;
        }
        if (analytics.expiredAt !== undefined) {
          historyEntry.expiredAt = analytics.expiredAt;
        }
        
        monthlyHistory.push(historyEntry);
        
        analytics = {
          currentMonth: currentMonth,
          customersThisMonth: 0,
          lastResetDate: today,
          dailyStats: {}
        };
        
        await restaurantRef.update({
          monthlyHistory: monthlyHistory,
          analytics: analytics
        });
      }
      
      if ((restaurant.plan === 'premium' || restaurant.plan === 'pro') && 
          restaurant.planExpiryDate && 
          restaurant.planExpiryDate < now && 
          analytics.customersAtExpiry === undefined) {
        
        const expiryMonth = new Date(restaurant.planExpiryDate).toISOString().slice(0, 7);
        if (expiryMonth === currentMonth) {
          analytics.customersAtExpiry = analytics.customersThisMonth;
          analytics.expiredAt = restaurant.planExpiryDate;
          
          try {
            const snapshotUpdate = {};
            
            if (analytics.customersAtExpiry !== undefined) {
              snapshotUpdate['analytics.customersAtExpiry'] = analytics.customersAtExpiry;
            }
            if (analytics.expiredAt !== undefined) {
              snapshotUpdate['analytics.expiredAt'] = analytics.expiredAt;
            }
            
            if (Object.keys(snapshotUpdate).length > 0) {
              await restaurantRef.update(snapshotUpdate);
            }
          } catch (updateError) {
            console.error(`[EXPIRY SNAPSHOT ERROR] ${rid}:`, updateError);
          }
        }
      }
      
      const { limit: effectiveLimit, display: displayLimit } = calculateMonthlyLimit(restaurant, analytics);
      
      if (analytics.customersThisMonth >= effectiveLimit) {
        let message;
        if ((restaurant.plan === 'premium' || restaurant.plan === 'pro') && analytics.customersAtExpiry !== undefined) {
          message = `Freemium limit reached (${analytics.customersAtExpiry} before expiry + 500 grace). Renew ${restaurant.plan === 'pro' ? 'Pro' : 'Premium'} for unlimited customers.`;
        } else if (restaurant.plan === 'free') {
          message = 'Monthly limit reached. Upgrade to Premium for unlimited customers.';
        } else {
          message = `Monthly limit reached. Renew ${restaurant.plan === 'pro' ? 'Pro' : 'Premium'} for unlimited customers.`;
        }
        
        return {
          success: false,
          error: 'LIMIT_REACHED',
          message: message,
          customersUsed: analytics.customersThisMonth,
          limit: displayLimit
        };
      }
      
      let queueNumber;
      let attempts = 0;
      const maxAttempts = 100;
      
      do {
        const random = Math.floor(Math.random() * 9000) + 1000;
        queueNumber = `A-${random}`;
        
        const duplicate = restaurant.queue.find(q => q.queueNumber === queueNumber);
        
        if (!duplicate) {
          break;
        }
        
        attempts++;
        
        if (attempts >= maxAttempts) {
          const timestamp = Date.now().toString();
          const uniqueSuffix = timestamp.slice(-5);
          queueNumber = `A-${uniqueSuffix}`;
          break;
        }
      } while (attempts < maxAttempts);

      const queueItem = {
        ...customer,
        queueNumber: queueNumber,
        status: 'waiting',
        joinedAt: new Date().toISOString(),
        zone: customer.zone || null
      };
      
      if (customer.zone && typeof incrementZoneScan === 'function') {
        incrementZoneScan(rid, customer.zone);
      }
      
      analytics.customersThisMonth += 1;
      analytics.dailyStats[today] = (analytics.dailyStats[today] || 0) + 1;
      
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
      console.error('[ADD TO QUEUE ERROR]', err);
      return { success: false, error: err.message };
    }
  },

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

  dailyCleanup: (rid, isManual = false) => {
    if (window.FirebaseCleanup) {
      return window.FirebaseCleanup.dailyCleanup(rid, isManual);
    }
    return Promise.resolve({ success: false, error: 'Cleanup module not loaded' });
  },

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

  async approvePremium(rid, approvalData) {
    try {
      const doc = await db.collection('restaurants').doc(rid).get();
      const restaurantData = doc.exists ? doc.data() : null;
      const paymentProof = restaurantData?.paymentProof || {};
      
      // Get plan type from payment proof (premium or pro)
      const planType = paymentProof.planType || 'premium';
      const activePlan = planType === 'pro' ? PLAN_CATALOG.PLANS.pro_quarterly : getActivePlan();
      
      const now = Date.now();
      const currentExpiry = restaurantData?.planExpiryDate;
      
      let startDate, expiryDate;
      
      if (currentExpiry && currentExpiry > now) {
        startDate = currentExpiry;
        expiryDate = currentExpiry + (activePlan.duration * 24 * 60 * 60 * 1000);
      } else {
        startDate = now;
        expiryDate = now + (activePlan.duration * 24 * 60 * 60 * 1000);
      }
      
      const updateData = {
        plan: planType, // 'premium' or 'pro'
        planStatus: 'active',
        planType: activePlan.id,
        planDuration: activePlan.duration,
        planPrice: activePlan.price,
        planStartDate: startDate,
        planExpiryDate: expiryDate
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
// LOCAL STORAGE DATABASE (BACKUP)
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
    
    if (restaurant.analytics.currentMonth !== currentMonth) {
      if (!restaurant.monthlyHistory) restaurant.monthlyHistory = [];
      
      const historyEntry = {
        month: restaurant.analytics.currentMonth,
        totalCustomers: restaurant.analytics.customersThisMonth
      };
      
      if (restaurant.analytics.customersAtExpiry !== undefined) {
        historyEntry.customersAtExpiry = restaurant.analytics.customersAtExpiry;
      }
      if (restaurant.analytics.expiredAt !== undefined) {
        historyEntry.expiredAt = restaurant.analytics.expiredAt;
      }
      
      restaurant.monthlyHistory.push(historyEntry);
      
      restaurant.analytics = {
        currentMonth: currentMonth,
        customersThisMonth: 0,
        lastResetDate: today,
        dailyStats: {}
      };
    }
    
    if ((restaurant.plan === 'premium' || restaurant.plan === 'pro') && 
        restaurant.planExpiryDate && 
        restaurant.planExpiryDate < now && 
        restaurant.analytics.customersAtExpiry === undefined) {
      
      const expiryMonth = new Date(restaurant.planExpiryDate).toISOString().slice(0, 7);
      if (expiryMonth === currentMonth) {
        restaurant.analytics.customersAtExpiry = restaurant.analytics.customersThisMonth;
        restaurant.analytics.expiredAt = restaurant.planExpiryDate;
      }
    }
    
    const { limit: effectiveLimit } = calculateMonthlyLimit(restaurant, restaurant.analytics);
    
    if (restaurant.analytics.customersThisMonth >= effectiveLimit) {
      return null;
    }
    
    let queueNumber;
    let attempts = 0;
    const maxAttempts = 100;
    
    do {
      const random = Math.floor(Math.random() * 9000) + 1000;
      queueNumber = `A-${random}`;
      
      const duplicate = restaurant.queue.find(q => q.queueNumber === queueNumber);
      
      if (!duplicate) {
        break;
      }
      
      attempts++;
      
      if (attempts >= maxAttempts) {
        const timestamp = Date.now().toString();
        const uniqueSuffix = timestamp.slice(-5);
        queueNumber = `A-${uniqueSuffix}`;
        break;
      }
    } while (attempts < maxAttempts);

    restaurant.queue.push({
      ...customer,
      queueNumber: queueNumber,
      status: 'waiting',
      joinedAt: new Date().toISOString(),
      zone: customer.zone || null
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
      const paymentProof = restaurant.paymentProof || {};
      const planType = paymentProof.planType || 'premium';
      const activePlan = planType === 'pro' ? PLAN_CATALOG.PLANS.pro_quarterly : getActivePlan();
      
      const now = Date.now();
      const currentExpiry = restaurant.planExpiryDate;
      
      let startDate, expiryDate;
      
      if (currentExpiry && currentExpiry > now) {
        startDate = currentExpiry;
        expiryDate = currentExpiry + (activePlan.duration * 24 * 60 * 60 * 1000);
      } else {
        startDate = now;
        expiryDate = now + (activePlan.duration * 24 * 60 * 60 * 1000);
      }
      
      restaurant.plan = planType; // 'premium' or 'pro'
      restaurant.planStatus = 'active';
      restaurant.planType = activePlan.id;
      restaurant.planDuration = activePlan.duration;
      restaurant.planPrice = activePlan.price;
      restaurant.planStartDate = startDate;
      restaurant.planExpiryDate = expiryDate;
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

const checkInternet = () => {
  if (!navigator.onLine) {
    alert('⚠️ No Internet Connection\n\nPlease connect to the internet to continue.');
    return false;
  }
  return true;
};

const getTodayQRCode = (rid) => {
  return `${window.location.origin}/#/r/${rid}/join`;
};

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

const navigateHome = () => {
  const loggedIn = getLoggedInRest();
  if (loggedIn) {
    navigate(`/r/${loggedIn.id}/admin`);
  } else {
    navigate('/');
  }
};

const render = (html) => {
  document.getElementById('app').innerHTML = html;
};

const navigate = (path) => {
  window.location.hash = path;
};

const toggleMobileMenu = () => {
  const menu = document.querySelector('.nav-buttons.mobile-menu');
  if (menu) {
    menu.classList.toggle('active');
  }
};

// ============================================================================
// GLOBAL STATE MANAGEMENT
// ============================================================================

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
window.isProActive = isProActive;
window.calculateMonthlyLimit = calculateMonthlyLimit;
window.checkInternet = checkInternet;
window.getTodayQRCode = getTodayQRCode;
window.generateQRCode = generateQRCode;
window.getLoggedInRest = getLoggedInRest;
window.navigateHome = navigateHome;
window.render = render;
window.navigate = navigate;
window.toggleMobileMenu = toggleMobileMenu;

window.platformAdminListener = platformAdminListener;
window.adminUnsubscribe = adminUnsubscribe;
window.displayUnsubscribe = displayUnsubscribe;

window.PLAN_CATALOG = PLAN_CATALOG;
window.getActivePlan = getActivePlan;
window.calculateTotalDays = calculateTotalDays;

window.generateSubscriptionId = generateSubscriptionId;
window.getSubscriptionId = getSubscriptionId;
window.getNextCycleNumber = getNextCycleNumber;

console.log('✅ QueueApp Core Module Loaded (3-Tier Pricing: Free + Premium + Pro)');

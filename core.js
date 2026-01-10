// ============================================================================
// QUEUEAPP - CORE.JS
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

  // Add customer to queue
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
      
      // Check free plan limit
      if (restaurant.plan === 'free' && analytics.customersThisMonth >= 500) {
        return {
          success: false,
          error: 'LIMIT_REACHED',
          message: 'Monthly limit reached. Upgrade to Premium.',
          customersUsed: analytics.customersThisMonth,
          limit: 500
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
        limit: restaurant.plan === 'free' ? 500 : 'unlimited'
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
        dailyStats: {}
      };
    }
    
    // Check free plan limit
    if (restaurant.plan === 'free' && restaurant.analytics.customersThisMonth >= 500) {
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

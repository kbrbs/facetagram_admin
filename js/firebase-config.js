import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

const firebaseConfig = {
  apiKey: "AIzaSyBBBsOi1Nb-pvYb7HlE9y_qBDrcdG52LGw",
  authDomain: "facetagram-f287f.firebaseapp.com",
  databaseURL: "https://facetagram-f287f-default-rtdb.firebaseio.com",
  projectId: "facetagram-f287f",
  storageBucket: "facetagram-f287f.appspot.com",
  messagingSenderId: "87540584043",
  appId: "1:87540584043:web:dc82b9ec6862dc8c086b2e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); // Add this line

// Add this function to log admin details
const logAdminDetails = async (userId) => {
    try {
        const adminDocRef = doc(db, 'Admin', userId);
        const adminDoc = await getDoc(adminDocRef);
        
        if (adminDoc.exists()) {
            const adminData = adminDoc.data();
            console.log('============ Admin Details ============');
            console.log('Admin ID:', userId);
            console.log('Full Name:', adminData.Fullname);
            console.log('Email:', adminData.Email);
            console.log('Profile Image:', adminData.profile_image || 'No profile image');
            console.log('Complete Admin Data:', adminData);
            console.log('====================================');
            
            // Update admin name in the UI
            const adminNameElement = document.getElementById('adminName');
            if (adminNameElement) {
                adminNameElement.textContent = adminData.Fullname;
            }
        } else {
            console.log('No admin document found for ID:', userId);
        }
    } catch (error) {
        console.error('Error fetching admin details:', error);
    }
};

// Add auth state listener
onAuthStateChanged(auth, (user) => {
    if (user) {
        logAdminDetails(user.uid);
    }
});

export { app, auth, db, storage, logAdminDetails };  // Add storage to exports
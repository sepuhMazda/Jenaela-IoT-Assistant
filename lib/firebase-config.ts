/**
 * Firebase configuration and initialization module.
 * This module handles the setup of Firebase services for the application.
 * @module
 */
import { initializeApp } from "firebase/app";

// IGNORE IMPORT ERROR, this is a valid import, still investigating
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getDatabase } from "firebase/database"; // ✅ Realtime DB
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";

// ============================================================================
// Configuration
// ============================================================================

/**
 * Firebase configuration object containing necessary credentials and endpoints
 * @type {Object}
 */
const firebaseConfig = {
  apiKey: "AIzaSyDJ_YxqLo6A27NoNh3R1xANOTBVIAL9czk",
  authDomain: "buttoniot-52007.firebaseapp.com",
  projectId: "buttoniot-52007",
  storageBucket: "buttoniot-52007.firebasestorage.app",
  messagingSenderId: "156560225665",
  appId: "1:156560225665:web:9d711f3510f2bb607fe480",
  databaseURL: "https://buttoniot-52007-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// ============================================================================
// Firebase Initialization
// ============================================================================

/**
 * Initialize Firebase application instance
 * @type {FirebaseApp}
 */
const app = initializeApp(firebaseConfig);

/**
 * Initialize Firebase Authentication service
 * @type {Auth}
 */
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});

/**
 * Initialize Firebase Realtime Database
 * @type {Database}
 */
const db = getDatabase(app);

// ============================================================================
// Exports
// ============================================================================

export { auth, db };
export default app;

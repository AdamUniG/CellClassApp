// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBHxgXvDMefutRYOQnxqUCDfT4e4g48OGk",
  authDomain: "hcopc-39300.firebaseapp.com",
  projectId: "hcopc-39300",
  storageBucket: "hcopc-39300.firebasestorage.app",
  messagingSenderId: "773904299742",
  appId: "1:773904299742:web:00b3886723b38e89d0b44f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const fb = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});
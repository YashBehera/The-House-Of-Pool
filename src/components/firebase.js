import { initializeApp } from "firebase/app";
import {getAuth} from "firebase/auth";
import {getFirestore} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBkDMycEncOfbM4wzihrllZPd4TZrt4ORE",
  authDomain: "thehouseofpool-90cd2.firebaseapp.com",
  projectId: "thehouseofpool-90cd2",
  storageBucket: "thehouseofpool-90cd2.firebasestorage.app",
  messagingSenderId: "659516685125",
  appId: "1:659516685125:web:d63c0f637556fd0e4edc2c",
  measurementId: "G-J5JVWDFE38"
};

const app = initializeApp(firebaseConfig);

export const auth=getAuth();
export const db=getFirestore(app);
export default app;
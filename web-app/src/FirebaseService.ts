import { initializeApp } from 'firebase/app';
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCJDktSvIOGkzFJ9IUgxWS249vfAehwFdw",
  authDomain: "chat-gpt-api-210d6.firebaseapp.com",
  projectId: "chat-gpt-api-210d6",
  storageBucket: "chat-gpt-api-210d6.appspot.com",
  messagingSenderId: "809793920434",
  appId: "1:809793920434:web:00a8df0e2f0e5c726918ab"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default { firestore: db }
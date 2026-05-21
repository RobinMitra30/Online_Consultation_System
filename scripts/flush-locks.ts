import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "your-project-id", // Will need the real firebase config... wait, we can just use the web client
};

// ... we don't have node keys... wait, the web client will require auth.

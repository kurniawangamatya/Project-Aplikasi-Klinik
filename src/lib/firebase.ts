import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { 
  getFirestore, 
  initializeFirestore,
  doc, 
  getDoc as originalGetDoc, 
  setDoc as originalSetDoc, 
  collection, 
  onSnapshot as originalOnSnapshot, 
  query, 
  where, 
  orderBy, 
  addDoc as originalAddDoc, 
  updateDoc as originalUpdateDoc, 
  deleteDoc as originalDeleteDoc,
  serverTimestamp,
  getDocFromServer,
  collectionGroup,
  getDocs as originalGetDocs,
  limit
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function checkAndLogQuotaError(error: any): boolean {
  if (!error) return false;
  const msg = typeof error === 'string' ? error : (error.message || String(error));
  const code = error.code || '';
  if (
    code === 'resource-exhausted' ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('Quota exceeded') ||
    msg.includes('quota') ||
    msg.includes('Quota') ||
    msg.includes('exhausted') ||
    msg.includes('limit')
  ) {
    if (typeof window !== 'undefined') {
      (window as any).__firebaseQuotaExceeded = true;
      window.dispatchEvent(new CustomEvent('firebase-quota-exceeded'));
    }
    return true;
  }
  return false;
}

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    checkAndLogQuotaError(error);
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}

testConnection();

// Safe Proxy Wrappers
export async function getDoc(reference: any) {
  try {
    return await originalGetDoc(reference);
  } catch (error) {
    checkAndLogQuotaError(error);
    throw error;
  }
}

export async function setDoc(reference: any, data: any, options?: any) {
  try {
    return await originalSetDoc(reference, data, options);
  } catch (error) {
    checkAndLogQuotaError(error);
    throw error;
  }
}

export async function addDoc(reference: any, data: any) {
  try {
    return await originalAddDoc(reference, data);
  } catch (error) {
    checkAndLogQuotaError(error);
    throw error;
  }
}

export async function updateDoc(reference: any, ...args: any[]) {
  try {
    return await (originalUpdateDoc as any)(reference, ...args);
  } catch (error) {
    checkAndLogQuotaError(error);
    throw error;
  }
}

export async function deleteDoc(reference: any) {
  try {
    return await originalDeleteDoc(reference);
  } catch (error) {
    checkAndLogQuotaError(error);
    throw error;
  }
}

export async function getDocs(q: any) {
  try {
    return await originalGetDocs(q);
  } catch (error) {
    checkAndLogQuotaError(error);
    throw error;
  }
}

export function onSnapshot(reference: any, ...args: any[]) {
  let onNext: any = null;
  let onError: any = null;

  if (typeof args[0] === 'function') {
    onNext = args[0];
    if (typeof args[1] === 'function') {
      onError = args[1];
    }
  } else if (args[0] && typeof args[0] === 'object') {
    onNext = args[0].next;
    onError = args[0].error;
  }

  const safeOnError = (err: any) => {
    checkAndLogQuotaError(err);
    console.warn("Intercepted onSnapshot Firestore Error:", err);
    if (onError) {
      try {
        onError(err);
      } catch (e) {
         // Silently catch handler errors
      }
    }
  };

  const safeOnNext = (snapshot: any) => {
    if (onNext) {
      try {
        onNext(snapshot);
      } catch (e) {
         console.error("Error in onSnapshot onNext:", e);
      }
    }
  };

  try {
    if (typeof args[0] === 'function') {
      return originalOnSnapshot(reference, safeOnNext, safeOnError);
    } else {
      return originalOnSnapshot(reference, {
        next: safeOnNext,
        error: safeOnError
      });
    }
  } catch (err) {
    checkAndLogQuotaError(err);
    console.warn("Failed sync listen start:", err);
    return () => {};
  }
}

export { 
  doc, collection, query, where, orderBy, serverTimestamp, signInWithPopup, signOut, collectionGroup, limit
};

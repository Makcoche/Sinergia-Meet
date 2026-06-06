import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, setDoc, getDoc, getDocs, 
  updateDoc, query, where, orderBy, limit, deleteDoc
} from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

// Load Firebase configuration
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
let firebaseConfig: any = {};
try {
  firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (e) {
  console.error('[DB] Error loading firebase-applet-config.json:', e);
}

const firebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

/**
 * Seeding initial default data to Firestore if empty
 */
export async function seedDatabaseIfEmpty() {
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    if (usersSnap.empty) {
      console.log('[DB] Seeding default database entities on Cloud Firestore...');
      
      const seedUsers = [
        {
          id: 'user-admin',
          name: 'José Urdaneta',
          email: 'josegregoriourdanetaguadama@gmail.com',
          role: 'ADMIN',
          status: 'ACTIVE',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80',
          emailVerified: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'user-1',
          name: 'Ana Milena',
          email: 'ana.milena@creative.com',
          role: 'USER',
          status: 'ACTIVE',
          avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80',
          emailVerified: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'user-2',
          name: 'Carlos Mendoza',
          email: 'carlos.m@sinergia.com',
          role: 'ENTERPRISE',
          status: 'ACTIVE',
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80',
          emailVerified: true,
          createdAt: new Date().toISOString(),
        }
      ];

      const seedWallets = [
        { id: 'wallet-admin', userId: 'user-admin', balance: 1000.00, currency: 'USD', status: 'ACTIVE', updatedAt: new Date().toISOString() },
        { id: 'wallet-u1', userId: 'user-1', balance: 50.00, currency: 'USD', status: 'ACTIVE', updatedAt: new Date().toISOString() },
        { id: 'wallet-u2', userId: 'user-2', balance: 250.00, currency: 'USD', status: 'ACTIVE', updatedAt: new Date().toISOString() },
      ];

      for (const u of seedUsers) {
        await setDoc(doc(db, 'users', u.id), u);
      }
      for (const w of seedWallets) {
        await setDoc(doc(db, 'wallets', w.id), w);
      }
      console.log('[DB] Cloud Firestore database successfully seeded!');
    }
  } catch (err) {
    console.error('[DB] Error seeding Firestore:', err);
  }
}

// ==========================================
// USER DATABASE METHODS
// ==========================================
export async function getUsers(): Promise<any[]> {
  const snap = await getDocs(collection(db, 'users'));
  const docs: any[] = [];
  snap.forEach(d => docs.push(d.data()));
  return docs;
}

export async function getUserById(userId: string): Promise<any | null> {
  const ref = doc(db, 'users', userId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function getUserByEmail(email: string): Promise<any | null> {
  const q = query(collection(db, 'users'), where('email', '==', email));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data();
}

export async function createUser(user: any): Promise<any> {
  await setDoc(doc(db, 'users', user.id), user);
  return user;
}

export async function updateUser(userId: string, data: any): Promise<void> {
  const ref = doc(db, 'users', userId);
  await updateDoc(ref, data);
}

// ==========================================
// WALLET DATABASE METHODS
// ==========================================
export async function getWallets(): Promise<any[]> {
  const snap = await getDocs(collection(db, 'wallets'));
  const list: any[] = [];
  snap.forEach(d => list.push(d.data()));
  return list;
}

export async function getWalletByUserId(userId: string): Promise<any | null> {
  const q = query(collection(db, 'wallets'), where('userId', '==', userId));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data();
}

export async function createWallet(wallet: any): Promise<any> {
  await setDoc(doc(db, 'wallets', wallet.id), wallet);
  return wallet;
}

export async function updateWalletBalance(walletId: string, balance: number): Promise<void> {
  const ref = doc(db, 'wallets', walletId);
  await updateDoc(ref, { 
    balance,
    updatedAt: new Date().toISOString()
  });
}

// ==========================================
// TRANSACTIONS DATABASE METHODS
// ==========================================
export async function getTransactions(): Promise<any[]> {
  const snap = await getDocs(collection(db, 'walletTransactions'));
  const list: any[] = [];
  snap.forEach(d => list.push(d.data()));
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getTransactionsByWalletId(walletId: string): Promise<any[]> {
  const q = query(collection(db, 'walletTransactions'), where('walletId', '==', walletId));
  const snap = await getDocs(q);
  const list: any[] = [];
  snap.forEach(d => list.push(d.data()));
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createTransaction(tx: any): Promise<any> {
  await setDoc(doc(db, 'walletTransactions', tx.id), tx);
  return tx;
}

// ==========================================
// MEETINGS DATABASE METHODS
// ==========================================
export async function getMeetings(): Promise<any[]> {
  const snap = await getDocs(collection(db, 'meetings'));
  const list: any[] = [];
  snap.forEach(d => list.push(d.data()));
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createMeeting(meet: any): Promise<any> {
  await setDoc(doc(db, 'meetings', meet.id), meet);
  return meet;
}

export async function updateMeetingStatus(meetId: string, status: string, participantCount?: number): Promise<void> {
  const ref = doc(db, 'meetings', meetId);
  const updates: any = { status };
  if (participantCount !== undefined) {
    updates.participantCount = participantCount;
  }
  await updateDoc(ref, updates);
}

// ==========================================
// TRANSCRIPTS DATABASE METHODS
// ==========================================
export async function getTranscript(meetId: string): Promise<any | null> {
  const ref = doc(db, 'transcripts', meetId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function saveTranscript(transcript: any): Promise<void> {
  await setDoc(doc(db, 'transcripts', transcript.meetingId), transcript);
}

// ==========================================
// TEAMS DATABASE METHODS
// ==========================================
export async function getTeamsByOwnerId(ownerId: string): Promise<any[]> {
  const q = query(collection(db, 'teams'), where('ownerId', '==', ownerId));
  const snap = await getDocs(q);
  const list: any[] = [];
  snap.forEach(d => list.push(d.data()));
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createTeam(team: any): Promise<any> {
  await setDoc(doc(db, 'teams', team.id), team);
  return team;
}

// ==========================================
// SUBSCRIPTIONS AND INVOICES
// ==========================================
export async function getSubscriptionByUserId(userId: string): Promise<any | null> {
  const q = query(collection(db, 'subscriptions'), where('userId', '==', userId));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data();
}

export async function saveSubscription(sub: any): Promise<void> {
  await setDoc(doc(db, 'subscriptions', sub.id), sub);
}

export async function getInvoices(): Promise<any[]> {
  const snap = await getDocs(collection(db, 'invoices'));
  const list: any[] = [];
  snap.forEach(d => list.push(d.data()));
  return list.sort((a, b) => b.date.localeCompare(a.date));
}

export async function createInvoice(invoice: any): Promise<any> {
  await setDoc(doc(db, 'invoices', invoice.id), invoice);
  return invoice;
}

// ==========================================
// AUDIT LOGS DATABASE METHODS
// ==========================================
export async function getAuditLogs(): Promise<any[]> {
  const snap = await getDocs(collection(db, 'auditLogs'));
  const list: any[] = [];
  snap.forEach(d => list.push(d.data()));
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createAuditLog(log: any): Promise<any> {
  await setDoc(doc(db, 'auditLogs', log.id), log);
  return log;
}

// ==========================================
// ADMINISTRATIVE DEMO CLEAR RESET ALL
// ==========================================
export async function resetDatabase(): Promise<void> {
  const collections = ['meetings', 'teams', 'walletTransactions', 'invoices', 'auditLogs', 'transcripts', 'subscriptions'];
  for (const cName of collections) {
    const snap = await getDocs(collection(db, cName));
    for (const d of snap.docs) {
      await deleteDoc(doc(db, cName, d.id));
    }
  }

  // Reset preseeded wallets to their original balance
  const walletsSnap = await getDocs(collection(db, 'wallets'));
  for (const d of walletsSnap.docs) {
    const data = d.data();
    let initialBalance = 0.00;
    if (data.userId === 'user-admin') initialBalance = 1000.00;
    if (data.userId === 'user-1') initialBalance = 50.00;
    if (data.userId === 'user-2') initialBalance = 250.00;

    await updateDoc(doc(db, 'wallets', d.id), {
      balance: initialBalance,
      updatedAt: new Date().toISOString()
    });
  }
}

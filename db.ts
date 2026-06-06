import { initializeApp } from 'firebase/app';
import { 
  initializeFirestore, collection, doc, setDoc, getDoc, getDocs, 
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
export const db = initializeFirestore(firebaseApp, {
  experimentalForceLongPolling: true,
  // @ts-ignore
  useFetchStreams: false,
}, firebaseConfig.firestoreDatabaseId);

// ============================================================================
// SELF-HEALING ARCHITECTURE: PERSISTENT LOCAL FALLBACK DATABASE DEFINITION
// ============================================================================

interface LocalDB {
  users: Record<string, any>;
  wallets: Record<string, any>;
  walletTransactions: Record<string, any>;
  meetings: Record<string, any>;
  transcripts: Record<string, any>;
  teams: Record<string, any>;
  subscriptions: Record<string, any>;
  invoices: Record<string, any>;
  auditLogs: Record<string, any>;
}

const LOCAL_DB_PATH = path.join(process.cwd(), 'local_db.json');

const defaultDB: LocalDB = {
  users: {
    'user-admin': {
      id: 'user-admin',
      name: 'José Urdaneta',
      email: 'josegregoriourdanetaguadama@gmail.com',
      role: 'ADMIN',
      status: 'ACTIVE',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80',
      emailVerified: true,
      createdAt: new Date().toISOString(),
    },
    'user-1': {
      id: 'user-1',
      name: 'Ana Milena',
      email: 'ana.milena@creative.com',
      role: 'USER',
      status: 'ACTIVE',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80',
      emailVerified: true,
      createdAt: new Date().toISOString(),
    },
    'user-2': {
      id: 'user-2',
      name: 'Carlos Mendoza',
      email: 'carlos.m@sinergia.com',
      role: 'ENTERPRISE',
      status: 'ACTIVE',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80',
      emailVerified: true,
      createdAt: new Date().toISOString(),
    }
  },
  wallets: {
    'wallet-admin': { id: 'wallet-admin', userId: 'user-admin', balance: 1000.00, currency: 'USD', status: 'ACTIVE', updatedAt: new Date().toISOString() },
    'wallet-u1': { id: 'wallet-u1', userId: 'user-1', balance: 50.00, currency: 'USD', status: 'ACTIVE', updatedAt: new Date().toISOString() },
    'wallet-u2': { id: 'wallet-u2', userId: 'user-2', balance: 250.00, currency: 'USD', status: 'ACTIVE', updatedAt: new Date().toISOString() },
  },
  walletTransactions: {},
  meetings: {},
  transcripts: {},
  teams: {},
  subscriptions: {},
  invoices: {},
  auditLogs: {}
};

// Global fallback state indicator
let useLocalFallback = false;

// Load, Merging with default structure to prevent runtime undefined cracks
function loadLocalDB(): LocalDB {
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const data = JSON.parse(fs.readFileSync(LOCAL_DB_PATH, 'utf8'));
      return {
        users: data.users || { ...defaultDB.users },
        wallets: data.wallets || { ...defaultDB.wallets },
        walletTransactions: data.walletTransactions || {},
        meetings: data.meetings || {},
        transcripts: data.transcripts || {},
        teams: data.teams || {},
        subscriptions: data.subscriptions || {},
        invoices: data.invoices || {},
        auditLogs: data.auditLogs || {}
      };
    }
  } catch (e) {
    console.error('[HYBRID DB] Error loading local_db.json file:', e);
  }
  return {
    users: { ...defaultDB.users },
    wallets: { ...defaultDB.wallets },
    walletTransactions: {},
    meetings: {},
    transcripts: {},
    teams: {},
    subscriptions: {},
    invoices: {},
    auditLogs: {}
  };
}

function saveLocalDB(data: LocalDB) {
  try {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('[HYBRID DB] Error writing local_db.json file:', e);
  }
}

// Ensure local db has seed file on storage instantly
if (!fs.existsSync(LOCAL_DB_PATH)) {
  saveLocalDB(defaultDB);
}

// Connection probe executed on module initialization
async function probeFirestore() {
  try {
    const q = query(collection(db, 'users'), limit(1));
    const queryPromise = getDocs(q);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('TIMEOUT_EXPIRED')), 800)
    );
    await Promise.race([queryPromise, timeoutPromise]);
    console.log('[HYBRID DB] Connection to Cloud Firestore verified. Using Firestore as master database.');
  } catch (err) {
    console.warn('[HYBRID DB] Connection to Cloud Firestore failed or timed out. Entering self-healing mode: using local JSON storage.');
    useLocalFallback = true;
  }
}

// Start async probe immediately
probeFirestore();

// ============================================================================
// HYBRID DATABASE ROUTER METHODS
// ============================================================================

export async function seedDatabaseIfEmpty() {
  if (useLocalFallback) {
    console.log('[HYBRID DB] Local database already seeded.');
    return;
  }
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    if (usersSnap.empty) {
      console.log('[HYBRID DB] Seeding master Cloud Firestore database...');
      const local = loadLocalDB();
      // Seed users
      for (const u of Object.values(local.users)) {
        await setDoc(doc(db, 'users', u.id), u);
      }
      // Seed wallets
      for (const w of Object.values(local.wallets)) {
        await setDoc(doc(db, 'wallets', w.id), w);
      }
      console.log('[HYBRID DB] Cloud Firestore database seeded successfully.');
    }
  } catch (err) {
    console.warn('[HYBRID DB] Skipping Cloud Firestore seed due to permissions/connectivity.');
    useLocalFallback = true;
  }
}

export async function getUsers(): Promise<any[]> {
  if (useLocalFallback) {
    const local = loadLocalDB();
    return Object.values(local.users);
  }
  try {
    const snap = await getDocs(collection(db, 'users'));
    const docs: any[] = [];
    snap.forEach(d => docs.push(d.data()));
    return docs;
  } catch (err) {
    console.error('[HYBRID DB] getUsers error, falling back locally', err);
    useLocalFallback = true;
    return getUsers();
  }
}

export async function getUserById(userId: string): Promise<any | null> {
  if (useLocalFallback) {
    const local = loadLocalDB();
    return local.users[userId] || null;
  }
  try {
    const ref = doc(db, 'users', userId);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.error('[HYBRID DB] getUserById error, falling back locally', err);
    useLocalFallback = true;
    return getUserById(userId);
  }
}

export async function getUserByEmail(email: string): Promise<any | null> {
  if (useLocalFallback) {
    const local = loadLocalDB();
    const searchEmail = email.trim().toLowerCase();
    const user = Object.values(local.users).find((u: any) => u.email.trim().toLowerCase() === searchEmail);
    return user || null;
  }
  try {
    const q = query(collection(db, 'users'), where('email', '==', email));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return snap.docs[0].data();
  } catch (err) {
    console.error('[HYBRID DB] getUserByEmail error, falling back locally', err);
    useLocalFallback = true;
    return getUserByEmail(email);
  }
}

export async function createUser(user: any): Promise<any> {
  const local = loadLocalDB();
  local.users[user.id] = user;
  saveLocalDB(local);

  if (!useLocalFallback) {
    try {
      await setDoc(doc(db, 'users', user.id), user);
    } catch (err) {
      console.error('[HYBRID DB] Local write succeeded, Firestore write failed. Forcing local fallback.');
      useLocalFallback = true;
    }
  }
  return user;
}

export async function updateUser(userId: string, data: any): Promise<void> {
  const local = loadLocalDB();
  if (local.users[userId]) {
    local.users[userId] = { ...local.users[userId], ...data };
    saveLocalDB(local);
  }

  if (!useLocalFallback) {
    try {
      const ref = doc(db, 'users', userId);
      await updateDoc(ref, data);
    } catch (err) {
      console.error('[HYBRID DB] Local update succeeded, Firestore update failed. Forcing local fallback.');
      useLocalFallback = true;
    }
  }
}

export async function getWallets(): Promise<any[]> {
  if (useLocalFallback) {
    const local = loadLocalDB();
    return Object.values(local.wallets);
  }
  try {
    const snap = await getDocs(collection(db, 'wallets'));
    const list: any[] = [];
    snap.forEach(d => list.push(d.data()));
    return list;
  } catch (err) {
    useLocalFallback = true;
    return getWallets();
  }
}

export async function getWalletByUserId(userId: string): Promise<any | null> {
  if (useLocalFallback) {
    const local = loadLocalDB();
    const wallet = Object.values(local.wallets).find((w: any) => w.userId === userId);
    return wallet || null;
  }
  try {
    const q = query(collection(db, 'wallets'), where('userId', '==', userId));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return snap.docs[0].data();
  } catch (err) {
    useLocalFallback = true;
    return getWalletByUserId(userId);
  }
}

export async function createWallet(wallet: any): Promise<any> {
  const local = loadLocalDB();
  local.wallets[wallet.id] = wallet;
  saveLocalDB(local);

  if (!useLocalFallback) {
    try {
      await setDoc(doc(db, 'wallets', wallet.id), wallet);
    } catch (err) {
      useLocalFallback = true;
    }
  }
  return wallet;
}

export async function updateWalletBalance(walletId: string, balance: number): Promise<void> {
  const local = loadLocalDB();
  if (local.wallets[walletId]) {
    local.wallets[walletId].balance = balance;
    local.wallets[walletId].updatedAt = new Date().toISOString();
    saveLocalDB(local);
  }

  if (!useLocalFallback) {
    try {
      const ref = doc(db, 'wallets', walletId);
      await updateDoc(ref, { 
        balance,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      useLocalFallback = true;
    }
  }
}

export async function getTransactions(): Promise<any[]> {
  if (useLocalFallback) {
    const local = loadLocalDB();
    return Object.values(local.walletTransactions).sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt));
  }
  try {
    const snap = await getDocs(collection(db, 'walletTransactions'));
    const list: any[] = [];
    snap.forEach(d => list.push(d.data()));
    return list.sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt));
  } catch (err) {
    useLocalFallback = true;
    return getTransactions();
  }
}

export async function getTransactionsByWalletId(walletId: string): Promise<any[]> {
  if (useLocalFallback) {
    const local = loadLocalDB();
    return Object.values(local.walletTransactions)
      .filter((t: any) => t.walletId === walletId)
      .sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt));
  }
  try {
    const q = query(collection(db, 'walletTransactions'), where('walletId', '==', walletId));
    const snap = await getDocs(q);
    const list: any[] = [];
    snap.forEach(d => list.push(d.data()));
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (err) {
    useLocalFallback = true;
    return getTransactionsByWalletId(walletId);
  }
}

export async function createTransaction(tx: any): Promise<any> {
  const local = loadLocalDB();
  local.walletTransactions[tx.id] = tx;
  saveLocalDB(local);

  if (!useLocalFallback) {
    try {
      await setDoc(doc(db, 'walletTransactions', tx.id), tx);
    } catch (err) {
      useLocalFallback = true;
    }
  }
  return tx;
}

export async function getMeetings(): Promise<any[]> {
  if (useLocalFallback) {
    const local = loadLocalDB();
    return Object.values(local.meetings).sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt));
  }
  try {
    const snap = await getDocs(collection(db, 'meetings'));
    const list: any[] = [];
    snap.forEach(d => list.push(d.data()));
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (err) {
    useLocalFallback = true;
    return getMeetings();
  }
}

export async function createMeeting(meet: any): Promise<any> {
  const local = loadLocalDB();
  local.meetings[meet.id] = meet;
  saveLocalDB(local);

  if (!useLocalFallback) {
    try {
      await setDoc(doc(db, 'meetings', meet.id), meet);
    } catch (err) {
      useLocalFallback = true;
    }
  }
  return meet;
}

export async function updateMeetingStatus(meetId: string, status: string, participantCount?: number): Promise<void> {
  const local = loadLocalDB();
  if (local.meetings[meetId]) {
    local.meetings[meetId].status = status;
    if (participantCount !== undefined) {
      local.meetings[meetId].participantCount = participantCount;
    }
    saveLocalDB(local);
  }

  if (!useLocalFallback) {
    try {
      const ref = doc(db, 'meetings', meetId);
      const updates: any = { status };
      if (participantCount !== undefined) {
        updates.participantCount = participantCount;
      }
      await updateDoc(ref, updates);
    } catch (err) {
      useLocalFallback = true;
    }
  }
}

export async function getTranscript(meetId: string): Promise<any | null> {
  if (useLocalFallback) {
    const local = loadLocalDB();
    return local.transcripts[meetId] || null;
  }
  try {
    const ref = doc(db, 'transcripts', meetId);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    useLocalFallback = true;
    return getTranscript(meetId);
  }
}

export async function saveTranscript(transcript: any): Promise<void> {
  const local = loadLocalDB();
  local.transcripts[transcript.meetingId] = transcript;
  saveLocalDB(local);

  if (!useLocalFallback) {
    try {
      await setDoc(doc(db, 'transcripts', transcript.meetingId), transcript);
    } catch (err) {
      useLocalFallback = true;
    }
  }
}

export async function getTeamsByOwnerId(ownerId: string): Promise<any[]> {
  if (useLocalFallback) {
    const local = loadLocalDB();
    return Object.values(local.teams)
      .filter((t: any) => t.ownerId === ownerId)
      .sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt));
  }
  try {
    const q = query(collection(db, 'teams'), where('ownerId', '==', ownerId));
    const snap = await getDocs(q);
    const list: any[] = [];
    snap.forEach(d => list.push(d.data()));
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (err) {
    useLocalFallback = true;
    return getTeamsByOwnerId(ownerId);
  }
}

export async function createTeam(team: any): Promise<any> {
  const local = loadLocalDB();
  local.teams[team.id] = team;
  saveLocalDB(local);

  if (!useLocalFallback) {
    try {
      await setDoc(doc(db, 'teams', team.id), team);
    } catch (err) {
      useLocalFallback = true;
    }
  }
  return team;
}

export async function getSubscriptionByUserId(userId: string): Promise<any | null> {
  if (useLocalFallback) {
    const local = loadLocalDB();
    return Object.values(local.subscriptions).find((s: any) => s.userId === userId) || null;
  }
  try {
    const q = query(collection(db, 'subscriptions'), where('userId', '==', userId));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return snap.docs[0].data();
  } catch (err) {
    useLocalFallback = true;
    return getSubscriptionByUserId(userId);
  }
}

export async function saveSubscription(sub: any): Promise<void> {
  const local = loadLocalDB();
  local.subscriptions[sub.id] = sub;
  saveLocalDB(local);

  if (!useLocalFallback) {
    try {
      await setDoc(doc(db, 'subscriptions', sub.id), sub);
    } catch (err) {
      useLocalFallback = true;
    }
  }
}

export async function getInvoices(): Promise<any[]> {
  if (useLocalFallback) {
    const local = loadLocalDB();
    return Object.values(local.invoices).sort((a: any, b: any) => b.date.localeCompare(a.date));
  }
  try {
    const snap = await getDocs(collection(db, 'invoices'));
    const list: any[] = [];
    snap.forEach(d => list.push(d.data()));
    return list.sort((a, b) => b.date.localeCompare(a.date));
  } catch (err) {
    useLocalFallback = true;
    return getInvoices();
  }
}

export async function createInvoice(invoice: any): Promise<any> {
  const local = loadLocalDB();
  local.invoices[invoice.id] = invoice;
  saveLocalDB(local);

  if (!useLocalFallback) {
    try {
      await setDoc(doc(db, 'invoices', invoice.id), invoice);
    } catch (err) {
      useLocalFallback = true;
    }
  }
  return invoice;
}

export async function getAuditLogs(): Promise<any[]> {
  if (useLocalFallback) {
    const local = loadLocalDB();
    return Object.values(local.auditLogs).sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt));
  }
  try {
    const snap = await getDocs(collection(db, 'auditLogs'));
    const list: any[] = [];
    snap.forEach(d => list.push(d.data()));
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (err) {
    useLocalFallback = true;
    return getAuditLogs();
  }
}

export async function createAuditLog(log: any): Promise<any> {
  const local = loadLocalDB();
  local.auditLogs[log.id] = log;
  saveLocalDB(local);

  if (!useLocalFallback) {
    try {
      await setDoc(doc(db, 'auditLogs', log.id), log);
    } catch (err) {
      useLocalFallback = true;
    }
  }
  return log;
}

export async function resetDatabase(): Promise<void> {
  // Reset local database completely
  const local = loadLocalDB();
  local.walletTransactions = {};
  local.meetings = {};
  local.transcripts = {};
  local.teams = {};
  local.subscriptions = {};
  local.invoices = {};
  local.auditLogs = {};

  // Reset preseeded wallets to their original balance
  local.wallets['wallet-admin'].balance = 1000.00;
  local.wallets['wallet-admin'].updatedAt = new Date().toISOString();
  local.wallets['wallet-u1'].balance = 50.00;
  local.wallets['wallet-u1'].updatedAt = new Date().toISOString();
  local.wallets['wallet-u2'].balance = 250.00;
  local.wallets['wallet-u2'].updatedAt = new Date().toISOString();

  saveLocalDB(local);

  if (!useLocalFallback) {
    try {
      const collections = ['meetings', 'teams', 'walletTransactions', 'invoices', 'auditLogs', 'transcripts', 'subscriptions'];
      for (const cName of collections) {
        const snap = await getDocs(collection(db, cName));
        for (const d of snap.docs) {
          await deleteDoc(doc(db, cName, d.id));
        }
      }

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
    } catch (err) {
      useLocalFallback = true;
    }
  }
}

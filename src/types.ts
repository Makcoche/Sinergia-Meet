/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// User & Team Structures
export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'USER' | 'ADMIN' | 'ENTERPRISE';
  status: 'ACTIVE' | 'PENDING' | 'SUSPENDED';
  teamId?: string;
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  ownerId: string;
  membersCount: number;
  createdAt: string;
}

// Meeting structures
export interface Meeting {
  id: string;
  title: string;
  hostId: string;
  hostName: string;
  password?: string;
  status: 'SCHEDULED' | 'LIVE' | 'ENDED';
  waitingRoom: boolean;
  participantCount: number;
  maxParticipants: number;
  createdAt: string;
  scheduledFor?: string;
}

export interface Participant {
  id: string;
  userId: string;
  name: string;
  avatar?: string;
  role: 'HOST' | 'PRESENTER' | 'ATTENDEE';
  isMuted: boolean;
  isVideoOff: boolean;
  handRaised: boolean;
  joinedAt: string;
  isInWaitingRoom: boolean;
}

export interface ChatMessage {
  id: string;
  meetingId: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: string;
}

// Sinergia Wallet
export interface Wallet {
  id: string;
  userId: string;
  balance: number;
  currency: string;
  status: 'ACTIVE' | 'FROZEN';
  updatedAt: string;
}

export interface WalletTransaction {
  id: string;
  walletId: string;
  type: 'DEPOSIT' | 'WITHDRAW' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'FEE' | 'REFUND';
  amount: number;
  description: string;
  referenceId?: string;
  recipientEmail?: string;
  status: 'COMPLETED' | 'PENDING' | 'FAILED' | 'BLOCKED';
  createdAt: string;
}

// SaaS subscriptions & Plans
export type SaaSPlanCode = 'FREE' | 'PROFESSIONAL' | 'ENTERPRISE';

export interface SaaSPlan {
  code: SaaSPlanCode;
  name: string;
  price: number;
  features: string[];
  maxDuration: number; // minutes
  limitParticipants: number;
}

export interface Subscription {
  id: string;
  userId: string;
  planCode: SaaSPlanCode;
  status: 'ACTIVE' | 'CANCELED' | 'EXPIRED';
  billingPeriod: 'MONTHLY' | 'ANNUAL';
  startDate: string;
  endDate: string;
}

export interface PaymentInvoice {
  id: string;
  userId: string;
  amount: number;
  gateway: 'STRIPE' | 'PAYPAL' | 'MERCADOPAGO' | 'WOMPI' | 'WALLET';
  status: 'PAID' | 'PENDING' | 'FAILED';
  planCode: SaaSPlanCode;
  date: string;
}

// Audits & Logs
export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  ipAddress: string;
  userAgent: string;
  details: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  createdAt: string;
}

// AI Transcripts
export interface MeetingTranscript {
  id: string;
  meetingId: string;
  speechText: string;
  summary?: string;
  tasks?: string[];
  minutes?: string;
  createdAt: string;
}

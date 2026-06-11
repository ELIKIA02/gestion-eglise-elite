export type MemberStatus = 'Actif' | 'Inactif' | 'En observation';

export interface Member {
  id?: string;
  name: string;
  email: string;
  phone: string;
  status: MemberStatus;
  ministry: string;
  birthday?: string;
  address?: string;
  group?: string;
  createdAt: string;
}

export type TransactionType = 'Revenu' | 'Dépense';

export interface FinanceTransaction {
  id?: string;
  type: TransactionType;
  category: string; // e.g., Offrandes, Dîmes, Dons, Actions de grâce, Loyer, Électricité, Salaires, Autre
  amount: number;
  date: string; // YYYY-MM-DD
  contributor?: string; // Optional for offerings/donations
  notes?: string;
  createdAt: string;
}

export type EventType = 'Prédication' | 'École du dimanche' | 'Jeûne' | 'Séminaire' | 'Culte régulier' | 'Autre';

export interface ChurchEvent {
  id?: string;
  title: string;
  type: EventType;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  attendance: number;
  preacher: string;
  notes: string; // Sermon outline, scriptures
  observations: string; // e.g., sound system issue, great ambiance
  createdAt: string;
}

export interface CommunicationLog {
  id?: string;
  type: 'SMS' | 'WhatsApp';
  title: string;
  template: string;
  sentToGroup: string; // e.g., "Tous les membres", "Musiciens", "Actifs"
  sentAt: string;
  recipientCount: number;
  status: string; // e.g., "Envoyé", "Échec"
}

export interface Ministry {
  id?: string;
  name: string; // e.g. "Musiciens (Worship)", "Ushers (Accueil)", "Médias", "École du dimanche"
  leader: string;
  membersList: string; // Text summary of volunteers
  createdAt: string;
}

export interface BudgetForecast {
  category: string;
  projectedAmount: number;
  actualAmount: number;
}

export interface Department {
  id?: string;
  name: string;
  description: string;
  color: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  type: 'birthday' | 'event' | 'finance' | 'attendance' | 'system';
  title: string;
  message: string;
  date: string;
  read: boolean;
  createdAt: string;
}

export interface ChurchSettings {
  id?: string;
  appName: string;
  appLogo: string;
  churchPhone: string;
  worshipTypes: string;
  worshipDays: string;
  reportHeader: string;
  mistralApiKey?: string;
  cachetBase64?: string;
  theme?: 'light' | 'dark';
  notifications?: {
    birthdayReminder: boolean;
    eventReminder: boolean;
    lowBalanceAlert: boolean;
    attendanceAlert: boolean;
    reminderDays: number;
  };
  updatedAt: string;
}

export interface EnseignementDay {
  day: number;
  title: string;
  text: string;
}

export interface Enseignement {
  id?: string;
  title: string;
  theme: string;
  days: EnseignementDay[];
  type: 'single' | 'series';
  dayCount: number;
  createdAt: string;
  updatedAt: string;
  scheduledAt?: string;
  status: 'draft' | 'scheduled';
}

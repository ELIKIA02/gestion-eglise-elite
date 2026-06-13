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
  birthPlace?: string;
  nationality?: string;
  gender?: string;
  maritalStatus?: string;
  profession?: string;
  conversionDate?: string;
  formerChurch?: string;
  arrivalDate?: string;
  baptized?: string;
  baptismDate?: string;
  talents?: string;
  motivation?: string;
  spouseName?: string;
  childrenCount?: string;
  childrenAges?: string;
  emergencyPhone?: string;
  emergencyContact?: string;
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
  facebookToken?: string;
  cachetBase64?: string;
  theme?: 'light' | 'dark';
  notifications?: {
    birthdayReminder: boolean;
    eventReminder: boolean;
    lowBalanceAlert: boolean;
    attendanceAlert: boolean;
    reminderDays: number;
  };
  liturgicalSeasons?: string;
  liturgicalTypes?: string;
  updatedAt: string;
}

export interface EnseignementDay {
  day: number;
  title: string;
  text: string;
  imageUrl?: string;
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

export type UserRole = 'admin' | 'secretaire' | 'tresorier' | 'pasteur' | 'lecture';

export interface AppUser {
  id?: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  avatar?: string;
  createdAt: string;
  lastLogin?: string;
}

export interface LiturgicalTheme {
  id?: string;
  title: string;
  date: string;
  preacher: string;
  bibleText: string;
  description: string;
  themeType: string;
  season?: string;
  hymns?: string;
  scheduled?: boolean;
  createdAt: string;
}

export interface TitheRecord {
  id?: string;
  memberId: string;
  memberName: string;
  amount: number;
  date: string;
  type: 'Dîme' | 'Offrande' | 'Don';
  notes?: string;
  createdAt: string;
}

export interface PastoralVisit {
  id?: string;
  memberId: string;
  memberName: string;
  visitDate: string;
  visitType: 'Visite domicile' | 'Visite hôpital' | 'Visite prison' | 'Accompagnement' | 'Autre';
  purpose: string;
  report: string;
  prayerNeeds: string;
  pastoralNotes: string;
  visitedBy: string;
  createdAt: string;
}

export interface Poll {
  id?: string;
  question: string;
  options: PollOption[];
  status: 'draft' | 'sent' | 'closed';
  recipients: string[];
  createdAt: string;
  sentAt?: string;
}

export interface PollOption {
  id: string;
  label: string;
  votes: number;
}

export interface SacramentRegister {
  id?: string;
  type: 'Baptême' | 'Mariage' | 'Profession de foi' | 'Dédicace';
  memberName: string;
  memberId?: string;
  date: string;
  location: string;
  officiant: string;
  witnesses?: string;
  notes?: string;
  certificateNumber: string;
  createdAt: string;
}

export interface ServicePlanning {
  id?: string;
  date: string;
  serviceType: 'Culte du dimanche' | 'École du dimanche' | 'Étude biblique' | 'Jeûne' | 'Veillée' | 'Autre';
  preacher: string;
  theme: string;
  bibleText: string;
  worshipLead: string;
  choir: string;
  intercession: string;
  announcements: string;
  notes: string;
  createdAt: string;
}

export interface LibraryBook {
  id?: string;
  title: string;
  author: string;
  category: string;
  quantity: number;
  available: number;
  location: string;
  notes?: string;
  createdAt: string;
}

export interface BookLoan {
  id?: string;
  bookId: string;
  bookTitle: string;
  memberId: string;
  memberName: string;
  borrowDate: string;
  dueDate: string;
  returnDate?: string;
  status: 'en cours' | 'retourné' | 'retard';
  notes?: string;
  createdAt: string;
}

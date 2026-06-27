import type { Document, Types } from 'mongoose';

/** Section d'un element de la fiche vivante d'un projet. */
export type ChatProjectFicheSection = 'decision' | 'open' | 'deadline' | 'action' | 'info';

/** Un element de la fiche vivante (decision, point ouvert, echeance...). */
export interface IChatProjectFicheItem {
  /** Identifiant stable cote client pour l'edition. */
  id: string;
  section: ChatProjectFicheSection;
  text: string;
  /** Source de l'info (ex: "contrat.pdf p.3", "conversation du 12 juin"). */
  source?: string;
  /** 'proposed' = suggere par l'IA, en attente de validation ; 'validated' = confirme. */
  status: 'proposed' | 'validated';
  createdAt?: Date;
}

/** Fiche vivante : etat structure et evolutif d'un projet (dossier vivant). */
export interface IChatProjectFiche {
  summary?: string;
  items: IChatProjectFicheItem[];
  updatedAt?: Date | null;
}

export interface IChatProject {
  _id?: Types.ObjectId;
  name: string;
  description?: string;
  user: string;
  conversationCount: number;
  lastConversationAt?: Date | null;
  lastConversationId?: string | null;
  fiche?: IChatProjectFiche;
  fileIds?: string[];
  createdAt?: Date;
  updatedAt?: Date;
  tenantId?: string;
}

export interface IChatProjectDocument extends Omit<IChatProject, '_id'>, Document {}

import { Schema } from 'mongoose';
import type { IChatProjectDocument } from '~/types';

/** Element de la fiche vivante (decision, point ouvert, echeance, action...). */
const ficheItemSchema = new Schema(
  {
    id: { type: String, required: true },
    section: {
      type: String,
      enum: ['decision', 'open', 'deadline', 'action', 'info'],
      default: 'info',
    },
    text: { type: String, required: true, maxlength: 2000 },
    source: { type: String, default: '' },
    status: { type: String, enum: ['proposed', 'validated'], default: 'validated' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

/** Fiche vivante d'un projet (etat structure et evolutif). */
const ficheSchema = new Schema(
  {
    summary: { type: String, default: '', maxlength: 4000 },
    items: { type: [ficheItemSchema], default: [] },
    updatedAt: { type: Date, default: null },
  },
  { _id: false },
);

/** Un « point » sauvegarde : debrief horodate de l'etat du dossier. */
const briefSchema = new Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true, maxlength: 20000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

/** Un livrable range dans le dossier (contenu produit en discussion). */
const deliverableSchema = new Schema(
  {
    id: { type: String, required: true },
    title: { type: String, default: '', maxlength: 200 },
    content: { type: String, required: true, maxlength: 20000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

/** Un fil email suivi dans le dossier : pointeur vers une discussion, relue a la demande. */
const followedThreadSchema = new Schema(
  {
    id: { type: String, required: true },
    subject: { type: String, required: true, maxlength: 500 },
    from: { type: String, default: '', maxlength: 320 },
    messageId: { type: String, default: '', maxlength: 1000 },
    note: { type: String, default: '', maxlength: 1000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

/** Un evenement d'agenda rattache au dossier (recupere via le bouton « Verifier l'agenda »). */
const agendaEventSchema = new Schema(
  {
    id: { type: String, required: true },
    summary: { type: String, default: '', maxlength: 500 },
    start: { type: Date, default: null },
    end: { type: Date, default: null },
    location: { type: String, default: '', maxlength: 500 },
    calendar: { type: String, default: '', maxlength: 200 },
  },
  { _id: false },
);

const chatProjectSchema: Schema<IChatProjectDocument> = new Schema<IChatProjectDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1000,
    },
    user: {
      type: String,
      required: true,
      index: true,
    },
    conversationCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastConversationAt: {
      type: Date,
      default: null,
      index: true,
    },
    lastConversationId: {
      type: String,
      default: null,
    },
    fiche: {
      type: ficheSchema,
      default: () => ({ summary: '', items: [], updatedAt: null }),
    },
    /** Documents du projet (file_id), partages par toutes ses conversations (RAG). */
    fileIds: {
      type: [String],
      default: [],
    },
    /** Historique des « points » (debriefs horodates), le plus recent en premier. */
    briefs: {
      type: [briefSchema],
      default: [],
    },
    /** Livrables ranges dans le dossier (produits en discussion), le plus recent en premier. */
    deliverables: {
      type: [deliverableSchema],
      default: [],
    },
    /** Fils email suivis dans le dossier (pointeurs vers des discussions), le plus recent en premier. */
    followedThreads: {
      type: [followedThreadSchema],
      default: [],
    },
    /** Rendez-vous / echeances de l'agenda rattaches au dossier (bouton « Verifier l'agenda »). */
    agendaEvents: {
      type: [agendaEventSchema],
      default: [],
    },
    /** Date du dernier « Verifier l'agenda » sur ce dossier. */
    agendaCheckedAt: {
      type: Date,
      default: null,
    },
    /** Contexte permanent du dossier, injecte dans le prompt de toutes ses conversations. */
    instructions: {
      type: String,
      default: '',
      maxlength: 4000,
    },
    tenantId: {
      type: String,
      index: true,
    },
  },
  { timestamps: true },
);

chatProjectSchema.index({ user: 1, name: 1, _id: 1 });
chatProjectSchema.index({ user: 1, createdAt: -1, _id: -1 });
chatProjectSchema.index({ user: 1, lastConversationAt: -1, _id: -1 });

export default chatProjectSchema;

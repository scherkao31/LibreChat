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

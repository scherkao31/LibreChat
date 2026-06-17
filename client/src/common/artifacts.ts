export interface CodeBlock {
  id: string;
  language: string;
  content: string;
}

export interface Artifact {
  id: string;
  lastUpdateTime: number;
  index?: number;
  messageId?: string;
  identifier?: string;
  language?: string;
  content?: string;
  title?: string;
  type?: string;
  /**
   * Référence au fichier d'origine pour les artefacts « office » (DOCX /
   * tableur / présentation). Le panneau d'aperçu affiche du HTML généré
   * côté serveur, mais le bouton de téléchargement doit récupérer le
   * vrai fichier binaire (.xlsx/.docx/.pptx) via le même chemin
   * authentifié que la « puce » de pièce jointe (`useAttachmentLink`),
   * et NON pas `artifact.content` (le HTML d'aperçu). Renseigné par
   * `fileToArtifact` uniquement pour les buckets office.
   */
  fileId?: string;
  filepath?: string;
  fileSource?: string;
  fileUser?: string;
}

export type ArtifactFiles =
  | {
      'App.tsx': string;
      'index.tsx': string;
      '/components/ui/MermaidDiagram.tsx': string;
    }
  | Partial<{
      [x: string]: string | undefined;
    }>;

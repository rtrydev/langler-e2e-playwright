export type Language = "ja" | "my" | "pl";

export interface VocabEntry {
  id: string;
  headword: string;
  reading?: string;
  gloss: string[];
  level: string;
}

export interface GrammarTopic {
  id: string;
  name: string;
  level: string;
}

export interface ReadingQuestion {
  question: string;
  kind: "multiple_choice" | "short_answer";
  options?: string[];
  answer?: string;
  alternates?: string[];
}

export interface ClozeBlank {
  index: number;
  answer: string;
  alternates?: string[];
  hint?: string;
}

export type ExercisePayload = Record<string, unknown>;

export interface Exercise {
  exerciseId: string;
  type:
    | "reading"
    | "multiple_choice"
    | "cloze"
    | "matching"
    | "ordering"
    | "translation"
    | "writing_prompt"
    | "script_practice";
  prompt: string;
  points: number;
  referencedVocab?: string[];
  referencedGrammar?: string[];
  payload: ExercisePayload;
}

export interface LessonDoc {
  schemaVersion: "1.0";
  lessonId: string;
  language: Language;
  level: string;
  title: string;
  description?: string;
  topic?: string;
  tags?: string[];
  readingStage: "connected" | "foundational";
  sourceModel?: string;
  estimatedMinutes?: number;
  exercises: Exercise[];
}

export interface ImportResponse {
  lessonId: string;
  title: string;
  language: string;
  level: string;
  readingStage: string;
  exerciseCount: number;
  totalPoints: number;
  vocabRefCount: number;
  createdAt: string;
  created: boolean;
}

export interface LessonSummary {
  lessonId: string;
  language: string;
  level: string;
  title: string;
  exerciseCount: number;
  totalPoints: number;
}

export type TokenScope = "read-reference" | "import-lessons";

export interface AgentTokenDTO {
  id: string;
  label: string;
  scopes: TokenScope[];
  suffix: string;
  status: "active" | "revoked" | "expired";
}

export interface CreateTokenResponse {
  token: AgentTokenDTO;
  secret: string;
}

export interface GlossaryWord {
  itemId: string;
  headword: string;
  gloss: string[];
  lessonCount: number;
}

export interface GlossaryLanguage {
  language: string;
  words: GlossaryWord[];
}

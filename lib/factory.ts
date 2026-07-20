import type { LanglerApi } from "./api";
import { newLessonId, runTag } from "./run";
import type { Exercise, Language, LessonDoc, VocabEntry } from "./types";

const JA_LEVEL = "N5";
const PL_LEVEL = "A1";
const MY_LEVEL = "A1";

function base(
  language: Language,
  level: string,
  readingStage: LessonDoc["readingStage"],
  exercises: Exercise[],
  extra: Partial<LessonDoc> = {},
): LessonDoc {
  return {
    schemaVersion: "1.0",
    lessonId: newLessonId(),
    language,
    level,
    title: runTag("lesson"),
    readingStage,
    sourceModel: "langler-e2e",
    exercises,
    ...extra,
  };
}

function clip(text: string, max = 100): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export interface GlossarySeed {
  doc: LessonDoc;
  vocab: VocabEntry[];
}

export class LessonFactory {
  constructor(private readonly api: LanglerApi) {}

  private async pick(lang: Language, level: string, count: number): Promise<VocabEntry[]> {
    const items = (await this.api.vocab(lang, { level, limit: 40 })).filter(
      (entry) => entry.headword && entry.gloss.length > 0,
    );
    if (items.length < count) {
      throw new Error(`Reference API returned only ${items.length} usable ${lang} ${level} vocab items.`);
    }
    return items.slice(0, count);
  }

  async japaneseAutoGraded(): Promise<LessonDoc> {
    const v = await this.pick("ja", JA_LEVEL, 6);
    const story: Exercise = {
      exerciseId: "reading-1",
      type: "reading",
      prompt: "Read the short story and answer.",
      points: 4,
      payload: {
        genre: "short_story",
        title: "みじかい はなし",
        passage: `きょうは${v[0].headword}と${v[1].headword}を べんきょうしました。とても たのしかったです。`,
        questions: [
          {
            question: "なにを べんきょうしましたか。",
            kind: "multiple_choice",
            options: [v[0].headword, v[2].headword],
            answer: v[0].headword,
          },
        ],
      },
    };
    const mc: Exercise = {
      exerciseId: "mc-1",
      type: "multiple_choice",
      prompt: "Choose the word that matches the clue.",
      points: 2,
      referencedVocab: [v[0].id],
      payload: {
        questions: [
          {
            question: `「${v[0].gloss[0]}」は どれですか。`,
            options: [v[0].headword, v[3].headword, v[4].headword],
            answer: v[0].headword,
          },
        ],
      },
    };
    const clozeBank: Exercise = {
      exerciseId: "cloze-bank-1",
      type: "cloze",
      prompt: "Fill each blank from the word bank.",
      points: 2,
      referencedVocab: [v[1].id],
      payload: {
        text: `わたしは{{1}}と{{2}}が すきです。`,
        blanks: [
          { index: 1, answer: v[1].headword },
          { index: 2, answer: v[2].headword },
        ],
        wordBank: [v[1].headword, v[2].headword, v[3].headword],
      },
    };
    const clozeTyped: Exercise = {
      exerciseId: "cloze-typed-1",
      type: "cloze",
      prompt: "Fill each blank.",
      points: 2,
      referencedVocab: [v[2].id],
      payload: {
        text: `これは{{1}}です。`,
        blanks: [{ index: 1, answer: v[2].headword, hint: clip(v[2].gloss[0]) }],
      },
    };
    const matching: Exercise = {
      exerciseId: "matching-1",
      type: "matching",
      prompt: "Match each word with its meaning.",
      points: 3,
      referencedVocab: [v[3].id, v[4].id],
      payload: {
        pairs: [
          { left: v[3].headword, right: clip(v[3].gloss[0]) },
          { left: v[4].headword, right: clip(v[4].gloss[0]) },
          { left: v[5].headword, right: clip(v[5].gloss[0]) },
        ],
      },
    };
    const ordering: Exercise = {
      exerciseId: "ordering-1",
      type: "ordering",
      prompt: "Arrange the parts into the correct order.",
      points: 3,
      payload: {
        items: [v[0].headword, "は", v[1].headword, "です"],
        translation: "It is a sentence.",
      },
    };
    return base("ja", JA_LEVEL, "connected", [
      story,
      mc,
      clozeBank,
      clozeTyped,
      matching,
      ordering,
    ]);
  }

  async japaneseReading(): Promise<LessonDoc> {
    const v = await this.pick("ja", JA_LEVEL, 3);
    const reading: Exercise = {
      exerciseId: "reading-1",
      type: "reading",
      prompt: "Read the story and answer.",
      points: 4,
      payload: {
        genre: "short_story",
        title: "わたしの いちにち",
        passage: `${v[0].headword}へ 行きました。そこで ${v[1].headword}を 見ました。`,
        annotations: v.slice(0, 2).map((entry) => ({
          surface: entry.headword,
          reading: entry.reading ?? entry.headword,
          gloss: clip(entry.gloss[0]),
        })),
        questions: [
          {
            question: "どこへ 行きましたか。",
            kind: "multiple_choice",
            options: [v[0].headword, v[2].headword],
            answer: v[0].headword,
          },
        ],
      },
    };
    return base("ja", JA_LEVEL, "connected", [reading]);
  }

  async japaneseSelfAssessed(): Promise<LessonDoc> {
    const v = await this.pick("ja", JA_LEVEL, 3);
    const translation: Exercise = {
      exerciseId: "translation-1",
      type: "translation",
      prompt: "Translate the sentence into English.",
      points: 3,
      payload: {
        source: `わたしは まいにち ${v[0].headword}を 見ます。`,
        reference: `I look at the ${v[0].gloss[0]} every day.`,
      },
    };
    const writing: Exercise = {
      exerciseId: "writing-1",
      type: "writing_prompt",
      prompt: "じぶんの いちにちについて 三つの ぶんで 書いてください。",
      points: 3,
      payload: {
        guidance: "Use particles は and を.",
        modelAnswer: `きょうは ${v[1].headword}を べんきょうしました。`,
      },
    };
    const script: Exercise = {
      exerciseId: "script-1",
      type: "script_practice",
      prompt: "Trace the model, then write it yourself.",
      points: 2,
      payload: {
        items: v.slice(0, 2).map((entry) => ({
          glyph: entry.headword,
          reading: entry.reading ?? entry.headword,
          meaning: clip(entry.gloss[0]),
        })),
      },
    };
    return base("ja", JA_LEVEL, "foundational", [translation, writing, script]);
  }

  async polishOrthography(): Promise<LessonDoc> {
    const v = await this.pick("pl", PL_LEVEL, 3);
    const orthography: Exercise = {
      exerciseId: "orthography-1",
      type: "script_practice",
      prompt: "Choose or type the correct Polish spelling.",
      points: 3,
      payload: {
        items: [
          {
            kind: "choice",
            meaning: clip(v[0].gloss[0]),
            options: [v[0].headword, `${v[0].headword}a`],
            answer: v[0].headword,
          },
          {
            kind: "dictation",
            meaning: clip(v[1].gloss[0]),
            answer: v[1].headword,
          },
        ],
      },
    };
    return base("pl", PL_LEVEL, "foundational", [orthography]);
  }

  async burmeseFoundational(): Promise<LessonDoc> {
    const v = await this.pick("my", MY_LEVEL, 3);
    const script: Exercise = {
      exerciseId: "script-1",
      type: "script_practice",
      prompt: "Practise writing each syllable.",
      points: 2,
      payload: {
        items: v.slice(0, 2).map((entry) => ({
          glyph: entry.headword,
          reading: entry.reading ?? entry.headword,
          meaning: clip(entry.gloss[0]),
        })),
      },
    };
    const matching: Exercise = {
      exerciseId: "matching-1",
      type: "matching",
      prompt: "Match each word with its meaning.",
      points: 2,
      referencedVocab: [v[0].id, v[1].id],
      payload: {
        pairs: [
          { left: v[0].headword, right: clip(v[0].gloss[0]) },
          { left: v[1].headword, right: clip(v[1].gloss[0]) },
        ],
      },
    };
    return base("my", MY_LEVEL, "foundational", [script, matching]);
  }

  // `slot` selects a disjoint window of vocab (past the first ids the other
  // specs reference), so glossary refcount assertions are isolated from every
  // other spec and from the sibling glossary test running in parallel.
  async glossaryLesson(slot = 0): Promise<GlossarySeed> {
    const all = (await this.api.vocab("ja", { level: JA_LEVEL, limit: 60 })).filter(
      (entry) => entry.headword && entry.gloss.length > 0,
    );
    const offset = 8 + slot * 12;
    const v = all.slice(offset, offset + 3);
    if (v.length < 3) {
      throw new Error(`Reference API returned too few usable ja ${JA_LEVEL} vocab items for slot ${slot}.`);
    }
    const cloze: Exercise = {
      exerciseId: "cloze-1",
      type: "cloze",
      prompt: "Fill each blank.",
      points: 2,
      referencedVocab: v.map((entry) => entry.id),
      payload: {
        text: `これは{{1}}です。`,
        blanks: [{ index: 1, answer: v[0].headword }],
      },
    };
    return { doc: base("ja", JA_LEVEL, "foundational", [cloze]), vocab: v };
  }
}

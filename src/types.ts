export type Block = {
    type: 'text';
    text: string;
    page: number;
    bbox: number[];
} | {
    type: 'image';
    src: string;
    page: number;
    bbox: number[];
    width: number;
    height: number;
};
export type Content = {
    id: string;
    text: string;
    sha256: string;
    blocks: Block[];
};
export type Answer = Content & {
    number: number;
    correct: boolean;
};
export type Question = Content & {
    chapterId: number;
    number: number;
    pages: number[];
    answers: Answer[];
};
export type Bank = {
    meta: {
        sha256: string;
        pageCount: number;
        questionCount: number;
        imageCount: number;
        reviewStatus: string;
        version: number;
    };
    chapters: {
        id: number;
        title: string;
        count: number;
        page: number;
    }[];
    questions: Question[];
};
export type Annotation = {
    sha256: string;
    ranges: {
        start: number;
        end: number;
        text: string;
    }[];
    status: 'suggested' | 'reviewed';
};
export type KeywordSource = 'algorithm' | 'semantic';
export type SemanticKeywords = {
    version: number;
    sourceSha256: string;
    method: 'authored-contrastive-analysis';
    reviewedQuestionIds: string[];
    annotations: Record<string, Annotation>;
    notes: Record<string, string>;
};
export type Session = {
    version: string;
    mode: string;
    ids: string[];
    index: number;
    responses: Record<string, string[]>;
    finished: boolean;
    chapter: number;
    shuffle: boolean;
};

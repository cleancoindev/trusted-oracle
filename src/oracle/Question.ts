import TEMPLATE_CONFIG from '@realitio/realitio-contracts/config/templates.json';
import BigNumber from 'bn.js';
import { isAfter, isBefore } from 'date-fns';

import { QuestionUtils } from './QuestionUtils';

export const INITIAL_BLOCKS = {
  1: 6531147,
  3: 0,
  4: 3175028, // for quicker loading start more like 4800000,
  42: 10350865,
  1337: 0,
} as const;

export interface QuestionTemplates {
  0: string;
  1: string;
  2: string;
  3: string;
  4: string;
}

const getTemplates = (): QuestionTemplates => {
  return TEMPLATE_CONFIG.content;
};

export interface QuestionJson {
  title: string;
  type: string;
  category: string;
  lang: string;
}

export interface NewQuestionEventArgs {
  arbitrator: string;
  content_hash: string;
  created: BigNumber;
  nonce: BigNumber;
  opening_ts: BigNumber;
  question: string;
  question_id: string;
  template_id: BigNumber;
  timeout: BigNumber;
  user: string;
}

export interface NewQuestionEvent {
  args: NewQuestionEventArgs;
  address: string;
  blockHash: string;
  blockNumber: number;
  event: string;
  id: string;
  logIndex: number;
  raw: any;
  removed: false;
  returnValues: any;
  signature: string;
  transactionHash: string;
  transactionIndex: number;
}

export interface QuestionFromContract {
  content_hash: string;
  opening_ts: BigNumber;
  timeout: BigNumber;
  finalize_ts: BigNumber;
  is_pending_arbitration: boolean;
  bounty: BigNumber;
  best_answer: string;
  history_hash: string;
  bond: BigNumber;
}

export type TemplateId = 0 | 1 | 2 | 3 | 4;
export interface QuestionFromNewQuestionEvent {
  id: string;
  arbitrator: string;
  nonce: BigNumber;
  createdAtDate: Date;
  createdAtBlock: number;
  createdBy: string;
  contentHash: string;
  questionTitle: string;
  templateId: TemplateId;
  openingDate: Date;
}

type Unanswered = 'UNANSWERED';

/**
 * Question with basic information for display in a list of question
 */

/**
 * Question with all the necessary information to display in QuestionDetails
 */
export interface Question extends QuestionFromNewQuestionEvent {
  timeout: Date;
  finalizedAtDate: Date | Unanswered;
  isPendingArbitration: boolean;
  bounty: BigNumber;
  bestAnswer: string;
  historyHash: string;
  bond: BigNumber;
  category: string | null;
  language: string | null;
  type: string;
  state: QuestionState;
}

export enum QuestionState {
  NOT_OPEN = 'NOT_OPEN',
  OPEN = 'OPEN',
  FINALIZED = 'FINALIZED',
}

export enum QuestionType {
  //  A simple yes or no answer. Note that this has no value for “null” or “undecided”. If you want to be able to report these options, you may prefer a multi-choice question.
  BINARY = 'BINARY',
  // A positive (unsigned) number. By default questions allow up to 13 decimals.
  NUMBER = 'NUMBER',
  // One answer can be selected from a list. The answer form will display this as a select box.
  SINGLE_CHOICE = 'SINGLE_CHOICE',
  // Multiple answers can be selected from a list. The answer form will display this as a group of checkboxes.
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  // A date or date and time. The answer form will display this as a date picker.
  DATE_TIME = 'DATE_TIME',
}

export const toDate = (bigNumber: BigNumber) => {
  return new Date(bigNumber.toNumber() * 1000);
};

export const transformNewQuestionEventToQuestion = (
  event: NewQuestionEvent,
): QuestionFromNewQuestionEvent => {
  const { args, blockNumber } = event;

  return {
    id: args.question_id,
    arbitrator: args.arbitrator,
    nonce: args.nonce,
    createdAtDate: toDate(args.created),
    createdAtBlock: blockNumber,
    createdBy: args.user,
    contentHash: args.content_hash,
    questionTitle: args.question,
    templateId: args.template_id.toNumber() as TemplateId,
    openingDate: toDate(args.opening_ts),
  };
};

const isAnswered = (question: QuestionFromContract) => {
  const finalizedAtDate = question.finalize_ts.toNumber();
  return finalizedAtDate > 1;
};

export const isOpen = (question: QuestionFromContract) => {
  const now = new Date();

  const isPastOpeningDate = isAfter(now, toDate(question.opening_ts));
  const isBeforeFinalizedDate =
    !isAnswered(question) || isBefore(now, toDate(question.finalize_ts));

  return (
    isPastOpeningDate &&
    isBeforeFinalizedDate &&
    !question.is_pending_arbitration
  );
};

export const isFinalized = (question: QuestionFromContract) => {
  if (question.is_pending_arbitration) return false;
  if (!isAnswered(question)) return false;

  return isAfter(new Date(), toDate(question.finalize_ts));
};

const getQuestionState = (question: QuestionFromContract): QuestionState => {
  if (isFinalized(question)) return QuestionState.FINALIZED;
  if (isOpen(question)) return QuestionState.OPEN;

  return QuestionState.NOT_OPEN;
};

export const toQuestion = (
  questionFromNewQuestionEvent: QuestionFromNewQuestionEvent,
  questionFromContract: QuestionFromContract,
): Question => {
  const questionJson = QuestionUtils.populatedJSONForTemplate(
    getTemplates()[questionFromNewQuestionEvent.templateId],
    questionFromNewQuestionEvent.questionTitle,
  ) as QuestionJson;

  return {
    ...questionFromNewQuestionEvent,
    questionTitle: questionJson.title,
    timeout: toDate(questionFromContract.timeout),
    finalizedAtDate: isAnswered(questionFromContract)
      ? toDate(questionFromContract.finalize_ts)
      : 'UNANSWERED',
    isPendingArbitration: questionFromContract.is_pending_arbitration,
    bounty: questionFromContract.bounty,
    bestAnswer: questionFromContract.best_answer,
    historyHash: questionFromContract.history_hash,
    bond: questionFromContract.bond,
    type: questionJson.type,
    language: questionJson.lang === 'undefined' ? null : questionJson.lang,
    category:
      questionJson.category === 'undefined' ? null : questionJson.category,
    state: getQuestionState(questionFromContract),
  };
};

export interface NewAnswerEventArgs {
  answer: string;
  bond: BigNumber;
  history_hash: string;
  is_commitment: boolean;
  question_id: string;
  ts: BigNumber;
  user: string;
}

export interface NewAnswerEvent {
  args: NewAnswerEventArgs;
}

export interface Answer {
  answer: string;
  bond: BigNumber;
  historyHash: string;
  isCommitment: boolean;
  questionId: string;
  createdAtDate: Date;
  user: string;
}

export const toAnswer = (events: NewAnswerEvent[]): Answer[] => {
  return events.map(e => ({
    answer: e.args.answer,
    bond: e.args.bond,
    historyHash: e.args.history_hash,
    isCommitment: e.args.is_commitment,
    questionId: e.args.question_id,
    createdAtDate: toDate(e.args.ts),
    user: e.args.user,
  }));
};

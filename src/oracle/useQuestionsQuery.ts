import React from 'react';
import { useAsync } from 'react-use';

import { useFetchBlock } from '../ethereum/useBlockQuery';
import { useWeb3 } from '../ethereum/Web3Provider';
import { NewQuestionEvent, OracleEventType } from './OracleData';
import { useOracle } from './OracleProvider';
import { INITIAL_BLOCKS, Question } from './Question';
import { useFetchQuestionQuery } from './useQuestionQuery';

interface State {
  questions: Question[];
  toBlock: number;
  incrementIndex: number;
  loading: boolean;
}

const initialState: State = {
  questions: [],
  toBlock: 0,
  incrementIndex: 0,
  loading: true,
};

const BLOCK_INCREMENTS = [100, 2500, 5000];

interface Action {
  type: 'update';
  payload: Partial<State>;
}

const reducer = (state: State, action: Action) => {
  switch (action.type) {
    case 'update':
      return { ...state, ...action.payload };
    default:
      throw new Error();
  }
};

export const useQuestionsQuery = () => {
  const { networkId } = useWeb3();
  const { realitio } = useOracle();
  const fetchQuestion = useFetchQuestionQuery();
  const initialBlock = INITIAL_BLOCKS[networkId];
  const [state, dispatch] = React.useReducer(reducer, initialState);
  const fetchBlock = useFetchBlock();

  useAsync(async () => {
    const { toBlock } = state;
    const latestBlock = await fetchBlock('latest');
    if (!toBlock) {
      dispatch({ type: 'update', payload: { toBlock: latestBlock.number } });
    }
  }, [fetchBlock, state]);

  React.useEffect(() => {
    const { incrementIndex, questions, toBlock } = state;

    if (!realitio && toBlock) return;

    const fetchQuestions = async () => {
      const numberOfBlocksToFetch =
        incrementIndex < BLOCK_INCREMENTS.length
          ? BLOCK_INCREMENTS[incrementIndex]
          : BLOCK_INCREMENTS[BLOCK_INCREMENTS.length - 1];

      let fromBlock = toBlock - numberOfBlocksToFetch;
      if (fromBlock < initialBlock) fromBlock = initialBlock;

      if (toBlock <= initialBlock) {
        dispatch({ type: 'update', payload: { loading: false } });
        return;
      }

      const newQuestionsEvents = (await realitio.getPastEvents(
        OracleEventType.LogNewQuestion,
        { fromBlock, toBlock },
      )) as NewQuestionEvent[];

      const questionsFromEvents = await Promise.all(
        newQuestionsEvents.map(async event =>
          fetchQuestion(event.args.question_id),
        ),
      );

      const newQuestions = questionsFromEvents.filter(Boolean) as Question[];

      dispatch({
        type: 'update',
        payload: {
          toBlock: fromBlock - 1,
          incrementIndex: incrementIndex + 1,
          questions: questions.concat(newQuestions),
        },
      });
    };

    fetchQuestions();
  }, [state, realitio, fetchQuestion, initialBlock]);

  return {
    questions: state.questions,
    loading: state.loading,
  };
};

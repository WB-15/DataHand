import { ExplorationInfo } from '@data-at-hand/core/exploration/ExplorationInfo';
import { ActionTypeBase, ReduxAppState } from '@state/types';
import {
  ExplorationDataActionType,
  StartLoadingData,
  FinishLoadingData,
} from './actions';
import { Dispatch } from 'redux';
import uuid from 'uuid';
import { explorationDataResolver } from '@core/exploration/data/ExplorationDataResolver';

export interface ExplorationDataState {
  info?: ExplorationInfo;
  serviceKey?: string;
  isBusy: boolean;
  error?: any;
  data?: any;
  ongoingTaskId?: string;
}

const INITIAL_STATE = {
  isBusy: false,
} as ExplorationDataState;

export const explorationDataStateReducer = (
  state: ExplorationDataState = INITIAL_STATE,
  action: ActionTypeBase,
): ExplorationDataState => {
  const newState: ExplorationDataState = {
    ...state
  }


  switch (action.type) {
    case ExplorationDataActionType.StartLoadingDataAction:
      const startAction = action as StartLoadingData;
      newState.isBusy = true;
      newState.ongoingTaskId = startAction.taskId;
      newState.serviceKey = startAction.serviceKey
      return newState;
    case ExplorationDataActionType.FinishLoadingDataAction:
      const finishAction = action as FinishLoadingData;
      newState.isBusy = false;
      newState.ongoingTaskId = undefined;
      newState.info = finishAction.info;
        
      if (finishAction.error) {
        newState.error = finishAction.error;
      } else {
        newState.data = finishAction.data;
      }

      return newState;
    default:
      return state;
  }
};

export function startLoadingForInfo(info?: ExplorationInfo, force?: boolean) {
  return async (dispatch: Dispatch, getState: () => ReduxAppState) => {
    const taskId = uuid.v4();
    //set to loading status

    var currentAppState = getState();
    const explorationInfo = info || currentAppState.explorationState.info

    dispatch({
      type: ExplorationDataActionType.StartLoadingDataAction,
      taskId: taskId,
      serviceKey: currentAppState.settingsState.serviceKey
    } as StartLoadingData);

    console.log('Start data load');

    //start actual data loading async
    try {
      //Process

      console.log('Process data load');

      const data = await explorationDataResolver.loadData(
        explorationInfo,
        currentAppState.settingsState.serviceKey,
        currentAppState.explorationDataState.info,
        force !==true ? currentAppState.explorationDataState.serviceKey : undefined,
        force !==true ? currentAppState.explorationDataState.data : undefined,
      );

      currentAppState = getState();
      if (taskId === currentAppState.explorationDataState.ongoingTaskId) {
        console.log('Completed data load');
        dispatch({
          type: ExplorationDataActionType.FinishLoadingDataAction,
          info: explorationInfo,
          data: data,
        } as FinishLoadingData);
      }
    } catch (err) {
      console.error("error in data loading task.", err)
      //console.error('Error in data loading task: ', taskId, err, JSON.stringify(err));
      const currentAppState = getState();
      if (taskId === currentAppState.explorationDataState.ongoingTaskId) {
        dispatch({
          type: ExplorationDataActionType.FinishLoadingDataAction,
          error: err,
          data: null,
        } as FinishLoadingData);
      }
    }
  };
}
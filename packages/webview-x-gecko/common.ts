import { EventData } from '@nativescript/core';

export const LOAD_STARTED_EVENT = 'loadStarted';
export const LOAD_FINISHED_EVENT = 'loadFinished';
export const LOAD_PROGRESS_EVENT = 'loadProgress';
export const TITLE_CHANGED_EVENT = 'titleChanged';

export interface LoadStartedEventData extends EventData {
  eventName: typeof LOAD_STARTED_EVENT;
  url: string;
}

export interface LoadFinishedEventData extends EventData {
  eventName: typeof LOAD_FINISHED_EVENT;
  url: string;
  error?: string;
}

export interface LoadProgressEventData extends EventData {
  eventName: typeof LOAD_PROGRESS_EVENT;
  url: string;
  progress: number;
}

export interface TitleChangedEventData extends EventData {
  eventName: typeof TITLE_CHANGED_EVENT;
  url: string;
  title: string;
}

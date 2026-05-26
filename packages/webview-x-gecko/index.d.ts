import { View } from '@nativescript/core';
import { Property } from '@nativescript/core';

export declare const srcProperty: Property<WebViewX, string>;
export declare const debugModeProperty: Property<WebViewX, boolean>;
export declare const supportPopupsProperty: Property<WebViewX, boolean>;
export declare const autoInjectJSBridgeProperty: Property<WebViewX, boolean>;

export * from './common';
import { LoadStartedEventData, LoadFinishedEventData, LoadProgressEventData, TitleChangedEventData } from './common';

export declare class WebViewX extends View {
  static readonly popupNavigateEvent: string;
  static readonly loadStartedEvent: string;
  static readonly loadFinishedEvent: string;
  static readonly loadProgressEvent: string;
  static readonly titleChangedEvent: string;

  src: string;
  debugMode: boolean;
  supportPopups: boolean;
  userAgent: string;
  autoInjectJSBridge: boolean;

  on(event: 'loadStarted', callback: (args: LoadStartedEventData) => void, thisArg?: any): void;
  on(event: 'loadFinished', callback: (args: LoadFinishedEventData) => void, thisArg?: any): void;
  on(event: 'loadProgress', callback: (args: LoadProgressEventData) => void, thisArg?: any): void;
  on(event: 'titleChanged', callback: (args: TitleChangedEventData) => void, thisArg?: any): void;
  on(event: string, callback: (args: any) => void, thisArg?: any): void;

  /** Returns the current page title (last value received from the engine). */
  getTitle(): Promise<string | undefined>;

  /** Execute JavaScript in the current page's context and return the result. */
  executeJavaScript<T = any>(code: string): Promise<T>;

  /** Emit an event into the page's nsWebViewBridge. */
  emitToWebView(eventName: string, data: any): void;

  /** Called when the page's nsWebViewBridge.emit() fires. Dispatches a NativeScript event. */
  onWebViewEvent(eventName: string, data: any): void;
}

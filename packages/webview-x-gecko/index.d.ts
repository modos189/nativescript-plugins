import { View } from '@nativescript/core';
import { Property } from '@nativescript/core';

export declare const srcProperty: Property<WebViewX, string>;
export declare const debugModeProperty: Property<WebViewX, boolean>;
export declare const supportPopupsProperty: Property<WebViewX, boolean>;

export declare class WebViewX extends View {
  static userAgentTransform: ((defaultUA: string | null) => string | null) | null;
  static readonly popupNavigateEvent: string;
  src: string;
  debugMode: boolean;
  supportPopups: boolean;
  getUserAgentOverride(): string | null;
  setUserAgentOverride(ua: string | null): void;
}

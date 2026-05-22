import { View } from '@nativescript/core';
import { Property } from '@nativescript/core';

export declare const srcProperty: Property<WebViewX, string>;
export declare const debugModeProperty: Property<WebViewX, boolean>;

export declare class WebViewX extends View {
  src: string;
  debugMode: boolean;
}

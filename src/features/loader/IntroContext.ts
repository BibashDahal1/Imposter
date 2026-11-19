import { createContext } from "react";

/**
 * true once the company and game loaders are gone.
 * Screens use it to start their entrance animations at the right moment.
 * Defaults to true, so screens still work without the provider.
 */
export const IntroContext = createContext(true);

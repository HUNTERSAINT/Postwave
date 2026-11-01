import { createContext, useContext } from "react";
export const LaunchContext = createContext(false);
/** true once the launch animation has finished */
export const useLaunched = () => useContext(LaunchContext);

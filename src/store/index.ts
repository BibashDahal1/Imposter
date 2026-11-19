import { configureStore } from "@reduxjs/toolkit";
import {
  useDispatch,
  useSelector,
  type TypedUseSelectorHook,
} from "react-redux";

import gameReducer from "./gameSlice";
import { roomSyncMiddleware } from "./roomSyncMiddleware";
import setupReducer from "./setupSlice";

export const store = configureStore({
  reducer: { setup: setupReducer, game: gameReducer },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(roomSyncMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

import { createContext, useContext } from "react";
import type { IndustryGeometryEntitySource } from "../draftPanel.ts";

const EMPTY: readonly IndustryGeometryEntitySource[] = [];
export const QsMeasuredGeometryContext = createContext(EMPTY);
export const useQsMeasuredGeometry = () => useContext(QsMeasuredGeometryContext);

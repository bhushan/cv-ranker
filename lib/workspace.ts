import "server-only";
import { cache } from "react";
import { getDashboard } from "./candidates/service";
/** One authorized workspace read per request, shared by the layout and the page. */
export const getWorkspace = cache(getDashboard);

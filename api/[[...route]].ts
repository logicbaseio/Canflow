import { handle } from "hono/vercel";
import app from "../src/server/app";

// Runs the Hono app as a Vercel Edge Function. All /api/* requests route here.
export const config = { runtime: "edge" };

export default handle(app);

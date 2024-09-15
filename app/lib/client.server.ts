import {
  type NodeSavedState,
  type NodeSavedSession,
  NodeOAuthClient,
} from "@atproto/oauth-client-node";
import { peekJson } from "@atproto-labs/fetch";
import { db } from "./storage.server";
import { state, session } from "~/db/schema";
import { eq } from "drizzle-orm";

const PUBLIC_URL = process.env.PUBLIC_URL || "http://127.0.0.1:5173";

export class SimpleStoreMemory<K extends string, V extends string> {
  cache: Map<K, V>;

  constructor() {
    this.cache = new Map<K, V>();
  }

  get(key: K): V | undefined {
    console.log("Getting nonce state", key);
    return this.cache.get(key);
  }

  set(key: K, value: V): void {
    console.log("Setting nonce state", key);
    console.trace();
    this.cache.set(key, value);
  }

  del(key: K): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

export const nonceStore = new SimpleStoreMemory<string, string>();

export const client = new NodeOAuthClient({
  clientMetadata: {
    client_name: "Sky Tools",
    client_id: process.env.PUBLIC_URL
      ? `${PUBLIC_URL}/client-metadata.json`
      : `http://localhost?redirect_uri=${encodeURIComponent(
          `${PUBLIC_URL}/oauth/callback`
        )}`,
    client_uri: PUBLIC_URL,
    redirect_uris: [`${PUBLIC_URL}/oauth/callback`],
    scope: "atproto transition:generic",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    application_type: "web",
    token_endpoint_auth_method: "none",
    dpop_bound_access_tokens: true,
  },
  stateStore: {
    async set(key: string, internalState: NodeSavedState): Promise<void> {
      console.log("Setting state", key);
      await db
        .insert(state)
        .values({ key, state: internalState })
        .onConflictDoUpdate({
          target: state.key,
          set: { state: internalState },
        })
        .execute();
    },
    async get(key: string): Promise<NodeSavedState | undefined> {
      console.log("Getting state", key);
      console.log(db);
      const result = await db.query.state.findFirst({
        where: eq(state.key, key),
      });
      return result?.state as NodeSavedState | undefined;
    },

    async del(key: string): Promise<void> {
      console.log("Deleting state", key);
      await db.delete(state).where(eq(state.key, key)).execute();
    },
  },

  dpopNonceCache: nonceStore,

  // Interface to store authenticated session data
  sessionStore: {
    async set(sub: string, _session: NodeSavedSession): Promise<void> {
      console.log("Setting session", sub);
      await db
        .insert(session)
        .values({ key: sub, session: _session })
        .onConflictDoUpdate({
          target: session.key,
          set: { session: _session },
        })
        .execute();
    },
    async get(sub: string): Promise<NodeSavedSession | undefined> {
      console.log("Getting session", sub);
      const result = await db.query.session.findFirst({
        where: eq(session.key, sub),
      });
      return result?.session as NodeSavedSession | undefined;
    },
    async del(sub: string): Promise<void> {
      console.log("Deleting session", sub);
      await db.delete(session).where(eq(session.key, sub)).execute();
    },
  },
  fetch: (...args: Parameters<typeof fetch>) => {
    console.log("Fetching", args);
    // @ts-expect-error
    console.log("Fetching headers", args[0].headers);
    return fetch(...args)
      .then(async (res) => {
        console.log("Response", res);

        if (res.status === 400) {
          try {
            const json = await peekJson(res, 10 * 1024);
            console.log("Peeked JSON", json);
            return res;
          } catch (e) {
            console.error(e);
            return res;
          }
        }

        return res;
      })
      .catch((error) => {
        if ("response" in error) {
          console.log("Error response", error.response);
        }
        throw error;
      });
  },
});

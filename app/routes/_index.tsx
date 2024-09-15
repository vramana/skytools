import { isValidHandle } from "@atproto/syntax";
import {
  NodeOAuthClient,
  type AuthorizeOptions,
} from "@atproto/oauth-client-node";
import {
  type LoaderFunction,
  type MetaFunction,
  type ActionFunction,
  redirect,
  json,
} from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { client } from "~/lib/client.server";
import { db } from "~/lib/storage.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Sky Tools" },
    {
      name: "description",
      content: "Sky Tools is a set of tools for the Bluesky network.",
    },
  ];
};

async function authorize(
  client: NodeOAuthClient,
  input: string,
  options?: AuthorizeOptions
): Promise<URL> {
  const redirectUri =
    options?.redirect_uri ?? client.clientMetadata.redirect_uris[0];
  if (!client.clientMetadata.redirect_uris.includes(redirectUri)) {
    // The server will enforce client, but let's catch it early
    throw new TypeError("Invalid redirect_uri");
  }

  const { identity, metadata } = await client.oauthResolver.resolve(
    input,
    options
  );

  console.log({ identity, metadata });

  const pkce = await client.runtime.generatePKCE();
  const dpopKey = await client.runtime.generateKey(
    metadata.dpop_signing_alg_values_supported || []
  );

  const state = await client.runtime.generateNonce();

  console.log({ pkce, dpopKey, state });

  await client.stateStore.set(state, {
    iss: metadata.issuer,
    dpopKey,
    verifier: pkce.verifier,
    appState: options?.state,
  });

  const parameters = {
    client_id: client.clientMetadata.client_id,
    redirect_uri: redirectUri,
    code_challenge: pkce.challenge,
    code_challenge_method: pkce.method,
    state,
    login_hint: identity
      ? input // If input is a handle or a DID, use it as a login_hint
      : undefined,
    response_mode: client.responseMode,
    response_type:
      // Negotiate by using the order in the client metadata
      client.clientMetadata.response_types?.find((t) =>
        metadata["response_types_supported"]?.includes(t)
      ) ?? "code",

    display: options?.display,
    prompt: options?.prompt,
    scope: options?.scope || undefined,
    ui_locales: options?.ui_locales,
  };

  console.log({ parameters });

  if (metadata.pushed_authorization_request_endpoint) {
    const server = await client.serverFactory.fromMetadata(metadata, dpopKey);
    console.log({ server });
    const parResponse = await server.request(
      "pushed_authorization_request",
      parameters
    );

    console.log({ parResponse });

    const authorizationUrl = new URL(metadata.authorization_endpoint);
    authorizationUrl.searchParams.set(
      "client_id",
      client.clientMetadata.client_id
    );
    authorizationUrl.searchParams.set("request_uri", parResponse.request_uri);
    return authorizationUrl;
  } else if (metadata.require_pushed_authorization_requests) {
    throw new Error(
      "Server requires pushed authorization requests (PAR) but no PAR endpoint is available"
    );
  } else {
    const authorizationUrl = new URL(metadata.authorization_endpoint);
    for (const [key, value] of Object.entries(parameters)) {
      if (value) authorizationUrl.searchParams.set(key, String(value));
    }

    // Length of the URL that will be sent to the server
    const urlLength =
      authorizationUrl.pathname.length + authorizationUrl.search.length;
    if (urlLength < 2048) {
      return authorizationUrl;
    } else if (!metadata.pushed_authorization_request_endpoint) {
      throw new Error("Login URL too long");
    }
  }

  throw new Error(
    "Server does not support pushed authorization requests (PAR)"
  );
}

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const handle = formData.get("handle") as string;
  console.log(handle);
  if (!isValidHandle(handle)) {
    return json({ error: "Invalid handle" });
  }

  const url = await authorize(client, handle, {
    scope: "atproto transition:generic",
  });
  console.log(url);
  return redirect(url.toString());
};

export const loader: LoaderFunction = async () => {
  console.log("Loader");
  const data = await db.query.state.findMany();

  return json({ message: "Hello World", data });
};

export default function Index() {
  const actionData = useActionData();
  const data = useLoaderData();

  console.log(actionData);

  return (
    <div className="font-sans p-4">
      <h1 className="text-3xl">Welcome to Sky Tools</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
      <Form className="flex flex-col gap-4 w-1/2" method="post">
        <input
          type="text"
          className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          name="handle"
          placeholder="Bluesky Handle"
          required
        />
        <button
          className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800"
          type="submit"
        >
          Log in
        </button>
      </Form>
    </div>
  );
}

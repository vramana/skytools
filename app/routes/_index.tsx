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
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
import { client, nonceStore } from "~/lib/client.server";

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

  let start = Date.now();
  const { identity, metadata } = await client.oauthResolver.resolve(
    input,
    options
  );
  let end = Date.now();

  console.log({ identity, metadata, time: end - start });

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
    console.log({ server, dpopNonces: server.dpopNonces });
    const parResponse = await server.request(
      "pushed_authorization_request",
      parameters
    );

    const url2 = server.serverMetadata.pushed_authorization_request_endpoint;

    const auth = await server.buildClientAuth("pushed_authorization_request");

    console.log({
      url2,
      auth,
      body: { ...parameters, ...auth.payload },
    });

    const { json: _json } = await server.dpopFetch(url2!, {
      method: "POST",
      headers: { ...auth.headers, "Content-Type": "application/json" },
      body: JSON.stringify({ ...parameters, ...auth.payload }),
    });

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
  try {
    const formData = await request.formData();
    const handle = formData.get("handle") as string;
    console.log(handle);
    if (!isValidHandle(handle)) {
      return json({ error: "Invalid handle" });
    }

    const url = await authorize(client, handle, {
      scope: "atproto transition:generic",
    });
    console.log({ nonceStore: nonceStore.cache });
    console.log(url);
    return redirect(url.toString());
  } catch (e) {
    console.error(e);
    console.log({ nonceStore: nonceStore.cache });
    return json({ error: (e as Error).message });
  }
};

export const loader: LoaderFunction = async () => {
  return json({ message: "Hello World" });
};

export default function Index() {
  const data = useLoaderData();
  const navigation = useNavigation();
  // transition.type === "actionSubmission"
  const isActionSubmission = navigation.state === "submitting";

  // transition.type === "actionReload"
  const isActionReload =
    navigation.state === "loading" &&
    navigation.formMethod != null &&
    navigation.formMethod != "GET" &&
    // We had a submission navigation and are loading the submitted location
    navigation.formAction === navigation.location.pathname;

  // transition.type === "actionRedirect"
  const isActionRedirect =
    navigation.state === "loading" &&
    navigation.formMethod != null &&
    navigation.formMethod != "GET" &&
    // We had a submission navigation and are now navigating to different location
    navigation.formAction !== navigation.location.pathname;

  // transition.type === "loaderSubmission"
  const isLoaderSubmission =
    navigation.state === "loading" &&
    navigation.formMethod === "GET" &&
    // We had a loader submission and are navigating to the submitted location
    navigation.formAction === navigation.location.pathname;

  // transition.type === "loaderSubmissionRedirect"
  const isLoaderSubmissionRedirect =
    navigation.state === "loading" &&
    navigation.formMethod === "GET" &&
    // We had a loader submission and are navigating to a new location
    navigation.formAction !== navigation.location.pathname;

  return (
    <div className="font-sans p-4">
      <h1 className="text-3xl">Welcome to Sky Tools</h1>
      <Form className="flex flex-col gap-4 w-1/2" method="post">
        <input
          type="text"
          className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          name="handle"
          placeholder="Bluesky Handle"
          value={"vramana.dev"}
          readOnly
          required
        />
        <button
          className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5  
 py-2.5 me-2 mb-2 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800"
          type="submit"
          disabled={isActionSubmission}
        >
          {isActionSubmission ? (
            <div className="flex items-center justify-center">
              <svg
                className="animate-spin  
 h-5 w-5 text-white"
                viewBox="0 0 24 24"
              >
                <circle
                  className="fill-current"
                  cx="12"
                  cy="12"
                  r="7"
                  strokeLinecap="round"
                  strokeWidth="2"
                />
              </svg>
              <span className="ml-2">Loading...</span>
            </div>
          ) : (
            "Log in"
          )}
        </button>
      </Form>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

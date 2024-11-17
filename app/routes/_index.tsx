import { isValidHandle } from "@atproto/syntax";
import {
  type LoaderFunction,
  type MetaFunction,
  type ActionFunction,
  redirect,
  json,
} from "@remix-run/node";
import { Form, useLoaderData, useNavigation } from "@remix-run/react";
import { client } from "~/lib/client.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Sky Tools" },
    {
      name: "description",
      content: "Sky Tools is a set of tools for the Bluesky network.",
    },
  ];
};

export const action: ActionFunction = async ({ request }) => {
  try {
    const formData = await request.formData();
    const handle = formData.get("handle") as string;
    if (!isValidHandle(handle)) {
      return json({ error: "Invalid handle" });
    }

    const url = await client.authorize(handle, {
      scope: "atproto transition:generic",
    });
    return redirect(url.toString());
  } catch (e) {
    console.error(e);
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
  // eslint-disable-next-line
  const isActionReload =
    navigation.state === "loading" &&
    navigation.formMethod != null &&
    navigation.formMethod != "GET" &&
    // We had a submission navigation and are loading the submitted location
    navigation.formAction === navigation.location.pathname;

  // transition.type === "actionRedirect"
  // eslint-disable-next-line
  const isActionRedirect =
    navigation.state === "loading" &&
    navigation.formMethod != null &&
    navigation.formMethod != "GET" &&
    // We had a submission navigation and are now navigating to different location
    navigation.formAction !== navigation.location.pathname;

  // transition.type === "loaderSubmission"
  // eslint-disable-next-line
  const isLoaderSubmission =
    navigation.state === "loading" &&
    navigation.formMethod === "GET" &&
    // We had a loader submission and are navigating to the submitted location
    navigation.formAction === navigation.location.pathname;

  // transition.type === "loaderSubmissionRedirect"
  // eslint-disable-next-line
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

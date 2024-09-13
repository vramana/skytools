import { isValidHandle } from "@atproto/syntax";
import {
  type MetaFunction,
  type ActionFunction,
  redirect,
  json,
} from "@remix-run/node";
import { Form, useActionData } from "@remix-run/react";
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
  const formData = await request.formData();
  const handle = formData.get("handle") as string;
  console.log(handle);
  if (!isValidHandle(handle)) {
    return json({ error: "Invalid handle" });
  }

  const url = await client.authorize(handle, {
    scope: "atproto transition:generic",
    // redirect_uri: `${process.env.PUBLIC_URL}/callback`,
  });
  console.log(url);
  return redirect(url.toString());
};

export default function Index() {
  const actionData = useActionData();

  console.log(actionData);

  return (
    <div className="font-sans p-4">
      <h1 className="text-3xl">Welcome to Sky Tools</h1>
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

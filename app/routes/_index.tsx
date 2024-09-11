import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [
    { title: "Sky Tools" },
    {
      name: "description",
      content: "Sky Tools is a set of tools for the Bluesky network.",
    },
  ];
};

export default function Index() {
  return (
    <div className="font-sans p-4">
      <h1 className="text-3xl">Welcome to Sky Tools</h1>
    </div>
  );
}

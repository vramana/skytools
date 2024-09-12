import { client } from "~/lib/client.server";

export const loader = () => {
  return client.clientMetadata;
};

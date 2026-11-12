import { handleApiRequest } from "../server/handler.js";

// Vercel supplies the request and sends the returned response.
export default {
  fetch: handleApiRequest,
};

import { put } from "@vercel/blob";
import type { Storage } from "./index";

/** Stockage des médias (logos, captures, images du fil) sur Vercel Blob. */
export const blobStorage: Storage = {
  async put(key, body, contentType) {
    const r = await put(key, Buffer.from(body as ArrayBuffer), { access: "public", contentType, addRandomSuffix: true, token: process.env.BLOB_READ_WRITE_TOKEN });
    return { url: r.url };
  },
};

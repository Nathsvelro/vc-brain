import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";

export const MODEL_SMART = process.env.MODEL_SMART || "gpt-5";
export const MODEL_FAST = process.env.MODEL_FAST || "gpt-5-mini";

let client: OpenAI | null = null;
export function openai(): OpenAI {
  return (client ??= new OpenAI());
}

export type ContentPart =
  | { type: "input_text"; text: string }
  | { type: "input_file"; filename: string; file_data: string };

export type Msg = { role: "system" | "user"; content: string | ContentPart[] };

/** Base64 data-URL part so OpenAI reads the PDF natively (and can cite slide numbers). */
export function pdfPart(filePath: string): ContentPart {
  const data = fs.readFileSync(filePath).toString("base64");
  return {
    type: "input_file",
    filename: path.basename(filePath),
    file_data: `data:application/pdf;base64,${data}`,
  };
}

/**
 * One structured-output call: strict JSON schema via zod, one retry that feeds
 * the validation error back to the model.
 */
export async function callStructured<T extends z.ZodTypeAny>(
  name: string,
  schema: T,
  input: string | Msg[],
  opts: { model?: string; system?: string } = {},
): Promise<z.infer<T>> {
  const model = opts.model ?? MODEL_SMART;
  const format = zodTextFormat(schema, name);
  const base: Msg[] = typeof input === "string" ? [{ role: "user", content: input }] : input;
  const messages: Msg[] = opts.system ? [{ role: "system", content: opts.system }, ...base] : base;

  const attempt = async (extra: Msg[]) => {
    const res = await openai().responses.parse({
      model,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      input: [...messages, ...extra] as any,
      text: { format },
    });
    if (res.output_parsed == null) throw new Error(`no parsed output for ${name}`);
    return res.output_parsed as z.infer<T>;
  };

  try {
    return await attempt([]);
  } catch (err) {
    return attempt([
      {
        role: "user",
        content: `Your previous attempt failed schema validation for "${name}": ${String(err).slice(0, 500)}. Answer again, strictly matching the required JSON schema.`,
      },
    ]);
  }
}

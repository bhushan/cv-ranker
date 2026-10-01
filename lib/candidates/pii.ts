import { AppError } from "../errors";
import type { CandidateIdentity, Role, Rubric } from "../types";
const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const phoneRegex = /(?:\+?\d[\d ()\-.]{7,}\d)/g;
const sensitiveLine =
  /\b(address|location|residence|contact|linkedin|github|portfolio|website|date of birth|dob|gender|nationality|marital|citizenship|passport|aadhar|aadhaar|religion|race|ethnicity|pronouns|references?|university|college|school)\b/i;
const headings =
  /^(?:\[Page \d+\]|curriculum vitae|resume|cv|experience|education|skills|summary|profile|professional|product manager|senior product manager|employment|work|projects|achievements)/i;
const professionalSection =
  /^(?:professional summary|summary|profile|experience|professional experience|work experience|work history|employment|skills|technical skills|key skills|core competencies|projects|achievements|certifications|awards)\b/i;
const privateSection =
  /^(?:personal(?:\s+(?:details|information|profile))?|references?|referees|contact(?:\s+(?:details|information))?|address|education|academic(?:\s+(?:background|qualifications))?|family(?:\s+details)?)\s*[:\-]?\s*$/i;
const addressLine =
  /\b(flat|apartment|apartments|apt|pincode|postal code|zip code|street|road|lane|avenue|residential|birthplace|father|mother|spouse|professor|mr\.|mrs\.|ms\.|dr\.)\b/i;
const bareUrl =
  /\b(?:[a-z0-9-]+\.)+(?:com|org|net|io|in|co|me|dev|edu|app|ai|uk|us)(?:\/\S*)?\b/gi;
function looksStandaloneIdentifying(line: string) {
  // Short standalone proper-name/location lines are deliberately omitted. This may
  // remove a terse employer or skill label; privacy wins over uncertain evidence.
  return /^[\p{Lu}][\p{L}.'’\-]*(?:\s+[\p{Lu}][\p{L}.'’\-]*){0,4}$/u.test(line);
}
declare const sanitized: unique symbol;
export type SanitizedCv = string & { readonly [sanitized]: true };
// A primitive brand disappears at runtime; retain process-local provenance as well.
const sanitizedContents = new Set<string>();
export function extractIdentity(text: string): CandidateIdentity {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const email = text.match(emailRegex)?.[0] ?? "";
  const phone =
    text
      .match(phoneRegex)
      ?.find(
        (v) =>
          v.replace(/\D/g, "").length >= 10 &&
          v.replace(/\D/g, "").length <= 15,
      ) ?? "";
  const nameLine = lines
    .slice(0, 8)
    .find(
      (l) =>
        !headings.test(l) &&
        !sensitiveLine.test(l) &&
        !l.includes("@") &&
        /^(?:Name\s*:\s*)?[\p{L}][\p{L}.'’\-]+(?:\s+[\p{L}][\p{L}.'’\-]+){1,4}$/u.test(
          l,
        ),
    );
  const name = nameLine?.replace(/^Name\s*:\s*/i, "") ?? "";
  if (!name || !email)
    throw new AppError(
      "PII_EXTRACTION_FAILED",
      "Could not safely identify the candidate name and email. Add a clear name and email near the top of the CV and upload again.",
    );
  return { name, email, phone };
}
export function sanitizeCv(
  text: string,
  identity: CandidateIdentity,
): SanitizedCv {
  if (!identity.name || !identity.email)
    throw new AppError(
      "PII_EXTRACTION_FAILED",
      "Candidate identity must be extracted before evaluation.",
    );
  let content = text;
  // Names are removed wherever repeated, including signatures, page headers and references.
  for (const token of identity.name.split(/\s+/).filter((t) => t.length > 1)) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    content = content.replace(
      new RegExp(`\\b${escaped}\\b`, "gi"),
      "[redacted]",
    );
  }
  content = content
    .replace(emailRegex, "[redacted]")
    .replace(/https?:\/\/\S+|www\.\S+/gi, "[redacted]")
    .replace(bareUrl, "[redacted]");
  if (identity.phone)
    content = content.split(identity.phone).join("[redacted]");
  content = content.replace(phoneRegex, (v) =>
    v.replace(/\D/g, "").length >= 10 ? "[redacted]" : v,
  );
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((l) => professionalSection.test(l.trim()));
  if (start < 0)
    throw new AppError(
      "PII_EXTRACTION_FAILED",
      "Could not locate professional CV sections safely. Use clear Experience, Skills or Education headings.",
    );
  const retained: string[] = [];
  let excludedSection = false;
  for (const raw of lines.slice(start)) {
    const line = raw.trim();
    if (privateSection.test(line)) {
      excludedSection = true;
      continue;
    }
    if (professionalSection.test(line)) {
      excludedSection = false;
      retained.push(line);
      continue;
    }
    if (
      excludedSection ||
      sensitiveLine.test(line) ||
      addressLine.test(line) ||
      looksStandaloneIdentifying(line) ||
      /^\d{5,6}$/.test(line) ||
      /^\[redacted\](?:\/\S*)?$/.test(line) ||
      /^\[Page \d+\]$/.test(line)
    )
      continue;
    retained.push(raw);
  }
  content = retained.join("\n").trim();
  if (
    content.length < 40 ||
    emailRegex.test(content) ||
    identity.name
      .split(/\s+/)
      .some(
        (t) => t.length > 2 && content.toLowerCase().includes(t.toLowerCase()),
      )
  )
    throw new AppError(
      "PII_EXTRACTION_FAILED",
      "Could not safely remove identifying details from this CV.",
    );
  emailRegex.lastIndex = 0;
  sanitizedContents.add(content);
  // Prevent unbounded retained document strings on long-lived development processes.
  if (sanitizedContents.size > 100)
    sanitizedContents.delete(sanitizedContents.values().next().value!);
  return content as SanitizedCv;
}
export function createEvaluationPayload(
  candidateId: string,
  role: Role,
  cvContent: SanitizedCv,
  rubric: Rubric,
) {
  if (!sanitizedContents.has(cvContent))
    throw new AppError(
      "PII_EXTRACTION_FAILED",
      "Evaluation content must pass identity separation in this request.",
    );
  const safeRubric = {
    role: rubric.role,
    version: rubric.version,
    source: "Eight historical hire CVs",
    criteria: rubric.criteria.map(
      ({ id, name, weight, description, evaluation_guidance }) => ({
        id,
        name,
        weight,
        description,
        evaluation_guidance,
      }),
    ),
  };
  return {
    candidate_id: candidateId,
    role,
    cv_content: cvContent,
    rubric: safeRubric,
  };
}

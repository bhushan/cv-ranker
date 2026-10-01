import "server-only";
import { ZodError } from "zod";
import { requireFounder, requireSameOrigin } from "./auth";
import { AppError, errorResponse } from "./errors";
export async function api(request: Request, action: () => Promise<unknown>) {
  try {
    await requireFounder();
    if (request.method !== "GET") requireSameOrigin(request);
    return Response.json(await action(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof ZodError)
      return errorResponse(
        new AppError(
          "INVALID_INPUT",
          "Check the submitted fields and try again.",
        ),
      );
    return errorResponse(error);
  }
}

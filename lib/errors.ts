export class AppError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); this.name = 'AppError'; }
}
export function errorResponse(error: unknown) {
  if (error instanceof AppError) return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  console.error('Request failed', { type: error instanceof Error ? error.name : 'Unknown' });
  return Response.json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } }, { status: 500 });
}

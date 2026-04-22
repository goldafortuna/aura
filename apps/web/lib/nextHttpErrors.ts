import { NextResponse } from 'next/server';

export function internalServerErrorResponse(
  scope: string,
  error: unknown,
  message: string = 'Internal server error. Please try again later.',
) {
  console.error(`[${scope}]`, error);
  return NextResponse.json({ error: message }, { status: 500 });
}

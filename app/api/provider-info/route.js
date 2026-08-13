import { NextResponse } from 'next/server';
import { getActiveProviderInfo } from '../../../lib/aiProvider';

export async function GET() {
  return NextResponse.json(getActiveProviderInfo(), { status: 200 });
}

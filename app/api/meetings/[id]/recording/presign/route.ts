import { NextRequest, NextResponse } from 'next/server'

// This route is no longer needed — recording upload goes directly to /upload
// Kept as a stub so any old client code won't 404
export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'Presign route is deprecated. Upload directly to /recording/upload.' },
    { status: 410 }
  )
}

import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

// This route serves the React client app
// It's mounted at /app/* and serves files from the public folder

const INDEX_HTML_PATH = path.join(process.cwd(), 'public', 'index.html');

export async function GET(request: NextRequest) {
  try {
    // Read the index.html from public folder
    const indexHtml = await readFile(INDEX_HTML_PATH, 'utf-8');
    
    return new NextResponse(indexHtml, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    // If index.html doesn't exist, redirect to Next.js landing page
    return NextResponse.redirect(new URL('/', request.url));
  }
}

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

async function proxy(req: NextRequest, path: string[]) {
  const url = `${BACKEND_URL}/${path.join('/')}${req.nextUrl.search}`;

  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    // Skip headers that cause issues when proxying
    if (!['host', 'connection', 'transfer-encoding'].includes(key.toLowerCase())) {
      headers[key] = value;
    }
  });

  const init: RequestInit = { method: req.method, headers };

  if (!['GET', 'HEAD'].includes(req.method)) {
    init.body = await req.arrayBuffer();
  }

  try {
    const res = await fetch(url, init);
    const body = await res.arrayBuffer();

    const responseHeaders = new Headers();
    res.headers.forEach((value, key) => {
      if (!['transfer-encoding', 'connection'].includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    return new NextResponse(body, {
      status: res.status,
      headers: responseHeaders,
    });
  } catch (err) {
    return NextResponse.json(
      { message: 'Cannot reach backend server. Check server connection.' },
      { status: 503 }
    );
  }
}

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}
export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}
export async function PUT(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}
export async function PATCH(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}
export async function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}

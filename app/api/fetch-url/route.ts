import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ error: 'URL is required.' }, { status: 400 });
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Failed to fetch URL: ${response.statusText}` }, { status: response.status });
    }

    const html = await response.text();
    // A simple parser to extract body text from HTML
    let bodyText = html;
    // Strip script and style tags
    bodyText = bodyText.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    bodyText = bodyText.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    // Strip HTML tags
    bodyText = bodyText.replace(/<[^>]+>/g, ' ');
    // Clean up spaces
    bodyText = bodyText.replace(/\s+/g, ' ').trim();

    // Limit to 8000 characters to prevent overloading the prompt
    if (bodyText.length > 8000) {
      bodyText = bodyText.substring(0, 8000) + '...';
    }

    return NextResponse.json({ text: bodyText });
  } catch (error: any) {
    console.error('Error fetching URL:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

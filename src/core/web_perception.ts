export class WebPerception {
  private isUnsafeUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      const blocked = [
        'localhost', '127.0.0.1', '::1',
        '0.0.0.0', '169.254.169.254',
        'metadata.google.internal',
        '10.', '192.168.', '172.16.', '172.17.', '172.18.',
        '172.19.', '172.20.', '172.21.', '172.22.', '172.23.',
        '172.24.', '172.25.', '172.26.', '172.27.', '172.28.',
        '172.29.', '172.30.', '172.31.'
      ];
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;
      return blocked.some(b => host === b || host.startsWith(b));
    } catch {
      return true;
    }
  }

  async search(query: string): Promise<string> {
    console.log(`🌐 Searching the web for: ${query}`);
    try {
      // Use DuckDuckGo HTML search for a clean, zero-key experience
      const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error('Search failed');
      
      const html = await response.text();
      
      // Basic extraction of search results (links and snippets)
      // This is a lightweight version of what Puppeteer would do
      const results = this.extractResults(html);
      
      return results.length > 0 
        ? results.join('\n\n') 
        : "No clear results found. I may need more specialized tools.";
    } catch (error) {
      return `I attempted to perceive the web but failed: ${error}`;
    }
  }

  async readPage(url: string): Promise<string> {
    console.log(`📖 Reading page: ${url}`);
    if (this.isUnsafeUrl(url)) {
      return 'Access to internal/local URLs is blocked for security.';
    }
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
      
      const text = await response.text();
      // Simple text extraction (stripping HTML tags)
      const cleanText = text.replace(/<[^>]*>?/gm, ' ')
        .replace(/\s+/gm, ' ')
        .substring(0, 10000); // Take first 10k chars
        
      return cleanText;
    } catch (error) {
      return `I could not read the page at ${url}. It might be protected or unavailable.`;
    }
  }

  private extractResults(html: string): string[] {
    // Very simple extraction logic for DDG HTML results
    const results: string[] = [];
    const snippets = html.match(/<a class="result__snippet"[^>]*>(.*?)<\/a>/g);
    const titles = html.match(/<a class="result__a"[^>]*>(.*?)<\/a>/g);
    
    if (titles && snippets) {
      for (let i = 0; i < Math.min(5, titles.length); i++) {
        const title = titles[i]?.replace(/<[^>]*>?/gm, '');
        const snippet = snippets[i]?.replace(/<[^>]*>?/gm, '');
        results.push(`[${title}] - ${snippet}`);
      }
    }
    return results;
  }
}

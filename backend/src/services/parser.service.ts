import { ParsedTransactionDraft, ParseImportResult } from '../types/index.js';

export class ParserService {
  /**
   * Main entry point to parse raw pasted text (Shopee order summary, GCash SMS/receipt, or CSV).
   */
  static parseTextOrCsv(rawInput: string): ParseImportResult {
    const trimmed = rawInput.trim();
    if (!trimmed) {
      return { parsedItems: [], totalCount: 0, totalAmount: 0, detectedSources: [] };
    }

    // Check if input is CSV (has commas, header line with keywords like 'date', 'amount', etc.)
    const firstLine = trimmed.split('\n')[0].toLowerCase();
    if (
      (firstLine.includes('date') && firstLine.includes('amount')) ||
      (firstLine.includes(',') && trimmed.split('\n').length > 1 && trimmed.split('\n')[1].includes(','))
    ) {
      return this.parseCsv(trimmed);
    }

    // Otherwise, parse as unstructured or semi-structured text (Shopee, GCash, Grab, etc.)
    return this.parseUnstructuredText(trimmed);
  }

  /**
   * Parse CSV format
   */
  private static parseCsv(csvText: string): ParseImportResult {
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const parsedItems: ParsedTransactionDraft[] = [];
    const sourcesSet = new Set<string>();

    // Detect header index
    const headers = lines[0].toLowerCase().split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
    const dateIdx = headers.findIndex((h) => h.includes('date'));
    const descIdx = headers.findIndex((h) => h.includes('desc') || h.includes('item') || h.includes('title') || h.includes('merchant'));
    const amountIdx = headers.findIndex((h) => h.includes('amount') || h.includes('price') || h.includes('cost') || h.includes('total'));
    const categoryIdx = headers.findIndex((h) => h.includes('cat'));
    const methodIdx = headers.findIndex((h) => h.includes('payment') || h.includes('method') || h.includes('channel'));

    const startLine = (dateIdx !== -1 || amountIdx !== -1) ? 1 : 0;

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];
      // Basic CSV tokenizing handling quotes
      const tokens = this.tokenizeCsvLine(line);
      if (tokens.length < 2) continue;

      const rawAmount = amountIdx !== -1 ? tokens[amountIdx] : tokens.find((t) => /[\d,]+\.?\d*/.test(t)) || '0';
      const amount = this.extractNumericAmount(rawAmount);
      if (amount <= 0) continue;

      const rawDesc = descIdx !== -1 ? tokens[descIdx] : (tokens[1] || tokens[0] || 'Imported Transaction');
      const desc = rawDesc.replace(/^["']|["']$/g, '').trim();

      const rawDate = dateIdx !== -1 && tokens[dateIdx] ? tokens[dateIdx] : new Date().toISOString();
      const date = this.normalizeDate(rawDate);

      const enrichment = this.detectContextAndTags(desc);
      if (enrichment.source) sourcesSet.add(enrichment.source);

      parsedItems.push({
        description: desc,
        amount,
        date: date.toISOString(),
        paymentMethod: enrichment.paymentMethod,
        source: enrichment.source,
        tags: enrichment.tags,
        suggestedCategorySlug: enrichment.categorySlug,
        isShopeeOrder: enrichment.isShopeeOrder,
        orderTrackingNumber: enrichment.trackingNumber,
        rawText: line,
      });
    }

    const totalAmount = parsedItems.reduce((sum, item) => sum + item.amount, 0);

    return {
      parsedItems,
      totalCount: parsedItems.length,
      totalAmount: Math.round(totalAmount * 100) / 100,
      detectedSources: Array.from(sourcesSet),
    };
  }

  /**
   * Parse unstructured receipt / order / SMS text (Shopee orders, GCash statements, GrabFood, etc.)
   */
  private static parseUnstructuredText(text: string): ParseImportResult {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const parsedItems: ParsedTransactionDraft[] = [];
    const sourcesSet = new Set<string>();

    // 1. Check for GCash SMS / receipt patterns:
    // e.g.: "You have paid PHP 450.00 of GrabFood using GCash on 09/10/2026. Ref. No. 123456789"
    // e.g.: "Express Send PHP 1,200.00 to Juan Dela Cruz on 09/11/2026 Ref No. 987654321"
    const gcashRegex = /(?:paid|sent|received|transfer|express send|payment of)\s*(?:php|₱)?\s*([\d,]+\.?\d{0,2})\s*(?:to|of|for|at)?\s*([^.]+?)(?:using|\.|\n|$)/i;
    
    // 2. Check for Shopee Order summaries:
    // e.g.: "Order ID 260912ABCXYZ - 1x Wireless Mechanical Keyboard - ₱1,499.00 - Standard Local"
    // e.g.: "ShopeePay / Cash on Delivery - Order Total: ₱899.00"

    // Process blocks or lines
    let currentItem: Partial<ParsedTransactionDraft> | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Match explicit GCash SMS text
      const gcashMatch = line.match(gcashRegex);
      if (gcashMatch) {
        const amount = this.extractNumericAmount(gcashMatch[1]);
        const recipientOrMerchant = gcashMatch[2]?.trim() || 'GCash Transaction';
        const enrichment = this.detectContextAndTags(`GCash ${recipientOrMerchant} ${line}`);
        sourcesSet.add('GCash');

        parsedItems.push({
          description: recipientOrMerchant.length > 3 ? recipientOrMerchant : `GCash Payment: ${line.substring(0, 40)}`,
          amount,
          date: new Date().toISOString(),
          paymentMethod: 'GCASH',
          source: enrichment.source || 'GCash',
          tags: Array.from(new Set(['GCash', ...enrichment.tags])),
          suggestedCategorySlug: enrichment.categorySlug,
          isShopeeOrder: enrichment.isShopeeOrder,
          orderTrackingNumber: enrichment.trackingNumber,
          rawText: line,
        });
        continue;
      }

      // Check if line contains a monetary amount (e.g. ₱1,499.00 or PHP 500)
      const amountMatch = line.match(/(?:₱|php|pesos|total:?|amount:?)\s*([\d,]+\.?\d{0,2})/i) || line.match(/([\d,]+\.\d{2})/);
      
      if (amountMatch) {
        const amount = this.extractNumericAmount(amountMatch[1]);
        if (amount > 0) {
          // Description might be on this line or previous line
          let desc = line.replace(/(?:₱|php|pesos|total:?|amount:?)\s*[\d,]+\.?\d{0,2}/gi, '').trim();
          if (desc.length < 3 && i > 0 && lines[i - 1].length > 2) {
            desc = lines[i - 1];
          }
          if (desc.length < 2) desc = 'Shopping / Expense';

          const enrichment = this.detectContextAndTags(`${line} ${desc}`);
          if (enrichment.source) sourcesSet.add(enrichment.source);

          parsedItems.push({
            description: desc,
            amount,
            date: new Date().toISOString(),
            paymentMethod: enrichment.paymentMethod,
            source: enrichment.source,
            tags: enrichment.tags,
            suggestedCategorySlug: enrichment.categorySlug,
            isShopeeOrder: enrichment.isShopeeOrder,
            orderTrackingNumber: enrichment.trackingNumber,
            rawText: line,
          });
        }
      }
    }

    // If no individual lines matched amounts, but entire text mentions an amount, do whole-text extraction
    if (parsedItems.length === 0) {
      const globalAmountMatch = text.match(/(?:₱|php|total:?)\s*([\d,]+\.?\d{0,2})/i) || text.match(/([\d,]+\.\d{2})/);
      if (globalAmountMatch) {
        const amount = this.extractNumericAmount(globalAmountMatch[1]);
        const enrichment = this.detectContextAndTags(text);
        if (enrichment.source) sourcesSet.add(enrichment.source);

        parsedItems.push({
          description: text.substring(0, 60).replace(/[\r\n]+/g, ' ').trim(),
          amount,
          date: new Date().toISOString(),
          paymentMethod: enrichment.paymentMethod,
          source: enrichment.source,
          tags: enrichment.tags,
          suggestedCategorySlug: enrichment.categorySlug,
          isShopeeOrder: enrichment.isShopeeOrder,
          orderTrackingNumber: enrichment.trackingNumber,
          rawText: text,
        });
      }
    }

    const totalAmount = parsedItems.reduce((sum, item) => sum + item.amount, 0);

    return {
      parsedItems,
      totalCount: parsedItems.length,
      totalAmount: Math.round(totalAmount * 100) / 100,
      detectedSources: Array.from(sourcesSet),
    };
  }

  /**
   * Helper to detect auto-tags, categories, source, and tracking number based on keywords
   */
  public static detectContextAndTags(text: string): {
    tags: string[];
    source: string;
    paymentMethod: 'GCASH' | 'MAYA' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CASH' | 'BANK_TRANSFER' | 'OTHER';
    categorySlug: string;
    isShopeeOrder: boolean;
    trackingNumber?: string;
  } {
    const lower = text.toLowerCase();
    const tags = new Set<string>();
    let source = 'Manual Entry';
    let paymentMethod: 'GCASH' | 'MAYA' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CASH' | 'BANK_TRANSFER' | 'OTHER' = 'GCASH';
    let categorySlug = 'groceries';
    let isShopeeOrder = false;
    let trackingNumber: string | undefined;

    // Shopee Detection
    if (lower.includes('shopee') || lower.includes('spx') || lower.includes('shopeepay')) {
      tags.add('Shopee');
      tags.add('Online Orders');
      source = 'Shopee';
      categorySlug = 'shopee-online-orders';
      isShopeeOrder = true;
      const orderIdMatch = text.match(/(?:order\s*id|order\s*#|spx|ref)\s*[:#]?\s*([a-zA-Z0-9_-]{8,25})/i);
      if (orderIdMatch) trackingNumber = orderIdMatch[1];
    }

    // GCash Detection
    if (lower.includes('gcash') || lower.includes('express send') || lower.includes('instapay')) {
      tags.add('GCash');
      paymentMethod = 'GCASH';
      if (source === 'Manual Entry') source = 'GCash';
    } else if (lower.includes('maya') || lower.includes('paymaya')) {
      tags.add('Maya');
      paymentMethod = 'MAYA';
      if (source === 'Manual Entry') source = 'Maya';
    } else if (lower.includes('credit card') || lower.includes('mastercard') || lower.includes('visa')) {
      tags.add('Credit Card');
      paymentMethod = 'CREDIT_CARD';
    } else if (lower.includes('bpi') || lower.includes('bdo') || lower.includes('bank transfer') || lower.includes('unionbank')) {
      tags.add('Bank Transfer');
      paymentMethod = 'BANK_TRANSFER';
    } else if (lower.includes('cash') || lower.includes('cod')) {
      tags.add('Cash');
      paymentMethod = 'CASH';
    }

    // Grocery Detection
    if (
      lower.includes('grocery') ||
      lower.includes('supermarket') ||
      lower.includes('puregold') ||
      lower.includes('robinsons') ||
      lower.includes('savemore') ||
      lower.includes('sm hypermarket') ||
      lower.includes('waltermart') ||
      lower.includes('dali') ||
      lower.includes('o Save')
    ) {
      tags.add('Groceries');
      categorySlug = 'groceries';
      if (source === 'Manual Entry') source = 'Supermarket';
    }

    // Food & Dining Detection
    if (
      lower.includes('grabfood') ||
      lower.includes('foodpanda') ||
      lower.includes('jollibee') ||
      lower.includes('mcdonalds') ||
      lower.includes('restaurant') ||
      lower.includes('starbucks') ||
      lower.includes('dining') ||
      lower.includes('coffee')
    ) {
      tags.add('Food');
      tags.add('Dining Out');
      categorySlug = 'food-dining';
      if (source === 'Manual Entry') {
        if (lower.includes('grabfood')) source = 'GrabFood';
        else if (lower.includes('foodpanda')) source = 'FoodPanda';
        else source = 'Dining';
      }
    }

    // Utilities Detection
    if (lower.includes('meralco') || lower.includes('manila water') || lower.includes('maynilad') || lower.includes('pldt') || lower.includes('globe') || lower.includes('converge')) {
      tags.add('Utilities');
      categorySlug = 'utilities';
      if (source === 'Manual Entry') source = 'Utility Bill';
    }

    // Default tag if empty
    if (tags.size === 0) {
      tags.add('Expense');
    }

    return {
      tags: Array.from(tags),
      source,
      paymentMethod,
      categorySlug,
      isShopeeOrder,
      trackingNumber,
    };
  }

  private static extractNumericAmount(str: string): number {
    const cleaned = str.replace(/[^\d.]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : Math.round(num * 100) / 100;
  }

  private static normalizeDate(raw: string): Date {
    const parsed = new Date(raw);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  private static tokenizeCsvLine(line: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        tokens.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    tokens.push(current.trim());
    return tokens;
  }
}

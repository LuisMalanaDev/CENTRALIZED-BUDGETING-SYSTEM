import { ParsedTransactionDraft } from '../types/index.js';

export interface InboundEmailPayload {
  from?: string;
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
  token?: string;
}

export class EmailParserService {
  /**
   * Parse an incoming Shopee, GCash, or Food delivery confirmation email
   */
  static parseEmail(payload: InboundEmailPayload): ParsedTransactionDraft {
    const subject = payload.subject || '';
    const body = payload.text || this.stripHtml(payload.html || '');
    const combined = `${subject}\n${body}`;

    // 1. Check if Shopee order email
    if (
      subject.toLowerCase().includes('shopee') ||
      body.toLowerCase().includes('shopee') ||
      payload.from?.toLowerCase().includes('shopee')
    ) {
      return this.parseShopeeEmail(subject, body, combined);
    }

    // 2. Check if GCash email notification
    if (
      subject.toLowerCase().includes('gcash') ||
      body.toLowerCase().includes('gcash') ||
      payload.from?.toLowerCase().includes('gcash')
    ) {
      return this.parseGcashEmail(subject, body, combined);
    }

    // 3. Fallback generic e-commerce / receipt parser
    return this.parseGenericReceiptEmail(subject, body, combined);
  }

  private static parseShopeeEmail(subject: string, body: string, combined: string): ParsedTransactionDraft {
    // Extract Shopee Order ID / Tracking Number
    // e.g.: "Your COD order #26071817KKTTPP has been confirmed" or "Order ID: 260912ABCXYZ"
    const orderIdMatch =
      combined.match(/(?:(?:COD\s*)?Order\s*(?:ID|Number|No\.?|Ref\.?)?)\s*[:#]\s*([A-Za-z0-9_-]{8,30})/i) ||
      combined.match(/#([0-9]{8,15}[A-Z0-9]{4,15})/i) ||
      combined.match(/(SPXPH[A-Za-z0-9]+)/i) ||
      combined.match(/(?:Order\s*(?:ID|Number|No\.?|Ref\.?))\s*[:#]?\s*([A-Za-z0-9_-]{8,30})/i);
    const trackingNumber = orderIdMatch ? (orderIdMatch[1].startsWith('#') ? orderIdMatch[1] : `#${orderIdMatch[1]}`) : undefined;

    // Extract Total Amount
    // e.g.: "Total Payment: ₱1,499.00" or "Order Total: PHP 1,499.00" or "Amount Paid: ₱2,350.00"
    const amountMatch =
      combined.match(/(?:Total\s*(?:Payment|Amount|Order Total|Price)|Amount\s*Paid|Total)\s*[:=]?\s*(?:₱|PHP|Php)?\s*([\d,]+\.?\d{0,2})/i) ||
      combined.match(/(?:₱|PHP|Php)\s*([\d,]+\.?\d{0,2})/i);

    const amount = amountMatch ? this.extractNumeric(amountMatch[1]) : 0;

    // Extract item description
    let description = 'Shopee Online Order';
    const itemMatch =
      body.match(/(?:Item\(s\)|Product|Order Details):\s*([^\n\r]+)/i) ||
      body.match(/1x\s*([^\n\r-]+)/i) ||
      subject.match(/Shopee:\s*(.+)/i);

    if (itemMatch && itemMatch[1].trim().length > 3) {
      description = `Shopee - ${itemMatch[1].trim()}`;
    } else if (trackingNumber) {
      description = `Shopee Order #${trackingNumber}`;
    }

    // Payment method detection
    let paymentMethod: 'GCASH' | 'MAYA' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CASH' | 'BANK_TRANSFER' | 'OTHER' = 'GCASH';
    const lower = combined.toLowerCase();
    if (lower.includes('shopeepay') || lower.includes('gcash')) paymentMethod = 'GCASH';
    else if (lower.includes('credit card') || lower.includes('visa') || lower.includes('mastercard')) paymentMethod = 'CREDIT_CARD';
    else if (lower.includes('cash on delivery') || lower.includes('cod')) paymentMethod = 'CASH';
    else if (lower.includes('maya')) paymentMethod = 'MAYA';

    return {
      description,
      amount: amount > 0 ? amount : 999.0,
      date: new Date().toISOString(),
      paymentMethod,
      source: 'Shopee (Email Auto-Forward)',
      tags: ['Shopee', 'Online Orders', 'Email Auto-Forward'],
      suggestedCategorySlug: 'shopee-online-orders',
      isShopeeOrder: true,
      orderTrackingNumber: trackingNumber,
      rawText: combined.substring(0, 500),
    };
  }

  private static parseGcashEmail(subject: string, body: string, combined: string): ParsedTransactionDraft {
    const amountMatch = combined.match(/(?:₱|PHP|paid|amount of)\s*([\d,]+\.?\d{0,2})/i);
    const amount = amountMatch ? this.extractNumeric(amountMatch[1]) : 0;

    const refMatch = combined.match(/(?:Ref\.?\s*(?:No\.?|ID)|Reference)\s*[:#]?\s*([A-Za-z0-9]+)/i);
    const ref = refMatch ? refMatch[1] : undefined;

    let description = 'GCash Payment';
    const merchantMatch = combined.match(/(?:to|at|for|paid to)\s+([A-Za-z0-9\s&'-]{3,30})(?:\s+using|\s+on|\.|\n)/i);
    if (merchantMatch) {
      description = `GCash - ${merchantMatch[1].trim()}`;
    }

    const isShopee = combined.toLowerCase().includes('shopee');

    return {
      description,
      amount: amount > 0 ? amount : 500.0,
      date: new Date().toISOString(),
      paymentMethod: 'GCASH',
      source: 'GCash (Email Alert)',
      tags: isShopee ? ['Shopee', 'GCash', 'Email Auto-Forward'] : ['GCash', 'Email Auto-Forward'],
      suggestedCategorySlug: isShopee ? 'shopee-online-orders' : 'utilities',
      isShopeeOrder: isShopee,
      orderTrackingNumber: ref,
      rawText: combined.substring(0, 500),
    };
  }

  private static parseGenericReceiptEmail(subject: string, body: string, combined: string): ParsedTransactionDraft {
    const amountMatch = combined.match(/(?:₱|PHP|\$)\s*([\d,]+\.?\d{0,2})/i) || combined.match(/([\d,]+\.\d{2})/);
    const amount = amountMatch ? this.extractNumeric(amountMatch[1]) : 0;

    return {
      description: subject ? `Email Receipt: ${subject}` : 'Email Ingested Expense',
      amount: amount > 0 ? amount : 100.0,
      date: new Date().toISOString(),
      paymentMethod: 'CREDIT_CARD',
      source: 'Email Webhook',
      tags: ['Email Auto-Forward', 'Online Orders'],
      suggestedCategorySlug: 'groceries',
      isShopeeOrder: false,
      rawText: combined.substring(0, 500),
    };
  }

  private static extractNumeric(str: string): number {
    const cleaned = str.replace(/[^\d.]/g, '');
    const val = parseFloat(cleaned);
    return isNaN(val) ? 0 : Math.round(val * 100) / 100;
  }

  private static stripHtml(html: string): string {
    return html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
               .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
               .replace(/<[^>]+>/g, ' ')
               .replace(/\s{2,}/g, ' ')
               .trim();
  }
}

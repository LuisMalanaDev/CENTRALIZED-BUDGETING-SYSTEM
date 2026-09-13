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
   * Parse an incoming Shopee, Lazada, Google Play, Netflix, Steam, Roblox, GCash, or Food delivery email
   */
  static parseEmail(payload: InboundEmailPayload): ParsedTransactionDraft {
    const subject = payload.subject || '';
    const body = payload.text || this.stripHtml(payload.html || '');
    const from = payload.from || '';
    const combined = `${subject}\n${from}\n${body}`.toLowerCase();

    // 1. Shopee
    if (combined.includes('shopee')) {
      return this.parseShopeeEmail(subject, body, `${subject}\n${body}`);
    }

    // 2. Lazada
    if (combined.includes('lazada')) {
      return this.parseLazadaEmail(subject, body, `${subject}\n${body}`);
    }

    // 3. Google Play (Prioritized before Roblox/in-app merchants so Google Play receipts are recognized)
    if (
      combined.includes('google play') ||
      combined.includes('googleplay') ||
      from.includes('google.com') ||
      subject.toLowerCase().includes('google play')
    ) {
      return this.parseGooglePlayEmail(subject, body, `${subject}\n${body}`);
    }

    // 4. Steam (Ignored per user preference)
    if (combined.includes('steampowered') || combined.includes('steam')) {
      return {
        description: 'Ignored Steam Notification',
        amount: 0,
        date: new Date().toISOString(),
        paymentMethod: 'OTHER',
        source: 'Steam',
        tags: [],
        suggestedCategorySlug: 'general',
        isShopeeOrder: false,
        rawText: combined.substring(0, 200),
      };
    }

    // 5. Roblox (Direct roblox.com emails)
    if (combined.includes('roblox')) {
      return this.parseRobloxEmail(subject, body, `${subject}\n${body}`);
    }

    // 6. Netflix
    if (combined.includes('netflix')) {
      return this.parseNetflixEmail(subject, body, `${subject}\n${body}`);
    }

    // 7. GCash
    if (combined.includes('gcash')) {
      return this.parseGcashEmail(subject, body, `${subject}\n${body}`);
    }

    // 8. Grab / FoodPanda
    if (combined.includes('grab') || combined.includes('foodpanda')) {
      return this.parseFoodDeliveryEmail(subject, body, `${subject}\n${body}`);
    }

    // 9. Fallback generic e-commerce / receipt parser
    return this.parseGenericReceiptEmail(subject, body, `${subject}\n${body}`);
  }

  // --- SHOPEE ---
  private static parseShopeeEmail(subject: string, body: string, combined: string): ParsedTransactionDraft {
    const orderIdMatch =
      combined.match(/(?:(?:COD\s*)?Order\s*(?:ID|Number|No\.?|Ref\.?)?)\s*[:#]\s*([A-Za-z0-9_-]{8,30})/i) ||
      combined.match(/#([0-9]{8,15}[A-Z0-9]{4,15})/i) ||
      combined.match(/(SPXPH[A-Za-z0-9]+)/i) ||
      combined.match(/(?:Order\s*(?:ID|Number|No\.?|Ref\.?))\s*[:#]?\s*([A-Za-z0-9_-]{8,30})/i);
    const trackingNumber = orderIdMatch ? (orderIdMatch[1].startsWith('#') ? orderIdMatch[1] : `#${orderIdMatch[1]}`) : undefined;

    const amountMatch =
      combined.match(/(?:Total\s*(?:Payment|Amount|Order Total|Price)|Amount\s*Paid|Total)\s*[:=]?\s*(?:₱|PHP|Php)?\s*([\d,]+\.?\d{0,2})/i) ||
      combined.match(/(?:₱|PHP|Php)\s*([\d,]+\.?\d{0,2})/i);
    const amount = amountMatch ? this.extractNumeric(amountMatch[1]) : 0;

    let description = 'Shopee Online Order';
    const itemMatch =
      body.match(/(?:Item\(s\)|Product|Order Details):\s*([^\n\r]+)/i) ||
      body.match(/1x\s*([^\n\r-]+)/i) ||
      subject.match(/Shopee:\s*(.+)/i);

    if (itemMatch && itemMatch[1].trim().length > 3) {
      description = `Shopee - ${itemMatch[1].trim()}`;
    } else if (trackingNumber) {
      description = `Shopee Order ${trackingNumber}`;
    }

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
      source: 'Shopee (Email Sync)',
      tags: ['Shopee', 'Online Orders', 'Parcel'],
      suggestedCategorySlug: 'shopee-online-orders',
      isShopeeOrder: true,
      orderTrackingNumber: trackingNumber,
      rawText: combined.substring(0, 500),
    };
  }

  // --- LAZADA ---
  private static parseLazadaEmail(subject: string, body: string, combined: string): ParsedTransactionDraft {
    const orderIdMatch = combined.match(/(?:Order\s*(?:Number|No\.?|#)?)\s*[:#]?\s*([0-9]{10,20})/i);
    const trackingNumber = orderIdMatch ? `#${orderIdMatch[1]}` : undefined;

    const amountMatch =
      combined.match(/(?:Total\s*(?:Payment|Amount)?|Grand Total)\s*[:=]?\s*(?:₱|PHP|Php)?\s*([\d,]+\.?\d{0,2})/i) ||
      combined.match(/(?:₱|PHP|Php)\s*([\d,]+\.?\d{0,2})/i);
    const amount = amountMatch ? this.extractNumeric(amountMatch[1]) : 0;

    return {
      description: trackingNumber ? `Lazada Order ${trackingNumber}` : 'Lazada Online Order',
      amount: amount > 0 ? amount : 500.0,
      date: new Date().toISOString(),
      paymentMethod: combined.toLowerCase().includes('cod') ? 'CASH' : 'GCASH',
      source: 'Lazada (Email Sync)',
      tags: ['Lazada', 'Online Orders', 'Parcel'],
      suggestedCategorySlug: 'shopee-online-orders',
      isShopeeOrder: true,
      orderTrackingNumber: trackingNumber,
      rawText: combined.substring(0, 500),
    };
  }



  // --- ROBLOX ---
  private static parseRobloxEmail(subject: string, body: string, combined: string): ParsedTransactionDraft {
    const amountMatch =
      combined.match(/(?:Total|Amount|Price)\s*[:=]?\s*(?:₱|PHP|Php|\$)?\s*([\d,]+\.?\d{0,2})/i) ||
      combined.match(/(?:₱|PHP|Php|\$)\s*([\d,]+\.?\d{0,2})/i);
    const amount = amountMatch ? this.extractNumeric(amountMatch[1]) : 0;

    let description = 'Roblox - Robux / Item Purchase';
    const itemMatch = body.match(/(?:Item|Product|Description)\s*[:=]?\s*([^\n\r]+)/i);
    if (itemMatch && itemMatch[1].trim()) {
      description = `Roblox - ${itemMatch[1].trim()}`;
    }

    return {
      description,
      amount: amount > 0 ? amount : 250.0,
      date: new Date().toISOString(),
      paymentMethod: combined.toLowerCase().includes('gcash') ? 'GCASH' : 'CREDIT_CARD',
      source: 'Roblox (Email Sync)',
      tags: ['Roblox', 'Gaming', 'Entertainment'],
      suggestedCategorySlug: 'freelance',
      isShopeeOrder: false,
      rawText: combined.substring(0, 500),
    };
  }

  // --- NETFLIX ---
  private static parseNetflixEmail(subject: string, body: string, combined: string): ParsedTransactionDraft {
    const amountMatch =
      combined.match(/(?:₱|PHP|Php)\s*([\d,]+\.?\d{0,2})/i) ||
      combined.match(/(?:amount of|billed|charged)\s*(?:₱|PHP|Php|\$)?\s*([\d,]+\.?\d{0,2})/i);
    const amount = amountMatch ? this.extractNumeric(amountMatch[1]) : 549.0;

    return {
      description: 'Netflix Subscription',
      amount,
      date: new Date().toISOString(),
      paymentMethod: combined.toLowerCase().includes('gcash') ? 'GCASH' : 'CREDIT_CARD',
      source: 'Netflix (Email Sync)',
      tags: ['Netflix', 'Streaming', 'Subscriptions'],
      suggestedCategorySlug: 'utilities',
      isShopeeOrder: false,
      rawText: combined.substring(0, 500),
    };
  }

  // --- GOOGLE PLAY ---
  private static parseGooglePlayEmail(subject: string, body: string, combined: string): ParsedTransactionDraft {
    // 🛡️ Filter out failed payments, declined charges, subscription cancellations, or payment issues
    if (
      combined.includes('payment declined') ||
      combined.includes('payment issue') ||
      combined.includes('suspended due to payment') ||
      combined.includes('declined for') ||
      combined.includes('unable to process') ||
      combined.includes('fix your payment') ||
      combined.includes('subscription canceled') ||
      combined.includes('subscription has ended') ||
      combined.includes('cancellation confirmation')
    ) {
      return {
        description: 'Ignored Failed/Declined Payment',
        amount: 0,
        date: new Date().toISOString(),
        paymentMethod: 'OTHER',
        source: 'Google Play',
        tags: [],
        suggestedCategorySlug: 'general',
        isShopeeOrder: false,
        rawText: combined.substring(0, 200),
      };
    }

    const orderIdMatch = combined.match(/(GPA\.[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{5})/i);
    const orderId = orderIdMatch ? orderIdMatch[1] : undefined;

    const hasReceiptIndicator =
      combined.includes('your google play order receipt') ||
      combined.includes('google play order receipt') ||
      combined.includes('thank you for your purchase') ||
      combined.includes('you made a purchase');

    if (!orderIdMatch && !hasReceiptIndicator) {
      return {
        description: 'Ignored Non-Receipt Google Play Email',
        amount: 0,
        date: new Date().toISOString(),
        paymentMethod: 'OTHER',
        source: 'Google Play',
        tags: [],
        suggestedCategorySlug: 'general',
        isShopeeOrder: false,
        rawText: combined.substring(0, 200),
      };
    }

    const amountMatch =
      combined.match(/(?:Total|Amount)\s*[:=]?\s*(?:₱|PHP|Php|\$)?\s*([\d,]+\.?\d{0,2})/i) ||
      combined.match(/(?:₱|PHP|Php|\$)\s*([\d,]+\.?\d{0,2})/i);
    const amount = amountMatch ? this.extractNumeric(amountMatch[1]) : (orderId ? 70.0 : 0);

    if (amount <= 0) {
      return {
        description: 'Ignored Zero-Amount Google Play Email',
        amount: 0,
        date: new Date().toISOString(),
        paymentMethod: 'OTHER',
        source: 'Google Play',
        tags: [],
        suggestedCategorySlug: 'general',
        isShopeeOrder: false,
        rawText: combined.substring(0, 200),
      };
    }

    // Extract item title (e.g. "80 Robux (Roblox)")
    let itemName = '';
    const itemRobuxMatch = combined.match(/([0-9]+\s*(?:Robux|Diamonds|Coins|Credits|Points)[^\n\r₱]*)/i);
    if (itemRobuxMatch) {
      itemName = itemRobuxMatch[1].trim();
    } else {
      const itemTableRowMatch = combined.match(/Item\s*(?:Price)?\s*\n+([^\n\r₱]+?)(?:\s*(?:₱|PHP|Php|\$|\d))/i);
      if (itemTableRowMatch && itemTableRowMatch[1].trim() && !itemTableRowMatch[1].toLowerCase().includes('price')) {
        itemName = itemTableRowMatch[1].trim();
      } else {
        const devMatch = combined.match(/(?:purchase from|made a purchase from)\s*([^.\n]+?)\s*on Google Play/i);
        if (devMatch) {
          itemName = `${devMatch[1].trim()} In-App Purchase`;
        } else {
          const generalItemMatch =
            body.match(/(?:Item|Description|Order details)\s*[:=]?\s*([^\n\r]+)/i) ||
            subject.match(/Your Google Play Order Receipt for (.+)/i);
          if (generalItemMatch && generalItemMatch[1].trim()) {
            itemName = generalItemMatch[1].trim();
          }
        }
      }
    }

    const description = itemName ? `Google Play - ${itemName}` : 'Google Play Digital Purchase';

    // Extract actual receipt date if available (e.g. "Order date: Aug 29, 2026")
    let date = new Date().toISOString();
    const dateMatch =
      combined.match(/Order date:\s*([A-Za-z]+\s+\d{1,2},\s*\d{4}[^\n\r]*)/i) ||
      subject.match(/from\s+([A-Za-z]+\s+\d{1,2},\s*\d{4})/i);
    if (dateMatch) {
      const parsedDate = new Date(dateMatch[1]);
      if (!isNaN(parsedDate.getTime())) {
        date = parsedDate.toISOString();
      }
    }

    let paymentMethod: 'GCASH' | 'MAYA' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CASH' | 'BANK_TRANSFER' | 'OTHER' = 'CREDIT_CARD';
    const lower = combined.toLowerCase();
    if (lower.includes('gcash')) paymentMethod = 'GCASH';
    else if (lower.includes('maya')) paymentMethod = 'MAYA';

    return {
      description,
      amount,
      date,
      paymentMethod,
      source: 'Google Play (Email Sync)',
      tags: ['Google Play', 'Roblox', 'Gaming', 'Digital Purchase', 'Online Orders'],
      suggestedCategorySlug: 'shopee-online-orders',
      isShopeeOrder: false,
      orderTrackingNumber: orderId,
      rawText: combined.substring(0, 500),
    };
  }

  // --- GCASH ---
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

  // --- FOOD DELIVERY (Grab / FoodPanda) ---
  private static parseFoodDeliveryEmail(subject: string, body: string, combined: string): ParsedTransactionDraft {
    const isGrab = combined.toLowerCase().includes('grab');
    const platform = isGrab ? 'GrabFood' : 'FoodPanda';

    // 🛡️ Filter out marketing newsletters, promo coupons, voucher ads
    const isPromo =
      combined.includes('off your next order') ||
      combined.includes('% off') ||
      combined.includes('off!') ||
      combined.includes('savings delivered') ||
      combined.includes('best time to order') ||
      combined.includes('voucher') ||
      combined.includes('promo code') ||
      combined.includes('deal of the day') ||
      subject.includes('👀') ||
      subject.includes('✨') ||
      subject.includes('🤓') ||
      subject.includes('😎') ||
      subject.includes('🤔');

    const isActualOrder =
      combined.includes('your order has been placed') ||
      combined.includes('order confirmation') ||
      combined.includes('order has been delivered') ||
      combined.includes('order summary') ||
      combined.includes('order code') ||
      combined.includes('order #');

    if (isPromo && !isActualOrder) {
      return {
        description: 'Ignored Food Delivery Marketing Email',
        amount: 0,
        date: new Date().toISOString(),
        paymentMethod: 'OTHER',
        source: platform,
        tags: [],
        suggestedCategorySlug: 'food-dining',
        isShopeeOrder: false,
        rawText: combined.substring(0, 200),
      };
    }

    const amountMatch =
      combined.match(/(?:Total|Amount|Order Total)\s*[:=]?\s*(?:₱|PHP|Php)?\s*([\d,]+\.?\d{0,2})/i) ||
      combined.match(/(?:₱|PHP|Php)\s*([\d,]+\.?\d{0,2})/i);

    if (!amountMatch) {
      return {
        description: 'Ignored Non-Transactional Food Delivery Email',
        amount: 0,
        date: new Date().toISOString(),
        paymentMethod: 'OTHER',
        source: platform,
        tags: [],
        suggestedCategorySlug: 'food-dining',
        isShopeeOrder: false,
        rawText: combined.substring(0, 200),
      };
    }

    const amount = this.extractNumeric(amountMatch[1]);
    if (amount <= 0) {
      return {
        description: 'Ignored Zero-Amount Food Delivery Email',
        amount: 0,
        date: new Date().toISOString(),
        paymentMethod: 'OTHER',
        source: platform,
        tags: [],
        suggestedCategorySlug: 'food-dining',
        isShopeeOrder: false,
        rawText: combined.substring(0, 200),
      };
    }

    const orderIdMatch = combined.match(/(?:Order\s*(?:ID|Number|No\.?|Code|#))\s*[:#]?\s*([A-Za-z0-9_-]{5,30})/i);
    const trackingNumber = orderIdMatch ? orderIdMatch[1] : undefined;

    return {
      description: `${platform} Order`,
      amount,
      date: new Date().toISOString(),
      paymentMethod: 'GCASH',
      source: `${platform} (Email Sync)`,
      tags: [platform, 'Food Delivery', 'Dining'],
      suggestedCategorySlug: 'food-dining',
      isShopeeOrder: false,
      orderTrackingNumber: trackingNumber,
      rawText: combined.substring(0, 500),
    };
  }

  // --- GENERIC FALLBACK ---
  private static parseGenericReceiptEmail(subject: string, body: string, combined: string): ParsedTransactionDraft {
    const amountMatch =
      combined.match(/(?:₱|PHP|Php|\$)\s*([\d,]+\.?\d{0,2})/i) ||
      combined.match(/([\d,]+\.\d{2})/);
    const amount = amountMatch ? this.extractNumeric(amountMatch[1]) : 100.0;

    return {
      description: subject ? `Receipt: ${subject.substring(0, 40)}` : 'Email Ingested Expense',
      amount: amount > 0 ? amount : 100.0,
      date: new Date().toISOString(),
      paymentMethod: 'CREDIT_CARD',
      source: 'Email Webhook',
      tags: ['Email Auto-Forward', 'Receipt'],
      suggestedCategorySlug: 'food-dining',
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

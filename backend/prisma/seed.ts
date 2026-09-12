import { PrismaClient, TransactionType, PaymentMethod, AccountType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting WealthSync database seed...');

  // 1. Create or update demo user
  const email = 'demo@wealthsync.io';
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('WealthSync2026!', salt);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      name: 'Liam Mendoza',
      currency: 'PHP',
    },
    create: {
      email,
      passwordHash,
      name: 'Liam Mendoza',
      currency: 'PHP',
    },
  });

  console.log(`👤 Seeded demo user: ${user.email} (ID: ${user.id})`);

  // 2. Seed Accounts
  const accountDefs = [
    { name: 'GCash Wallet', type: AccountType.WALLET, balance: 18450.0, color: '#007DFE', icon: 'Smartphone' },
    { name: 'BPI Express Savings', type: AccountType.SAVINGS, balance: 125000.0, color: '#B11116', icon: 'Landmark' },
    { name: 'Maya Wallet', type: AccountType.WALLET, balance: 6200.0, color: '#00D665', icon: 'Zap' },
    { name: 'Cash on Hand', type: AccountType.CASH, balance: 4500.0, color: '#10B981', icon: 'Banknote' },
  ];

  const accounts: Record<string, any> = {};
  for (const acc of accountDefs) {
    const existing = await prisma.account.findFirst({
      where: { userId: user.id, name: acc.name },
    });
    if (existing) {
      accounts[acc.name] = existing;
    } else {
      accounts[acc.name] = await prisma.account.create({
        data: {
          userId: user.id,
          ...acc,
        },
      });
    }
  }

  // 3. Seed Categories
  const categoryDefs = [
    { name: 'Shopee & Online Orders', slug: 'shopee-online-orders', type: TransactionType.EXPENSE, color: '#EE4D2D', icon: 'ShoppingBag' },
    { name: 'Groceries & Supermarket', slug: 'groceries', type: TransactionType.EXPENSE, color: '#10B981', icon: 'ShoppingCart' },
    { name: 'Food & Dining Out', slug: 'food-dining', type: TransactionType.EXPENSE, color: '#F59E0B', icon: 'Utensils' },
    { name: 'Utilities & Bills', slug: 'utilities', type: TransactionType.EXPENSE, color: '#6366F1', icon: 'Zap' },
    { name: 'Transportation', slug: 'transportation', type: TransactionType.EXPENSE, color: '#3B82F6', icon: 'Car' },
    { name: 'Salary & Primary Income', slug: 'salary', type: TransactionType.INCOME, color: '#059669', icon: 'TrendingUp' },
    { name: 'Freelance & Side Hustles', slug: 'freelance', type: TransactionType.INCOME, color: '#8B5CF6', icon: 'Briefcase' },
  ];

  const categories: Record<string, any> = {};
  for (const cat of categoryDefs) {
    const record = await prisma.category.upsert({
      where: { userId_slug: { userId: user.id, slug: cat.slug } },
      update: cat,
      create: {
        userId: user.id,
        isSystem: true,
        ...cat,
      },
    });
    categories[cat.slug] = record;
  }

  // 4. Seed Budgets
  const budgetDefs = [
    { name: 'Overall Monthly Spending Cap', amount: 55000.0, categoryId: null },
    { name: 'Shopee & Online Shopping Cap', amount: 8500.0, categoryId: categories['shopee-online-orders'].id },
    { name: 'Groceries & Supermarket Budget', amount: 16000.0, categoryId: categories['groceries'].id },
    { name: 'Food Delivery & Dining Out', amount: 8000.0, categoryId: categories['food-dining'].id },
    { name: 'Monthly Utilities & Internet', amount: 9500.0, categoryId: categories['utilities'].id },
  ];

  for (const b of budgetDefs) {
    const existing = await prisma.budget.findFirst({
      where: { userId: user.id, name: b.name },
    });
    if (!existing) {
      await prisma.budget.create({
        data: {
          userId: user.id,
          name: b.name,
          amount: b.amount,
          categoryId: b.categoryId,
        },
      });
    }
  }

  // 5. Seed Savings Vaults
  const goalDefs = [
    { name: 'Emergency Reserve Vault', targetAmount: 150000.0, currentAmount: 98000.0, color: '#10B981', icon: 'ShieldCheck' },
    { name: 'Japan Autumn Adventure 2026', targetAmount: 85000.0, currentAmount: 54000.0, color: '#EC4899', icon: 'Plane' },
    { name: 'Tech & MacBook Upgrade', targetAmount: 110000.0, currentAmount: 62500.0, color: '#6366F1', icon: 'Laptop' },
  ];

  for (const g of goalDefs) {
    const existing = await prisma.savingsGoal.findFirst({
      where: { userId: user.id, name: g.name },
    });
    if (!existing) {
      await prisma.savingsGoal.create({
        data: {
          userId: user.id,
          ...g,
        },
      });
    }
  }

  // 6. Seed Realistic Transactions
  const now = new Date();
  const txDefs = [
    // Income
    {
      description: 'Monthly Tech Salary',
      amount: 85000.0,
      type: TransactionType.INCOME,
      categoryId: categories['salary'].id,
      accountId: accounts['BPI Express Savings']?.id,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      date: new Date(now.getFullYear(), now.getMonth(), 2),
      tags: ['Salary', 'Direct Deposit'],
    },
    {
      description: 'Web Architecture Consulting Gig',
      amount: 28000.0,
      type: TransactionType.INCOME,
      categoryId: categories['freelance'].id,
      accountId: accounts['GCash Wallet']?.id,
      paymentMethod: PaymentMethod.GCASH,
      date: new Date(now.getFullYear(), now.getMonth(), 6),
      tags: ['Freelance', 'GCash'],
    },
    // Shopee Orders
    {
      description: 'Shopee - Keychron Mechanical Keyboard & Keycaps',
      amount: 3850.0,
      type: TransactionType.EXPENSE,
      categoryId: categories['shopee-online-orders'].id,
      accountId: accounts['GCash Wallet']?.id,
      paymentMethod: PaymentMethod.GCASH,
      source: 'Shopee',
      tags: ['Shopee', 'Gadgets', 'Online Orders'],
      isShopeeOrder: true,
      orderTrackingNumber: 'SPXPH260912A87X',
      date: new Date(now.getFullYear(), now.getMonth(), 4),
    },
    {
      description: 'Shopee - Ugreen 100W GaN Fast Charger & USB-C Cable',
      amount: 1450.0,
      type: TransactionType.EXPENSE,
      categoryId: categories['shopee-online-orders'].id,
      accountId: accounts['GCash Wallet']?.id,
      paymentMethod: PaymentMethod.GCASH,
      source: 'Shopee',
      tags: ['Shopee', 'Electronics'],
      isShopeeOrder: true,
      orderTrackingNumber: 'SPXPH260914K19M',
      date: new Date(now.getFullYear(), now.getMonth(), 7),
    },
    {
      description: 'Shopee - Minimalist Desk Pad & Cable Management',
      amount: 820.0,
      type: TransactionType.EXPENSE,
      categoryId: categories['shopee-online-orders'].id,
      accountId: accounts['Maya Wallet']?.id,
      paymentMethod: PaymentMethod.MAYA,
      source: 'Shopee',
      tags: ['Shopee', 'Workspace'],
      isShopeeOrder: true,
      orderTrackingNumber: 'SPXPH260916T42Z',
      date: new Date(now.getFullYear(), now.getMonth(), 10),
    },
    // Groceries
    {
      description: 'SM Supermarket - Fresh Produce, Meat & Dairy',
      amount: 4820.5,
      type: TransactionType.EXPENSE,
      categoryId: categories['groceries'].id,
      accountId: accounts['BPI Express Savings']?.id,
      paymentMethod: PaymentMethod.CREDIT_CARD,
      source: 'SM Supermarket',
      tags: ['Groceries', 'Food', 'Produce'],
      date: new Date(now.getFullYear(), now.getMonth(), 3),
    },
    {
      description: 'Puregold - Weekly Household Essentials & Pantry Restock',
      amount: 3450.0,
      type: TransactionType.EXPENSE,
      categoryId: categories['groceries'].id,
      accountId: accounts['GCash Wallet']?.id,
      paymentMethod: PaymentMethod.GCASH,
      source: 'Puregold',
      tags: ['Groceries', 'GCash'],
      date: new Date(now.getFullYear(), now.getMonth(), 9),
    },
    // Food Delivery
    {
      description: 'GrabFood - 24 Chicken Half & Half Delivery',
      amount: 680.0,
      type: TransactionType.EXPENSE,
      categoryId: categories['food-dining'].id,
      accountId: accounts['GCash Wallet']?.id,
      paymentMethod: PaymentMethod.GCASH,
      source: 'GrabFood',
      tags: ['Food', 'Food Delivery', 'GCash'],
      date: new Date(now.getFullYear(), now.getMonth(), 5),
    },
    {
      description: 'FoodPanda - Japanese Ramen & Gyoza Set',
      amount: 890.0,
      type: TransactionType.EXPENSE,
      categoryId: categories['food-dining'].id,
      accountId: accounts['GCash Wallet']?.id,
      paymentMethod: PaymentMethod.GCASH,
      source: 'FoodPanda',
      tags: ['Food', 'Dining Out'],
      date: new Date(now.getFullYear(), now.getMonth(), 8),
    },
    // Utilities
    {
      description: 'Meralco Electric Bill Payment via GCash',
      amount: 4320.0,
      type: TransactionType.EXPENSE,
      categoryId: categories['utilities'].id,
      accountId: accounts['GCash Wallet']?.id,
      paymentMethod: PaymentMethod.GCASH,
      source: 'Meralco',
      tags: ['Utilities', 'GCash', 'Electric'],
      date: new Date(now.getFullYear(), now.getMonth(), 7),
    },
    {
      description: 'Converge Fiber Internet 200Mbps',
      amount: 1500.0,
      type: TransactionType.EXPENSE,
      categoryId: categories['utilities'].id,
      accountId: accounts['BPI Express Savings']?.id,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      source: 'Converge',
      tags: ['Utilities', 'Internet'],
      date: new Date(now.getFullYear(), now.getMonth(), 11),
    },
  ];

  const existingTxs = await prisma.transaction.count({ where: { userId: user.id } });
  if (existingTxs === 0) {
    for (const tx of txDefs) {
      await prisma.transaction.create({
        data: {
          userId: user.id,
          ...tx,
        },
      });
    }
    console.log(`✅ Seeded ${txDefs.length} realistic initial transactions`);
  }

  console.log('🎉 WealthSync database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during database seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

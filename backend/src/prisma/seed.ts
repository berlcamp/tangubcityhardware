import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Seed sample products
  const products = [
    {
      name: 'Portland Cement',
      sku: 'CEM-001',
      barcode: '4800000000001',
      basePrice: 280,
      costPrice: 250,
      units: [
        { unitName: 'bag', conversionFactor: 1, price: 280 },
      ],
      stock: 100,
    },
    {
      name: 'Deformed Bar 10mm',
      sku: 'STL-001',
      barcode: '4800000000002',
      basePrice: 185,
      costPrice: 160,
      units: [
        { unitName: 'piece', conversionFactor: 1, price: 185 },
        { unitName: 'bundle', conversionFactor: 6, price: 1050 },
      ],
      stock: 200,
    },
    {
      name: 'GI Wire #16',
      sku: 'WIR-001',
      barcode: '4800000000003',
      basePrice: 85,
      costPrice: 70,
      units: [
        { unitName: 'kilo', conversionFactor: 1, price: 85 },
        { unitName: 'roll', conversionFactor: 25, price: 2000 },
      ],
      stock: 50,
    },
    {
      name: 'Plywood 1/4"',
      sku: 'PLY-001',
      barcode: '4800000000004',
      basePrice: 550,
      costPrice: 480,
      units: [
        { unitName: 'sheet', conversionFactor: 1, price: 550 },
      ],
      stock: 30,
    },
    {
      name: 'PVC Pipe 1/2"',
      sku: 'PVC-001',
      barcode: '4800000000005',
      basePrice: 65,
      costPrice: 50,
      units: [
        { unitName: 'piece', conversionFactor: 1, price: 65 },
        { unitName: 'meter', conversionFactor: 0.33, price: 22 },
      ],
      stock: 150,
    },
    {
      name: 'Common Nail 2"',
      sku: 'NAL-001',
      barcode: '4800000000006',
      basePrice: 75,
      costPrice: 60,
      units: [
        { unitName: 'kilo', conversionFactor: 1, price: 75 },
        { unitName: 'box', conversionFactor: 25, price: 1750 },
      ],
      stock: 80,
    },
  ];

  for (const p of products) {
    const product = await prisma.product.create({
      data: {
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        basePrice: p.basePrice,
        costPrice: p.costPrice,
        units: {
          create: p.units.map((u) => ({
            unitName: u.unitName,
            conversionFactor: u.conversionFactor,
            price: u.price,
          })),
        },
        inventory: {
          create: {
            quantity: p.stock,
            lowStock: 10,
          },
        },
      },
    });
    console.log(`Created product: ${product.name}`);
  }

  // Seed a walk-in customer
  await prisma.customer.create({
    data: {
      name: 'Walk-in Customer',
      phone: null,
    },
  });

  // Seed admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: adminPassword,
      name: 'Administrator',
      role: 'ADMIN',
    },
  });
  console.log('Created admin user: admin / admin123');

  console.log('Seed completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

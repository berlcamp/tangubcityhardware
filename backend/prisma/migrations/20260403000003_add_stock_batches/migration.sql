-- AlterTable: Remove cost_price from products
ALTER TABLE "products" DROP COLUMN IF EXISTS "cost_price";

-- AlterTable: Add cost_price to sale_items
ALTER TABLE "sale_items" ADD COLUMN IF NOT EXISTS "cost_price" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable: stock_batches
CREATE TABLE IF NOT EXISTS "stock_batches" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "initial_qty" DECIMAL(12,4) NOT NULL,
    "cost_price" DECIMAL(12,2) NOT NULL,
    "reference" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT,
    "user_name" TEXT,

    CONSTRAINT "stock_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "stock_batches_product_id_received_at_idx" ON "stock_batches"("product_id", "received_at");

-- AddForeignKey
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

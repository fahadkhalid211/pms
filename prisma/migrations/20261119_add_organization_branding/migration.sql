-- AlterTable: Add missing columns to Organization table
-- Run this on your Hostinger MySQL database (hPanel > phpMyAdmin or SSH)
-- or run: npx prisma migrate deploy  (if Prisma can reach your production DB)

ALTER TABLE `Organization`
  ADD COLUMN `logoUrl` TEXT NULL,
  ADD COLUMN `primaryColor` VARCHAR(191) NULL DEFAULT '#0f172a',
  ADD COLUMN `accentColor` VARCHAR(191) NULL DEFAULT '#3b82f6',
  ADD COLUMN `branding` JSON NULL;

/**
 * Seed script untuk KACC Dashboard.
 *
 * Gunakan setelah migrate DB fresh (di Vercel/Supabase production) supaya
 * langsung punya 2 sheet sources (Oktober + September) yang sudah aktif.
 *
 * Usage:
 *   bun run db:seed          # default (seed both Oktober + September)
 *   bun run db:seed:oct      # cuma Oktober
 *
 * Idempotent - safe dijalankan berkali-kali. Kalau sheet dengan sheetId+gid
 * yang sama sudah ada, akan skip.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

interface SeedSheet {
  label: string;
  sheetId: string;
  gid: string;
  note: string;
  isActive: boolean;
}

const SEED_SHEETS: SeedSheet[] = [
  {
    label: "Oktober 2026",
    sheetId: "1BBio_q7gdfyXUUtoPGdTestAECyQIg459Q83vRMrs5Y",
    gid: "1880411456",
    note: "Sheet awal Oktober 2026 (auto-seed)",
    isActive: true,
  },
  {
    label: "September 2026",
    sheetId: "1BBio_q7gdfyXUUtoPGdTestAECyQIg459Q83vRMrs5Y",
    gid: "454540350",
    note: "Sheet September 2026 (auto-seed)",
    isActive: false,
  },
];

async function main() {
  console.log("🌱 Seeding KACC Dashboard sheet sources...\n");

  for (const sheet of SEED_SHEETS) {
    // Check if already exists (by sheetId + gid combination)
    const existing = await db.sheetSource.findFirst({
      where: {
        sheetId: sheet.sheetId,
        gid: sheet.gid,
      },
    });

    if (existing) {
      console.log(`  ✓ Skip (already exists): ${sheet.label} (id=${existing.id})`);
      // Optionally update isActive kalau berubah
      if (existing.isActive !== sheet.isActive) {
        await db.sheetSource.update({
          where: { id: existing.id },
          data: { isActive: sheet.isActive },
        });
        console.log(`    → Updated isActive to ${sheet.isActive}`);
      }
      continue;
    }

    // Kalau sheet ini mau aktif, deactivate yang lain dulu
    if (sheet.isActive) {
      await db.sheetSource.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
    }

    const created = await db.sheetSource.create({
      data: {
        label: sheet.label,
        sheetId: sheet.sheetId,
        gid: sheet.gid,
        note: sheet.note,
        isActive: sheet.isActive,
      },
    });
    console.log(`  ✅ Created: ${sheet.label} (id=${created.id}, isActive=${sheet.isActive})`);
  }

  const finalCount = await db.sheetSource.count();
  const activeCount = await db.sheetSource.count({ where: { isActive: true } });
  console.log(`\n📊 Total sheet sources: ${finalCount}`);
  console.log(`🟢 Active sheet sources: ${activeCount}`);
  console.log("\n✅ Seed completed!");
  console.log("\n💡 Note: dataStart/dataEnd/rowCount akan ter-isi otomatis saat dashboard pertama kali fetch sheet aktif.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

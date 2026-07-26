-- Collapse the newsroom model to a single admin, and replace Meilisearch with
-- Postgres full-text search.
--
-- Written by hand rather than generated: the enum shrink has to map existing
-- rows, and `prisma migrate dev` would have failed on the five values being
-- removed while they were still in use.

-- ── 1. ArticleStatus: nine values → four ─────────────────────────────────────
-- The review states have no reviewer, so they fold back to DRAFT. UPDATED and
-- CORRECTED described a published article, so they fold to PUBLISHED. The USING
-- clause does the mapping in place — no separate UPDATE pass, and no window
-- where a row holds a value its column no longer allows.
CREATE TYPE "ArticleStatus_new" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');

ALTER TABLE "Article" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "Article"
  ALTER COLUMN "status" TYPE "ArticleStatus_new"
  USING (
    CASE "status"::text
      WHEN 'IN_REVIEW'          THEN 'DRAFT'
      WHEN 'REVISION_REQUESTED' THEN 'DRAFT'
      WHEN 'READY_TO_PUBLISH'   THEN 'DRAFT'
      WHEN 'UPDATED'            THEN 'PUBLISHED'
      WHEN 'CORRECTED'          THEN 'PUBLISHED'
      ELSE "status"::text
    END
  )::"ArticleStatus_new";

ALTER TABLE "ArticleStatusEvent"
  ALTER COLUMN "fromStatus" TYPE "ArticleStatus_new"
  USING (
    CASE "fromStatus"::text
      WHEN 'IN_REVIEW'          THEN 'DRAFT'
      WHEN 'REVISION_REQUESTED' THEN 'DRAFT'
      WHEN 'READY_TO_PUBLISH'   THEN 'DRAFT'
      WHEN 'UPDATED'            THEN 'PUBLISHED'
      WHEN 'CORRECTED'          THEN 'PUBLISHED'
      ELSE "fromStatus"::text
    END
  )::"ArticleStatus_new";

ALTER TABLE "ArticleStatusEvent"
  ALTER COLUMN "toStatus" TYPE "ArticleStatus_new"
  USING (
    CASE "toStatus"::text
      WHEN 'IN_REVIEW'          THEN 'DRAFT'
      WHEN 'REVISION_REQUESTED' THEN 'DRAFT'
      WHEN 'READY_TO_PUBLISH'   THEN 'DRAFT'
      WHEN 'UPDATED'            THEN 'PUBLISHED'
      WHEN 'CORRECTED'          THEN 'PUBLISHED'
      ELSE "toStatus"::text
    END
  )::"ArticleStatus_new";

DROP TYPE "ArticleStatus";
ALTER TYPE "ArticleStatus_new" RENAME TO "ArticleStatus";
ALTER TABLE "Article" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- ── 2. Roles and password resets ─────────────────────────────────────────────
-- One account means every permission check answered the same way, and there is
-- nobody to email a reset link to; `pnpm db:create-admin` sets the password.
ALTER TABLE "User" DROP COLUMN "role";
DROP TYPE "UserRole";
DROP TABLE "PasswordResetToken";

-- ── 3. Full-text search, replacing Meilisearch ───────────────────────────────
ALTER TABLE "Article" ADD COLUMN "searchVector" tsvector;

-- A trigger rather than application code: the vector then stays correct no
-- matter which write path touches the row — route handler, seed, or psql.
CREATE OR REPLACE FUNCTION pressly_article_search_vector() RETURNS trigger AS $$
DECLARE cfg regconfig;
BEGIN
  -- Stemming is language-specific; Arabic in particular is badly served by the
  -- English stemmer. Postgres ships all four configurations we need.
  cfg := CASE NEW."primaryLanguage"
           WHEN 'ar' THEN 'arabic'::regconfig
           WHEN 'fr' THEN 'french'::regconfig
           WHEN 'de' THEN 'german'::regconfig
           ELSE 'english'::regconfig
         END;

  NEW."searchVector" :=
       setweight(to_tsvector(cfg, coalesce(NEW."headline", '')), 'A')
    || setweight(to_tsvector(cfg, coalesce(NEW."subheadline", '')), 'B')
    || setweight(to_tsvector(cfg, coalesce(NEW."summary", '')), 'B')
    -- bodyJson is structured Tiptap JSON; this pulls every string leaf out of
    -- it without the application having to flatten the document first.
    || setweight(jsonb_to_tsvector(cfg, NEW."bodyJson", '["string"]'), 'C');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER article_search_vector_update
  BEFORE INSERT OR UPDATE OF "headline", "subheadline", "summary", "bodyJson", "primaryLanguage"
  ON "Article"
  FOR EACH ROW EXECUTE FUNCTION pressly_article_search_vector();

CREATE INDEX "Article_searchVector_idx" ON "Article" USING GIN ("searchVector");

-- Backfill existing rows through the trigger.
UPDATE "Article" SET "headline" = "headline";

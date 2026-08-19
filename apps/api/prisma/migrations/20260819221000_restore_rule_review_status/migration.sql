-- The previous data migration normalized legacy seed rows. Rules maintained
-- outside the official seed must never become executable without review.
UPDATE "TaxRule"
SET "status" = 'needs_review'
WHERE COALESCE("reviewedBy", '') <> 'seed'
  AND COALESCE("reviewedBy", '') NOT LIKE 'seed:%';

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "Repository_name_trgm_idx" ON "Repository" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "Repository_owner_trgm_idx" ON "Repository" USING GIN ("owner" gin_trgm_ops);
CREATE INDEX "Repository_description_trgm_idx" ON "Repository" USING GIN ("description" gin_trgm_ops);

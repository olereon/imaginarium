# Database Migration Guide

This document outlines the migration strategy, naming conventions, and best practices for the Imaginarium database schema.

## Migration Strategy

### Development Environment
- Use `npx prisma migrate dev` for development migrations
- Each migration is automatically applied to the development database
- Migration files are generated in `prisma/migrations/`

### Production Environment
- Use `npx prisma migrate deploy` for production migrations
- Always test migrations in a staging environment first
- Use backup and rollback procedures before production deployment

## Migration Naming Conventions

### Format
All migration names follow the pattern:
```
YYYYMMDDHHMMSS_descriptive_name
```

### Examples
- `20250708154923_add_all_missing_models_and_fields`
- `20250708130718_enhance_user_session_apikey_models`
- `20250708124436_init`

### Naming Guidelines

1. **Use descriptive names** that clearly indicate what the migration does
2. **Use snake_case** for readability
3. **Include the primary action** (add, remove, modify, enhance, etc.)
4. **Group related changes** in meaningful migration names

#### Common Prefixes
- `init` - Initial schema creation
- `add` - Adding new tables, columns, or indexes
- `remove` - Removing tables, columns, or indexes
- `modify` - Changing existing schema elements
- `enhance` - Improving existing functionality
- `fix` - Fixing schema issues
- `optimize` - Performance improvements
- `refactor` - Restructuring without functional changes

#### Examples by Category
- **New Features**: `add_user_preferences_table`
- **Enhancements**: `enhance_file_upload_security`
- **Bug Fixes**: `fix_pipeline_version_constraints`
- **Performance**: `optimize_execution_log_indexes`
- **Refactoring**: `refactor_artifact_storage_structure`

## Migration Best Practices

### 1. Schema Design Principles
- **Normalization**: Follow proper database normalization
- **Indexes**: Add appropriate indexes for performance
- **Constraints**: Use foreign keys and check constraints
- **Null Handling**: Be explicit about nullable fields
- **Data Types**: Choose appropriate data types and sizes

### 2. Migration Safety
- **Backup First**: Always backup production data before migrations
- **Test Thoroughly**: Test migrations in staging environment
- **Rollback Plan**: Have a rollback strategy ready
- **Monitor Performance**: Watch for performance impacts

### 3. Version Control
- **Never Edit**: Never modify existing migration files
- **Commit Together**: Commit schema.prisma and migration files together
- **Descriptive Commits**: Use clear commit messages for migrations

### 4. Data Migrations
- **Separate Concerns**: Keep schema and data migrations separate
- **Use Transactions**: Wrap data migrations in transactions
- **Handle Errors**: Implement proper error handling
- **Log Progress**: Add logging for long-running migrations

## Database Models Overview

### User Management
- `users` - User accounts and profiles
- `sessions` - User authentication sessions
- `api_keys` - API key management

### Pipeline Management
- `pipelines` - Pipeline definitions
- `pipeline_versions` - Pipeline version history
- `pipeline_templates` - Reusable pipeline templates

### Execution Management
- `pipeline_runs` - Pipeline execution instances
- `task_executions` - Individual task executions
- `execution_logs` - Execution logging

### File Management
- `file_uploads` - File upload tracking
- `artifacts` - Pipeline execution artifacts
- `file_references` - File usage tracking
- `thumbnails` - Image thumbnails

### System Configuration
- `provider_credentials` - Third-party provider credentials

## Environment Configuration

### Development
```bash
# Generate migration and apply to dev database
npm run prisma:migrate dev --name "descriptive_name"

# Reset database (development only)
npm run prisma:migrate reset

# Generate Prisma client
npm run prisma:generate

# Open database browser
npm run prisma:studio
```

### Production
```bash
# Deploy migrations to production
npm run prisma:migrate deploy

# Generate Prisma client for production
npm run prisma:generate
```

## Rollback Procedures

### Development Rollback
1. Reset the database: `npm run prisma:migrate reset`
2. Remove problematic migration files
3. Re-run migrations: `npm run prisma:migrate dev`

### Production Rollback
1. **Stop the application**
2. **Restore database backup**
3. **Deploy previous migration state**
4. **Restart application**
5. **Verify functionality**

### Creating Rollback Migrations
For complex changes, create explicit rollback migrations:
```bash
# Create rollback migration
npx prisma migrate dev --name "rollback_feature_x"
```

## Testing Migrations

### Pre-Migration Testing
1. **Schema Validation**: Ensure schema is valid
2. **Data Integrity**: Check foreign key constraints
3. **Performance Testing**: Test with realistic data volumes
4. **Application Testing**: Verify application compatibility

### Post-Migration Testing
1. **Data Verification**: Confirm data integrity
2. **Performance Monitoring**: Monitor query performance
3. **Application Testing**: Test all affected features
4. **Rollback Testing**: Verify rollback procedures work

## Common Migration Patterns

### Adding New Table
```sql
-- Example: Adding user preferences table
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'light',
    "language" TEXT NOT NULL DEFAULT 'en',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE
);
```

### Adding New Column
```sql
-- Example: Adding soft delete to existing table
ALTER TABLE "pipelines" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "pipelines" ADD COLUMN "deletedBy" TEXT;
```

### Creating Indexes
```sql
-- Example: Adding performance indexes
CREATE INDEX "pipelines_deletedAt_idx" ON "pipelines"("deletedAt");
CREATE INDEX "pipelines_userId_status_idx" ON "pipelines"("userId", "status");
```

### Modifying Existing Tables (SQLite)
```sql
-- SQLite requires table recreation for complex changes
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_table" (
    -- New schema definition
);

INSERT INTO "new_table" SELECT ... FROM "old_table";
DROP TABLE "old_table";
ALTER TABLE "new_table" RENAME TO "old_table";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
```

## Monitoring and Maintenance

### Regular Tasks
- **Monitor Migration Performance**: Track migration execution times
- **Review Schema Changes**: Regular schema reviews
- **Cleanup Old Migrations**: Archive old migration files
- **Update Documentation**: Keep migration docs current

### Performance Monitoring
- **Query Performance**: Monitor slow queries after migrations
- **Index Usage**: Verify indexes are being used
- **Database Size**: Monitor database growth
- **Connection Pooling**: Ensure efficient connection usage

## Troubleshooting

### Common Issues
1. **Migration Drift**: Database schema doesn't match migration history
2. **Data Loss**: Accidental data deletion during migration
3. **Performance Degradation**: Slow queries after migration
4. **Constraint Violations**: Foreign key or unique constraint issues

### Solutions
1. **Drift Detection**: Use `prisma db pull` to detect drift
2. **Backup Recovery**: Restore from backup if data is lost
3. **Index Optimization**: Add missing indexes for performance
4. **Constraint Fixes**: Identify and fix constraint violations

## Security Considerations

### Data Protection
- **Backup Encryption**: Encrypt database backups
- **Access Control**: Limit migration privileges
- **Audit Logging**: Log all migration activities
- **Sensitive Data**: Handle sensitive data carefully during migrations

### Migration Security
- **Code Review**: Review all migration code
- **Testing**: Test migrations in isolated environments
- **Validation**: Validate data integrity after migrations
- **Rollback Planning**: Always have a rollback plan

## Resources

### Documentation
- [Prisma Migrate Documentation](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Database Schema Design Best Practices](https://www.prisma.io/docs/guides/database/database-schema-design)

### Tools
- **Prisma Studio**: Visual database browser
- **Migration Scripts**: Custom migration utilities
- **Backup Tools**: Database backup solutions
- **Monitoring**: Database monitoring tools
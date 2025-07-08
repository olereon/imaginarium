# Migration System

This document provides a quick reference for the Imaginarium migration system.

## Quick Start

### Development

```bash
# Create a new migration
npm run migrate:dev migrate add_new_feature

# Check migration status
npm run migrate:status

# Reset database (development only)
npm run migrate:dev reset

# Run tests
npm run migrate:test
```

### Production

```bash
# Create backup
npm run migrate:backup

# Deploy migrations
ENVIRONMENT=production npm run migrate:deploy deploy

# Check status
npm run migrate:prod status

# Rollback if needed
npm run migrate:rollback interactive
```

## Available Scripts

### Development Scripts
- `npm run migrate:dev migrate <name>` - Create and apply new migration
- `npm run migrate:dev reset` - Reset development database
- `npm run migrate:dev status` - Show migration status
- `npm run migrate:dev generate` - Generate Prisma client
- `npm run migrate:dev backup` - Create development backup

### Production Scripts
- `npm run migrate:prod deploy` - Deploy migrations to production
- `npm run migrate:prod backup` - Create production backup
- `npm run migrate:prod status` - Show production migration status
- `npm run migrate:prod cleanup` - Clean up old backups

### Testing Scripts
- `npm run migrate:test` - Run all migration tests
- `npm run migrate:test forward` - Test forward migration
- `npm run migrate:test backward` - Test rollback
- `npm run migrate:test performance` - Test migration performance

### Rollback Scripts
- `npm run migrate:rollback list` - List available backups
- `npm run migrate:rollback interactive` - Interactive backup selection
- `npm run migrate:rollback restore <file>` - Restore specific backup

### Deployment Scripts
- `npm run migrate:deploy deploy` - Deploy with full testing
- `npm run migrate:deploy deploy --dry-run` - Show what would be deployed
- `npm run migrate:deploy status` - Show deployment status

## Environment Variables

### Required
- `DATABASE_URL` - Database connection string
- `ENVIRONMENT` - Target environment (development/staging/production)

### Optional
- `SLACK_WEBHOOK_URL` - Slack notifications
- `SKIP_BACKUP` - Skip backup creation
- `SKIP_MAINTENANCE` - Skip maintenance mode

## Common Workflows

### Creating a New Migration

```bash
# 1. Make changes to prisma/schema.prisma
# 2. Create migration
npm run migrate:dev migrate add_user_preferences

# 3. Test the migration
npm run migrate:test

# 4. Commit changes
git add prisma/
git commit -m "feat: add user preferences migration"
```

### Deploying to Production

```bash
# 1. Ensure all tests pass
npm run migrate:test

# 2. Create backup
npm run migrate:backup

# 3. Deploy with testing
ENVIRONMENT=production npm run migrate:deploy deploy

# 4. Verify deployment
npm run migrate:prod status
```

### Rolling Back

```bash
# 1. List available backups
npm run migrate:rollback list

# 2. Select backup interactively
npm run migrate:rollback interactive

# 3. Or restore specific backup
npm run migrate:rollback restore backups/backup_prod_20250708_120000.sql
```

## File Structure

```
prisma/
├── schema.prisma              # Database schema
├── migrations/               # Migration files
│   ├── 20250708124436_init/
│   └── 20250708154923_add_all_missing_models_and_fields/
├── backups/                  # Development backups
└── seed.ts                   # Database seeding

scripts/
├── migrate-dev.sh            # Development migration script
├── migrate-prod.sh           # Production migration script
├── test-migration.sh         # Migration testing script
├── rollback.sh              # Rollback script
└── deploy-migration.sh       # Deployment script

docs/
├── migrations.md             # Detailed migration guide
└── migration-readme.md       # This file

.github/workflows/
└── migration.yml             # CI/CD automation
```

## Migration Naming Convention

```
YYYYMMDDHHMMSS_descriptive_name
```

Examples:
- `20250708154923_add_all_missing_models_and_fields`
- `20250708130718_enhance_user_session_apikey_models`
- `20250708124436_init`

## Troubleshooting

### Migration Drift
```bash
# Check for drift
npm run migrate:prod status

# Reset development database
npm run migrate:dev reset
```

### Failed Migration
```bash
# Check logs
cat migration_*.log

# Rollback
npm run migrate:rollback interactive
```

### Performance Issues
```bash
# Test with large dataset
npm run migrate:test large-dataset

# Check for missing indexes
npm run migrate:test constraints
```

## Best Practices

1. **Always test migrations** before production deployment
2. **Create backups** before production migrations
3. **Use descriptive names** for migrations
4. **Never modify existing migrations** - create new ones instead
5. **Test rollback procedures** regularly
6. **Monitor migration performance** in production
7. **Keep migration scripts simple** and focused

## Support

For detailed information, see:
- [Migration Guide](./migrations.md) - Comprehensive documentation
- [CI/CD Workflows](.github/workflows/migration.yml) - Automation setup
- [Prisma Documentation](https://www.prisma.io/docs/concepts/components/prisma-migrate) - Official Prisma guide

## Emergency Contacts

In case of production migration issues:
1. Check deployment logs
2. Use rollback scripts
3. Contact the development team
4. Escalate to infrastructure team if needed